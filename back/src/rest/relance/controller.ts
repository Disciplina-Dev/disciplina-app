import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { GoogleGmailService } from '../../external/google/gmail.service';
import { GoogleTokens } from '../../external/google/types';
import { UserService } from '../../services/UserService';
import { CandidateService } from '../../services/CandidateService';
import { CompaniesService } from '../../services/CompaniesService';
import { RelanceHistoryRepository } from '../../repositories/mysql/RelanceHistoryRepository';
import { toRelanceHistory } from '../../services/mappers/company.mapper';
import { CandidateStatus } from '../../types/candidate.types';
import { Role } from '../../types/user.types';
import { signRelanceUrl, verifyRelanceUrl } from '../../external/crypto';
import { env } from '../../config/env';
import { logger } from '../../external/logger';
import { confirmationPage } from '../shared/confirmationPage';
import { MailTemplateService } from '../../services/MailTemplateService';

const mailTemplateService = new MailTemplateService();
const candidateService = new CandidateService();
const userService = new UserService();
const gmailService = new GoogleGmailService();
const companiesService = new CompaniesService();
const relanceHistoryRepo = new RelanceHistoryRepository();

const RELANCE_ROLES = [Role.COMMERCIAL, Role.RESPONSABLE, Role.ADMIN];

/**
 * Vérifie l'accès à l'entreprise pour une action de relance. Renvoie l'entreprise
 * ou null (en ayant déjà répondu en erreur). Un COMMERCIAL n'agit que sur ses entreprises.
 */
async function loadOwnedCompany(req: AuthRequest, res: Response, companyId: number) {
    if (!RELANCE_ROLES.includes(req.user?.role as Role)) {
        res.status(403).json({ error: 'Forbidden' });
        return null;
    }
    if (!Number.isInteger(companyId) || companyId <= 0) {
        res.status(400).json({ error: 'Invalid company ID' });
        return null;
    }
    const company = await companiesService.findById(companyId);
    if (!company) {
        res.status(404).json({ error: 'Entreprise introuvable' });
        return null;
    }
    if (req.user?.role === Role.COMMERCIAL && company.userID != null && company.userID !== req.user.id) {
        res.status(403).json({ error: 'Forbidden' });
        return null;
    }
    return company;
}

/** Relance par mail : envoie le mail (depuis le compte du commercial), historise, vide la relance. */
export async function sendCompanyMailRelance(req: AuthRequest, res: Response): Promise<void> {
    const companyId = Number(req.params.id);
    const company = await loadOwnedCompany(req, res, companyId);
    if (!company) return;

    const { to, subject, html, text, attachments, typeRelance } = req.body as {
        to?: string;
        subject?: string;
        html?: string;
        text?: string;
        attachments?: { filename: string; contentType: string; content: string }[];
        typeRelance?: number;
    };
    if (!to || !subject) {
        res.status(400).json({ error: 'Destinataire et objet requis' });
        return;
    }

    const user = await userService.findById(req.user.id);
    if (!user?.oauthToken || !user?.refreshToken) {
        res.status(403).json({ error: 'Compte Google non connecté. Veuillez connecter votre compte Google.' });
        return;
    }

    try {
        await gmailService.sendEmail(
            { access_token: user.oauthToken, refresh_token: user.refreshToken },
            { to, subject, html: html ?? '', text: text ?? '', attachments },
            persistRefreshedTokens(user.id),
        );
    } catch (err) {
        logger.error({ err, companyId }, '[relance] mail send failed');
        res.status(502).json({ error: "L'envoi du mail a échoué" });
        return;
    }

    await relanceHistoryRepo.create({
        companyID: companyId,
        userID: req.user.id,
        typeRelance: typeRelance ?? company.relanceType ?? null,
        channel: 'MAIL',
        subject,
    });
    await companiesService.clearRelance(companyId);

    res.status(200).json({ success: true });
}

/** Relance téléphonique : historise le résumé d'appel et vide la relance (aucun mail). */
export async function completePhoneRelance(req: AuthRequest, res: Response): Promise<void> {
    const companyId = Number(req.params.id);
    const company = await loadOwnedCompany(req, res, companyId);
    if (!company) return;

    const { note, typeRelance } = req.body as { note?: string; typeRelance?: number };
    if (!note || !note.trim()) {
        res.status(400).json({ error: "Le résumé de l'appel est requis" });
        return;
    }

    await relanceHistoryRepo.create({
        companyID: companyId,
        userID: req.user.id,
        typeRelance: typeRelance ?? company.relanceType ?? null,
        channel: 'PHONE',
        note: note.trim(),
    });
    await companiesService.clearRelance(companyId);

    res.status(200).json({ success: true });
}

/** Historique des relances d'une entreprise. */
export async function getCompanyRelanceHistory(req: AuthRequest, res: Response): Promise<void> {
    const companyId = Number(req.params.id);
    const company = await loadOwnedCompany(req, res, companyId);
    if (!company) return;

    const rows = await relanceHistoryRepo.findByCompanyId(companyId);
    res.status(200).json(rows.map(toRelanceHistory));
}

const persistRefreshedTokens = (userId: number) => (refreshed: GoogleTokens) =>
    userService.updateGoogleTokens(userId, refreshed.access_token ?? null, refreshed.refresh_token ?? null);

export async function sendRelance(req: AuthRequest, res: Response) {
    const user = await userService.findById(req.user.id);
    if (!user?.oauthToken || !user?.refreshToken) {
        res.status(403).json({ error: 'Compte Google non connecté. Veuillez connecter votre compte Google.' });
        return;
    }

    const { ids } = req.body as { ids?: string[] };
    const candidates = await candidateService.findAll();
    const seeking = candidates.filter(
        (c) =>
            c.identity?.email && (ids && ids.length > 0 ? ids.includes(c._id) : c.status === CandidateStatus.SEEKING),
    );

    let sent = 0;
    let errors = 0;

    // Signature personnelle du RH, récupérée une seule fois pour tout le lot.
    const signatureHtml = await mailTemplateService.getSignatureHtml(req.user.id, 'rh').catch(() => '');

    for (const candidate of seeking) {
        const name = candidate.identity.full_name?.split(' ')[0] ?? 'Candidat';
        const sig_oui = signRelanceUrl(candidate._id, 'oui');
        const sig_non = signRelanceUrl(candidate._id, 'non');
        const ouiUrl = `${env.APP_BASE_URL}/api/relance/response?id=${candidate._id}&answer=oui&sig=${sig_oui}`;
        const nonUrl = `${env.APP_BASE_URL}/api/relance/response?id=${candidate._id}&answer=non&sig=${sig_non}`;

        const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 20px; color: #1f2937; }
  .logo { color: #60207E; font-weight: 800; font-size: 20px; margin-bottom: 28px; letter-spacing: -0.5px; }
  p { line-height: 1.6; margin: 0 0 16px; }
  .question { font-size: 17px; font-weight: 700; margin: 28px 0 24px; }
  .buttons { display: flex; gap: 12px; margin: 28px 0; }
  .btn { display: inline-block; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px; }
  .btn-oui { background: #60207E; color: #ffffff; }
  .btn-non { background: #f3f4f6; color: #374151; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px; }
</style>
</head>
<body>
  <div class="logo">DISCIPLINA</div>
  <p>Bonjour ${name},</p>
  <p>Nous faisons le point sur votre recherche d'alternance et souhaitons mettre votre dossier à jour.</p>
  <p class="question">Êtes-vous toujours en recherche d'une alternance ?</p>
  <div class="buttons">
    <a href="${ouiUrl}" class="btn btn-oui">✓ &nbsp;Oui, je suis toujours en recherche</a>
    <a href="${nonUrl}" class="btn btn-non">✗ &nbsp;Non, je ne recherche plus</a>
  </div>
  <p>Un simple clic suffit — votre dossier sera mis à jour automatiquement.</p>
  <div class="footer">Cordialement,<br>L'équipe DISCIPLINA${signatureHtml}</div>
</body>
</html>`;

        const text = `Bonjour ${name},\n\nÊtes-vous toujours en recherche d'une alternance ?\n\nOui : ${ouiUrl}\nNon : ${nonUrl}\n\nCordialement,\nL'équipe DISCIPLINA`;

        try {
            await gmailService.sendEmail(
                { access_token: user.oauthToken, refresh_token: user.refreshToken },
                {
                    to: candidate.identity.email!,
                    subject: 'DISCIPLINA – Êtes-vous toujours en recherche ?',
                    html,
                    text,
                },
                persistRefreshedTokens(user.id),
            );
            sent++;
        } catch {
            errors++;
        }
    }

    res.json({ sent, errors, total: seeking.length });
}

export async function handleResponse(req: Request, res: Response) {
    const { id, answer, sig } = req.query as { id?: string; answer?: string; sig?: string };

    if (!id || !answer || !sig || !['oui', 'non'].includes(answer)) {
        return res.status(400).send(confirmationPage('Lien invalide.', false));
    }

    if (!verifyRelanceUrl(id, answer, sig)) {
        return res.status(400).send(confirmationPage('Lien invalide ou expiré.', false));
    }

    const newStatus = answer === 'non' ? CandidateStatus.NOT_SEEKING : CandidateStatus.SEEKING;

    let updated;
    try {
        updated = await candidateService.update(id, { status: newStatus });
        logger.info({ id, answer, newStatus }, '[relance] status updated');
    } catch (err) {
        logger.error({ err }, '[relance] update error');
        return res.status(500).send(confirmationPage('Une erreur est survenue.', false));
    }

    if (!updated) {
        return res.status(404).send(confirmationPage('Candidat introuvable.', false));
    }

    const message =
        answer === 'non'
            ? 'Merci pour votre retour. Votre dossier a été mis à jour — bonne continuation !'
            : 'Merci ! Votre dossier reste actif. Nous restons en contact.';

    res.send(confirmationPage(message, true));
}

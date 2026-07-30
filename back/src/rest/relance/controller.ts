import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { GoogleGmailService } from '../../external/google/gmail.service';
import { UserService } from '../../services/UserService';
import { CandidateService } from '../../services/CandidateService';
import { CompaniesService } from '../../services/CompaniesService';
import { RelanceHistoryRepository } from '../../repositories/mysql/RelanceHistoryRepository';
import { toRelanceHistory } from '../../services/mappers/company.mapper';
import { CandidateStatus } from '../../types/candidate.types';
import { JobRole, Permission } from '../../types/user.types';
import { signRelanceUrl, verifyRelanceUrl } from '../../external/crypto';
import { env } from '../../config/env';
import { logger } from '../../external/logger';
import { confirmationPage } from '../shared/confirmationPage';
import { MailTemplateService } from '../../services/MailTemplateService';
import { BulkRelanceService } from '../../services/BulkRelanceService';

const mailTemplateService = new MailTemplateService();
const bulkRelanceService = new BulkRelanceService();
const candidateService = new CandidateService();
const userService = new UserService();
const gmailService = new GoogleGmailService();
const companiesService = new CompaniesService();
const relanceHistoryRepo = new RelanceHistoryRepository();

/**
 * Vérifie l'accès à l'entreprise pour une action de relance. Renvoie l'entreprise
 * ou null (en ayant déjà répondu en erreur). Un COMMERCIAL n'agit que sur ses entreprises.
 */
async function loadOwnedCompany(req: AuthRequest, res: Response, companyId: number) {
    const hasPermission = req.user?.permission === Permission.RESPONSABLE || req.user?.permission === Permission.ADMIN;
    const hasJobRole = req.user?.role === JobRole.COMMERCIAL;
    if (!hasPermission && !hasJobRole) {
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
    if (req.user?.role === JobRole.COMMERCIAL && company.userID != null && company.userID !== req.user.id) {
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
            userService.googleTokenPersister(user.id),
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

/** Relance groupée asynchrone — lance l'envoi en arrière-plan et répond immédiatement. */
export async function sendCompanyBulkRelance(req: AuthRequest, res: Response): Promise<void> {
    const { ids, templateId, all } = req.body as { ids?: number[]; templateId?: string; all?: boolean };

    if (!templateId) {
        res.status(400).json({ error: 'Modèle de mail requis.' });
        return;
    }

    if (!all && (!Array.isArray(ids) || ids.length === 0)) {
        res.status(400).json({ error: 'Sélectionne des entreprises ou utilise le mode "Toutes les entreprises".' });
        return;
    }

    bulkRelanceService.startCompanyBulk(req.user.id, { ids: ids ?? [], templateId, all: all ?? false }).catch((err) => {
        logger.error({ err }, '[bulk-relance] background job failed');
    });

    res.status(202).json({ message: 'Relance lancée en arrière-plan. Vous serez notifié à la fin.' });
}

/** Conversion HTML → texte brut, best-effort, pour l'alternative text/plain d'un mail. */
function htmlToText(html: string): string {
    return html
        .replace(/<\s*(br|\/p|\/div|\/h[1-6]|\/li)\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

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

    // NB : pas de header List-Unsubscribe ici. Ce mail vise une réponse individuelle
    // (Oui/Non) ; l'ajouter le fait classer « bulk » par Gmail et bascule en spam.

    for (const candidate of seeking) {
        const name = candidate.identity.full_name?.split(' ')[0] ?? 'Candidat';
        const oui = signRelanceUrl(candidate._id, 'oui');
        const non = signRelanceUrl(candidate._id, 'non');
        const ouiUrl = `${env.APP_BASE_URL}/api/relance/response?id=${candidate._id}&answer=oui&sig=${oui.sig}&ts=${oui.ts}`;
        const nonUrl = `${env.APP_BASE_URL}/api/relance/response?id=${candidate._id}&answer=non&sig=${non.sig}&ts=${non.ts}`;

        // Volontairement sobre : pas de <style>/DOCTYPE, pas de gros boutons colorés
        // ni de footer type newsletter. Une mise en forme « campagne » fait basculer
        // le mail dans l'onglet Promotions / Spam de Gmail, même à faible volume.
        const html = `<div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
  <p>Bonjour ${name},</p>
  <p>Nous faisons le point sur votre recherche d'alternance et souhaitons mettre votre dossier à jour.</p>
  <p>Êtes-vous toujours en recherche d'une alternance ?</p>
  <p>
    <a href="${ouiUrl}" style="color: #60207E;">Oui, je suis toujours en recherche</a><br>
    <a href="${nonUrl}" style="color: #60207E;">Non, je ne recherche plus</a>
  </p>
  <p>Un simple clic suffit, votre dossier sera mis à jour automatiquement.</p>
  <p>Cordialement,<br>L'équipe DISCIPLINA${signatureHtml}</p>
</div>`;

        const text = `Bonjour ${name},\n\nÊtes-vous toujours en recherche d'une alternance ?\n\nOui : ${ouiUrl}\nNon : ${nonUrl}\n\nCordialement,\nL'équipe DISCIPLINA`;

        try {
            await gmailService.sendEmail(
                { access_token: user.oauthToken, refresh_token: user.refreshToken },
                {
                    to: candidate.identity.email!,
                    subject: `${name}, êtes-vous toujours en recherche d'une alternance ?`,
                    html,
                    text,
                },
                userService.googleTokenPersister(user.id),
            );
            // Horodate la relance envoyée. La date de réponse d'un cycle précédent reste en base ;
            // l'affichage ne la considère « à jour » que si elle est postérieure à cette relance.
            await candidateService
                .update(candidate._id, { last_relance_at: new Date() })
                .catch((err) => logger.error({ err, id: candidate._id }, '[relance] last_relance_at update failed'));
            sent++;
        } catch {
            errors++;
        }
    }

    res.json({ sent, errors, total: seeking.length });
}

/**
 * Envoi groupé d'un modèle de mail RH à une sélection de candidats. Contrairement
 * à `sendRelance` (relance de disponibilité codée en dur avec liens Oui/Non), le
 * corps provient d'un modèle RH partagé et part tel quel à chaque destinataire.
 */
export async function sendBulkRelance(req: AuthRequest, res: Response): Promise<void> {
    const user = await userService.findById(req.user.id);
    if (!user?.oauthToken || !user?.refreshToken) {
        res.status(403).json({ error: 'Compte Google non connecté. Veuillez connecter votre compte Google.' });
        return;
    }

    const { ids, templateId } = req.body as { ids?: string[]; templateId?: string };
    if (!Array.isArray(ids) || ids.length === 0 || !templateId) {
        res.status(400).json({ error: 'Sélection de candidats et modèle requis' });
        return;
    }

    // Modèles RH partagés : on récupère le modèle par son id.
    const templates = await mailTemplateService.list(req.user.id, 'rh');
    const template = templates.find((t) => t.id === templateId);
    if (!template) {
        res.status(404).json({ error: 'Modèle introuvable' });
        return;
    }

    // Pièce jointe éventuelle (décompressée depuis Drive) — best-effort.
    let attachments: { filename: string; contentType: string; content: string }[] | undefined;
    if (template.attachment) {
        try {
            attachments = [await mailTemplateService.resolveAttachment(req.user.id, templateId)];
        } catch (err) {
            logger.error({ err, templateId }, '[relance] attachment resolve failed');
        }
    }

    const signatureHtml = await mailTemplateService.getSignatureHtml(req.user.id, 'rh').catch(() => '');

    // Désabonnement pointant vers la boîte du RH émetteur (Gmail bulk sender rules).
    const listUnsubscribe = user.email ? `<mailto:${user.email}?subject=Desabonnement>` : undefined;
    // Version texte dérivée du modèle HTML : évite un mail HTML-only (signal spam).
    const bodyText = htmlToText(template.body);

    const candidates = await candidateService.findAll();
    const recipients = candidates.filter((c) => c.identity?.email && ids.includes(c._id));

    let sent = 0;
    let errors = 0;
    for (const candidate of recipients) {
        try {
            await gmailService.sendEmail(
                { access_token: user.oauthToken, refresh_token: user.refreshToken },
                {
                    to: candidate.identity.email!,
                    subject: template.subject,
                    html: `${template.body}${signatureHtml}`,
                    text: bodyText,
                    listUnsubscribe,
                    attachments,
                },
                userService.googleTokenPersister(user.id),
            );
            sent++;
        } catch {
            errors++;
        }
    }

    res.json({ sent, errors, total: recipients.length });
}

export async function handleResponse(req: Request, res: Response) {
    const { id, answer, sig, ts } = req.query as { id?: string; answer?: string; sig?: string; ts?: string };

    if (!id || !answer || !sig || !ts || !['oui', 'non'].includes(answer)) {
        return res.status(400).send(confirmationPage('Lien invalide.', false));
    }

    if (!verifyRelanceUrl(id, answer, sig, Number(ts))) {
        return res.status(400).send(confirmationPage('Lien invalide ou expiré.', false));
    }

    const newStatus = answer === 'non' ? CandidateStatus.NOT_SEEKING : CandidateStatus.SEEKING;

    let updated;
    try {
        updated = await candidateService.update(id, { status: newStatus, relance_response_at: new Date() });
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

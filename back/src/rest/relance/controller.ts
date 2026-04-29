import { Request, Response } from 'express';
import { transporter } from '../email/transporter';
import { CandidateService } from '../../services/CandidateService';
import { CandidateStatus } from '../../db/mongodb/interface';

const candidateService = new CandidateService();

export async function sendRelance(req: Request, res: Response) {
    const { ids } = req.body as { ids?: string[] };
    const candidates = await candidateService.findAll();
    const seeking = candidates.filter(c =>
        c.identity?.email &&
        (ids && ids.length > 0 ? ids.includes(c._id) : c.status === CandidateStatus.SEEKING)
    );

    const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:4000';
    let sent = 0;
    let errors = 0;

    for (const candidate of seeking) {
        const name = candidate.identity.full_name?.split(' ')[0] ?? 'Candidat';
        const ouiUrl = `${BASE_URL}/api/relance/response?id=${candidate._id}&answer=oui`;
        const nonUrl = `${BASE_URL}/api/relance/response?id=${candidate._id}&answer=non`;

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
  <div class="footer">Cordialement,<br>L'équipe DISCIPLINA</div>
</body>
</html>`;

        try {
            await transporter.sendMail({
                from: process.env.SMTP_FROM || process.env.SMTP_USER,
                to: candidate.identity.email,
                subject: 'DISCIPLINA – Êtes-vous toujours en recherche ?',
                html,
                text: `Bonjour ${name},\n\nÊtes-vous toujours en recherche d'une alternance ?\n\nOui : ${ouiUrl}\nNon : ${nonUrl}\n\nCordialement,\nL'équipe DISCIPLINA`,
            });
            sent++;
        } catch {
            errors++;
        }
    }

    res.json({ sent, errors, total: seeking.length });
}

export async function handleResponse(req: Request, res: Response) {
    const { id, answer } = req.query as { id?: string; answer?: string };

    if (!id || !answer || !['oui', 'non'].includes(answer)) {
        return res.status(400).send(confirmationPage('Lien invalide.', false));
    }

    const newStatus = answer === 'non' ? CandidateStatus.NOT_SEEKING : CandidateStatus.SEEKING;

    let updated;
    try {
        updated = await candidateService.update(id, { status: newStatus });
        console.log('[relance] update result:', JSON.stringify(updated));
        console.log('[relance] id:', id, '| answer:', answer, '| newStatus:', newStatus);
    } catch (err) {
        console.error('[relance] update error:', err);
        return res.status(500).send(confirmationPage('Une erreur est survenue.', false));
    }

    if (!updated) {
        console.warn('[relance] no document found for id:', id);
        return res.status(404).send(confirmationPage('Candidat introuvable.', false));
    }

    const message = answer === 'non'
        ? 'Merci pour votre retour. Votre dossier a été mis à jour — bonne continuation !'
        : 'Merci ! Votre dossier reste actif. Nous restons en contact.';

    res.send(confirmationPage(message, true));
}

function confirmationPage(message: string, success: boolean): string {
    const color = success ? '#60207E' : '#ef4444';
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>DISCIPLINA</title>
<style>
  body { font-family: Arial, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f9fafb; }
  .card { background: white; border-radius: 16px; padding: 48px 40px; max-width: 480px; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  .logo { color: #60207E; font-weight: 800; font-size: 22px; margin-bottom: 24px; }
  .icon { font-size: 48px; margin-bottom: 20px; }
  p { color: #374151; line-height: 1.6; font-size: 16px; }
</style>
</head>
<body>
  <div class="card">
    <div class="logo">DISCIPLINA</div>
    <div class="icon">${success ? '✅' : '❌'}</div>
    <p>${message}</p>
    <p style="color:#9ca3af;font-size:13px;margin-top:24px">Vous pouvez fermer cette page.</p>
  </div>
</body>
</html>`;
}

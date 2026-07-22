import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { CandidateService } from '../../services/CandidateService';
import { ExternalLinkService } from '../../services/ExternalLinkService';
import { ExternalMailService } from '../../services/ExternalMailService';
import { env } from '../../config/env';
import { logger } from '../../external/logger';

const candidateService = new CandidateService();
const externalLinkService = new ExternalLinkService();
const externalMailService = new ExternalMailService();

export async function sendCvImportMail(req: AuthRequest, res: Response): Promise<void> {
    const { candidateUuid, subject, body, attachments } = req.body;

    if (!candidateUuid || !subject || !body) {
        res.status(400).json({ error: 'Champs manquants : candidateUuid, subject, body' });
        return;
    }

    if (!req.user?.email) {
        res.status(401).json({ error: 'Utilisateur non identifié' });
        return;
    }

    const rhEmail: string = req.user.email;

    const candidate = await candidateService.findById(candidateUuid);
    if (!candidate) {
        res.status(404).json({ error: 'Candidat introuvable' });
        return;
    }

    const fullName = candidate.identity.full_name;
    const spaceIdx = fullName.indexOf(' ');
    const firstName = spaceIdx > 0 ? fullName.slice(0, spaceIdx) : fullName;
    const lastName = spaceIdx > 0 ? fullName.slice(spaceIdx + 1) : '';

    const linkResult = await externalLinkService.createLink({
        externalEmail: candidate.identity.email,
        rhEmail,
        guestType: 'CANDIDATE',
        externalUuid: candidateUuid,
    });

    const importLink = `${env.FRONTEND_BASE_URL}/public/cv-import?sig=${linkResult.signature}`;

    const replacements: Record<string, string> = {
        '{{prenom}}': firstName,
        '{{nom}}': lastName,
        '{{code}}': linkResult.code,
        '{{lien_import}}': importLink,
    };

    let resolvedSubject = subject;
    let resolvedBody = body;
    for (const [key, value] of Object.entries(replacements)) {
        resolvedSubject = resolvedSubject.replaceAll(key, value);
        resolvedBody = resolvedBody.replaceAll(key, value);
    }

    try {
        await externalMailService.sendMail(rhEmail, {
            to: candidate.identity.email,
            subject: resolvedSubject,
            html: resolvedBody,
            attachments,
        });
        res.json({ success: true });
    } catch (err: any) {
        logger.error({ err, candidateUuid }, '[cv-import] failed to send mail');
        res.status(502).json({ error: "L'envoi du mail a échoué" });
    }
}

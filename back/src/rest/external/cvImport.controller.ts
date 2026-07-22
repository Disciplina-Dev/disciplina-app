import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ExternalGuestRequest } from './guard';
import { CandidateService } from '../../services/CandidateService';
import { ExternalLinkService } from '../../services/ExternalLinkService';
import { ExternalMailService } from '../../services/ExternalMailService';
import { UserService } from '../../services/UserService';
import { GoogleDriveService } from '../../external/google/drive.service';
import { env } from '../../config/env';
import { logger } from '../../external/logger';

const candidateService = new CandidateService();
const externalLinkService = new ExternalLinkService();
const externalMailService = new ExternalMailService();

export const CV_MIME_EXT: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
};

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

export async function uploadCv(req: ExternalGuestRequest, res: Response): Promise<void> {
    const { signature } = req.params;
    const externalUuid = req.guest!.externalUuid;

    const candidate = await candidateService.findById(externalUuid);
    if (!candidate) {
        res.status(404).json({ error: 'Candidat introuvable' });
        return;
    }
    if (!candidate.drive_folder_id) {
        res.status(400).json({ error: 'Aucun dossier Drive associé au candidat' });
        return;
    }

    const mimeType = (req.headers['content-type'] ?? '').split(';')[0].trim();
    const ext = CV_MIME_EXT[mimeType];
    if (!ext) {
        res.status(400).json({ error: 'Type de fichier non supporté (PDF ou image)' });
        return;
    }

    const fileBuffer = req.body as Buffer;
    if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
        res.status(400).json({ error: 'Fichier requis' });
        return;
    }

    const context = await externalLinkService.getContext(signature);
    if (!context) {
        res.status(404).json({ error: 'Session introuvable' });
        return;
    }

    const userService = new UserService();
    const rh = await userService.findByEmail(context.rhEmail);
    if (!rh || !rh.oauthToken) {
        res.status(502).json({ error: 'Drive du RH non connecté' });
        return;
    }

    try {
        const driveService = GoogleDriveService.fromTokens(
            { access_token: rh.oauthToken, refresh_token: rh.refreshToken ?? undefined },
            userService.googleTokenPersister(rh.id),
        );

        const fileName = `CV_Candidat_${candidate.identity.full_name}.${ext}`;
        const { webViewLink: fileLink } = await driveService.uploadFile(
            fileName,
            mimeType,
            fileBuffer,
            candidate.drive_folder_id,
        );

        await candidateService.update(externalUuid, { cv_link: fileLink });
        res.json({ fileLink });
    } catch (err) {
        logger.error(err, '[cv-import] upload CV failed');
        res.status(500).json({ error: "L'upload du CV a échoué" });
    }
}

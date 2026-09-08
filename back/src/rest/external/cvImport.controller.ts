import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ExternalGuestRequest } from './guard';
import { CandidateService } from '../../services/CandidateService';
import { ExternalMailService } from '../../services/ExternalMailService';
import { ExternalAccessService } from '../../services/ExternalAccessService';
import { UserService } from '../../services/UserService';
import { GoogleDriveService } from '../../external/google/drive.service';
import { ExternalAccessRepository } from '../../repositories/mysql/ExternalAccessRepository';
import { logger } from '../../external/logger';

const candidateService = new CandidateService();
const externalMailService = new ExternalMailService();
const externalAccessService = new ExternalAccessService();
const externalAccessRepository = new ExternalAccessRepository();

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

    const linkResult = await externalAccessService.createInvite({
        userId: req.user?.id,
        externalId: candidateUuid,
        externalType: 'CANDIDATE',
        externalEmail: candidate.identity.email,
        externalFirstName: firstName,
        referenceId: 1,
        referenceKey: candidateUuid,
    });
    if (!linkResult.success) {
        res.status(502).json({ error: "La génération du lien a échoué" });
        return;
    }

    const importButton =
        `<a href="${linkResult.link}" style="display:inline-block;background-color:#60207E;color:#fff;` +
        `padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">Importer mon CV</a>`;

    const replacements: Record<string, string> = {
        '{{prenom}}': firstName,
        '{{nom}}': lastName,
        '{{lien_import}}': importButton,
    };

    let resolvedSubject = subject;
    let resolvedBody = body;
    for (const [key, value] of Object.entries(replacements)) {
        resolvedSubject = resolvedSubject.replaceAll(key, value);
        resolvedBody = resolvedBody.replaceAll(key, value);
    }
    // Le code est généré et envoyé au chargement de la page : on retire du mail
    // un éventuel {{code}} laissé par un modèle édité.
    resolvedSubject = resolvedSubject.replaceAll('{{code}}', '');
    resolvedBody = resolvedBody.replaceAll('{{code}}', '');

    // Sécurité : le candidat doit toujours recevoir le lien, même si le modèle
    // édité a supprimé {{lien_import}}.
    if (!resolvedBody.includes(linkResult.link)) {
        resolvedBody += `<p style="text-align:center;margin:24px 0">${importButton}</p>`;
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
    if (!externalUuid) {
        res.status(401).json({ error: 'Session invalide' });
        return;
    }

    const row = await externalAccessRepository.findBySignature(signature);
    if (!row) {
        res.status(404).json({ error: 'Session introuvable' });
        return;
    }
    if (row.status === 'COMPLETED') {
        res.status(409).json({ error: 'CV déjà importé' });
        return;
    }

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

    const userService = new UserService();
    const rh = await userService.findById(row.user_id);
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

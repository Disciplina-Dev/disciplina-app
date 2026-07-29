import express, { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import multer from 'multer';
import { authenticate, AuthRequest } from '../middleware/auth';
import { JobRole, Permission } from '../../types/user.types';
import { CandidateService } from '../../services/CandidateService';
import { CandidateRepository } from '../../repositories/mongo/CandidateRepository';
import { PdfService } from '../../services/PdfService';
import { TitleProfessionalType, CandidateStatus } from '../../types/candidate.types';
import { logger } from '../../external/logger';
import { UserService } from '../../services/UserService';
import { GoogleDriveService, extractDriveFileId } from '../../external/google/drive.service';
import pdfParse from 'pdf-parse';
import { OllamaService } from '../../external/ollama/ollama.service';
import { CandidateAvatarModel } from '../../db/mongo/schemas/candidate.schema';
import { driveParentFolderForTp } from '../../external/google/drive.folders';
import { file } from 'pdfkit';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Le mimetype multipart vient du client : le type réel se déduit des nombres magiques.
// SVG est exclu volontairement — seul format « image » capable d'exécuter du script.
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const IMAGE_SIGNATURES: { mime: string; matches: (bytes: Buffer) => boolean }[] = [
    { mime: 'image/jpeg', matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
    { mime: 'image/png', matches: (b) => b.subarray(0, 8).equals(PNG_SIGNATURE) },
    {
        mime: 'image/webp',
        matches: (b) => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP',
    },
];

const SERVABLE_IMAGE_MIMES = new Set(IMAGE_SIGNATURES.map((signature) => signature.mime));

function detectImageMime(bytes: Buffer): string | null {
    return IMAGE_SIGNATURES.find((signature) => signature.matches(bytes))?.mime ?? null;
}

export const router: Router = express.Router();

const candidateService = new CandidateService();
const candidateRepository = new CandidateRepository();
const userService = new UserService();

function normalizeName(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

// PDF de l'Analyse du Besoin (tous les éléments AB), en téléchargement
router.get('/:id/pdf', authenticate, async (req: AuthRequest, res: Response) => {
    const role = req.user?.role;
    const permission = req.user?.permission;
    if (role !== JobRole.RH && permission !== Permission.RESPONSABLE && permission !== Permission.ADMIN) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }

    const { id } = req.params;
    try {
        const candidate = await candidateService.findById(id);
        if (!candidate) {
            res.status(404).json({ error: 'Candidate not found' });
            return;
        }

        const pdfBuffer = await PdfService.generateCandidatePdf(candidate);
        const safeName = candidate.identity.full_name.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="AB_${safeName || 'candidat'}.pdf"`);
        res.send(pdfBuffer);
    } catch (err) {
        logger.error({ err }, 'candidate AB PDF generation failed');
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});

// Génère le résumé AB et l'enregistre dans le dossier Drive du candidat
// (remplace l'AB précédent du même nom → pas de doublon). Appelé à la
// validation de l'AB pour éviter le download + import manuel.
router.post('/:id/ab-to-drive', authenticate, async (req: AuthRequest, res: Response) => {
    const role = req.user?.role;
    const permission = req.user?.permission;
    if (role !== JobRole.RH && permission !== Permission.RESPONSABLE && permission !== Permission.ADMIN) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }

    const { id } = req.params;
    try {
        const candidate = await candidateService.findById(id);
        if (!candidate) {
            res.status(404).json({ error: 'Candidate not found' });
            return;
        }
        if (!candidate.drive_folder_id) {
            res.status(400).json({ error: 'Candidate has no Drive folder' });
            return;
        }

        const user = await userService.findById(req.user!.id);
        if (!user || !user.oauthToken) {
            res.status(400).json({ error: 'Google Drive non connecté pour cet utilisateur' });
            return;
        }

        const driveService = GoogleDriveService.fromTokens(
            { access_token: user.oauthToken, refresh_token: user.refreshToken ?? undefined },
            userService.googleTokenPersister(user.id),
        );

        const pdfBuffer = await PdfService.generateCandidatePdf(candidate);
        const safeName = candidate.identity.full_name.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '');
        const fileName = `AB_${safeName || 'candidat'}.pdf`;

        // Supprime l'AB existant (même nom) avant de réuploader → idempotent.
        const existing = await driveService.listFolderFiles(candidate.drive_folder_id);
        await Promise.all(existing.filter((f) => f.name === fileName).map((f) => driveService.deleteFile(f.id)));

        const { webViewLink } = await driveService.uploadFile(
            fileName,
            'application/pdf',
            pdfBuffer,
            candidate.drive_folder_id,
        );

        await candidateService.update(id, { pdf_link: webViewLink });

        res.json({ fileLink: webViewLink });
    } catch (err) {
        logger.error({ err }, 'AB to Drive failed');
        res.status(500).json({ error: 'Internal error' });
    }
});

const CV_MIME_EXT: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
};

router.post(
    '/:id/cv',
    express.raw({ type: Object.keys(CV_MIME_EXT), limit: '20mb' }),
    authenticate,
    async (req: AuthRequest, res: Response) => {
        const role = req.user?.role;
        const permission = req.user?.permission;
        if (role !== JobRole.RH && permission !== Permission.RESPONSABLE && permission !== Permission.ADMIN) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }

        const { id } = req.params;
        const fileBuffer = req.body as Buffer;
        const mimeType = (req.headers['content-type'] ?? '').split(';')[0].trim();
        const ext = CV_MIME_EXT[mimeType];

        if (!ext) {
            res.status(400).json({ error: 'Type de fichier non supporté (PDF ou image)' });
            return;
        }

        if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
            res.status(400).json({ error: 'File body required' });
            return;
        }

        try {
            const candidate = await candidateService.findById(id);
            if (!candidate) {
                res.status(404).json({ error: 'Candidate not found' });
                return;
            }
            if (!candidate.drive_folder_id) {
                res.status(400).json({ error: 'Candidate has no Drive folder. Create it first.' });
                return;
            }

            const user = await userService.findById(req.user!.id);
            if (!user || !user.oauthToken) {
                res.status(400).json({ error: 'Google Drive non connecté pour cet utilisateur' });
                return;
            }

            const driveService = GoogleDriveService.fromTokens(
                { access_token: user.oauthToken, refresh_token: user.refreshToken ?? undefined },
                userService.googleTokenPersister(user.id),
            );

            const fileName = `CV_${candidate.identity.full_name}.${ext}`;
            const { webViewLink: fileLink } = await driveService.uploadFile(
                fileName,
                mimeType,
                fileBuffer,
                candidate.drive_folder_id,
            );

            await candidateService.update(id, { cv_link: fileLink });

            res.json({ fileLink });
        } catch (err) {
            logger.error(err, 'upload CV to Drive failed');
            res.status(500).json({ error: 'Internal error' });
        }
    },
);

router.get('/:id/cv-file', authenticate, async (req: AuthRequest, res: Response) => {
    const role = req.user?.role;
    const permission = req.user?.permission;
    if (role !== JobRole.RH && permission !== Permission.RESPONSABLE && permission !== Permission.ADMIN) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }

    const { id } = req.params;

    try {
        const candidate = await candidateService.findById(id);
        if (!candidate) {
            res.status(404).json({ error: 'Candidate not found' });
            return;
        }
        if (!candidate.cv_link) {
            res.status(404).json({ error: 'CV introuvable' });
            return;
        }

        const fileId = extractDriveFileId(candidate.cv_link);
        if (!fileId) {
            res.status(404).json({ error: 'CV introuvable' });
            return;
        }

        const user = await userService.findById(req.user!.id);
        if (!user || !user.oauthToken) {
            res.status(400).json({ error: 'Google Drive non connecté' });
            return;
        }

        const driveService = GoogleDriveService.fromTokens(
            { access_token: user.oauthToken, refresh_token: user.refreshToken ?? undefined },
            userService.googleTokenPersister(user.id),
        );

        const { buffer, mimeType } = await driveService.downloadFile(fileId);

        res.json({
            filename: `CV_${candidate.identity.full_name}.pdf`,
            contentType: mimeType,
            content: buffer.toString('base64'),
        });
    } catch (err) {
        logger.error(err, 'download candidate CV failed');
        res.status(500).json({ error: 'Internal error' });
    }
});

router.get('/:id/drive-files', authenticate, async (req: AuthRequest, res: Response) => {
    const role = req.user?.role;
    const permission = req.user?.permission;
    if (role !== JobRole.RH && permission !== Permission.RESPONSABLE && permission !== Permission.ADMIN) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }

    const { id } = req.params;

    try {
        const candidate = await candidateService.findById(id);
        if (!candidate) {
            res.status(404).json({ error: 'Candidate not found' });
            return;
        }
        if (!candidate.drive_folder_id) {
            res.json({ files: [] });
            return;
        }

        const user = await userService.findById(req.user!.id);
        if (!user || !user.oauthToken) {
            res.status(400).json({ error: 'Google Drive non connecté' });
            return;
        }

        const driveService = GoogleDriveService.fromTokens(
            { access_token: user.oauthToken, refresh_token: user.refreshToken ?? undefined },
            userService.googleTokenPersister(user.id),
        );

        const files = await driveService.listFolderFiles(candidate.drive_folder_id);
        res.json({ files });

        // Best-effort, hors chemin de réponse : si aucune photo n'est réellement
        // stockée (avatar_updated_at peut mentir sur des fiches legacy sans bytes
        // en base), on cherche un fichier "Photo_*" dans le dossier Drive et on
        // le met en cache comme avatar.
        const hasStoredAvatar = await CandidateAvatarModel.exists({ candidate_id: id });
        if (!hasStoredAvatar && !candidate.identity.drive_avatar_file_id) {
            const photoFile = files.find((f) => f.mimeType.startsWith('image/') && /^photo_/i.test(f.name));
            if (photoFile) {
                try {
                    const { buffer, mimeType } = await driveService.downloadFile(photoFile.id);
                    await CandidateAvatarModel.findOneAndUpdate(
                        { candidate_id: id },
                        { candidate_id: id, data: buffer, content_type: mimeType, updated_at: new Date() },
                        { upsert: true, new: true },
                    );
                    await candidateService.update(id, { identity: { drive_avatar_file_id: photoFile.id } } as never);
                } catch (syncErr) {
                    logger.warn(syncErr, 'drive avatar sync failed (non-blocking)');
                }
            }
        }
    } catch (err) {
        logger.error(err, 'list drive folder files failed');
        res.status(500).json({ error: 'Internal error' });
    }
});

// Proxy le contenu brut d'un fichier Drive via le token OAuth serveur.
// Évite l'embed drive.google.com (qui exige la session Google dans l'iframe,
// bloquée par le blocage des cookies tiers → "Connectez-vous à votre compte Google").
router.get('/:id/drive-files/:fileId/content', authenticate, async (req: AuthRequest, res: Response) => {
    const role = req.user?.role;
    const permission = req.user?.permission;
    if (role !== JobRole.RH && permission !== Permission.RESPONSABLE && permission !== Permission.ADMIN) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }

    const { id, fileId } = req.params;

    try {
        const candidate = await candidateService.findById(id);
        if (!candidate) {
            res.status(404).json({ error: 'Candidate not found' });
            return;
        }

        const user = await userService.findById(req.user!.id);
        if (!user || !user.oauthToken) {
            res.status(400).json({ error: 'Google Drive non connecté' });
            return;
        }

        const driveService = GoogleDriveService.fromTokens(
            { access_token: user.oauthToken, refresh_token: user.refreshToken ?? undefined },
            userService.googleTokenPersister(user.id),
        );

        const meta = await driveService.getFileMeta(fileId);
        // Google Docs natifs : export PDF direct.
        // Office/OpenDocument : conversion Drive → PDF. Sinon : téléchargement binaire brut.
        let buffer: Buffer;
        let mimeType: string;
        if (meta.mimeType?.startsWith('application/vnd.google-apps.')) {
            ({ buffer, mimeType } = await driveService.exportFile(fileId, 'application/pdf'));
        } else if (meta.mimeType && GoogleDriveService.isConvertibleToPdf(meta.mimeType)) {
            ({ buffer, mimeType } = await driveService.convertToPdf(fileId, meta.mimeType));
        } else {
            ({ buffer, mimeType } = await driveService.downloadFile(fileId));
        }

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(meta.name || fileId)}"`);
        res.setHeader('Cache-Control', 'private, max-age=60');
        res.send(buffer);
    } catch (err) {
        logger.error(err, 'proxy drive file content failed');
        res.status(500).json({ error: 'Internal error' });
    }
});

router.delete('/:id/drive-files/:fileId', authenticate, async (req: AuthRequest, res: Response) => {
    const role = req.user?.role;
    const permission = req.user?.permission;
    if (role !== JobRole.RH && permission !== Permission.RESPONSABLE && permission !== Permission.ADMIN) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }

    const { id, fileId } = req.params;

    try {
        const candidate = await candidateService.findById(id);
        if (!candidate) {
            res.status(404).json({ error: 'Candidate not found' });
            return;
        }

        const user = await userService.findById(req.user!.id);
        if (!user || !user.oauthToken) {
            res.status(400).json({ error: 'Google Drive non connecté' });
            return;
        }

        const driveService = GoogleDriveService.fromTokens(
            { access_token: user.oauthToken, refresh_token: user.refreshToken ?? undefined },
            userService.googleTokenPersister(user.id),
        );

        const deletedFile = candidate.drive_folder_id
            ? (await driveService.listFolderFiles(candidate.drive_folder_id)).find((f) => f.id === fileId)
            : undefined;

        await driveService.deleteFile(fileId);

        if (deletedFile && deletedFile.webViewLink === candidate.cv_link) {
            await candidateService.update(id, { cv_link: '' });
        }

        res.json({ deleted: fileId });
    } catch (err) {
        logger.error(err, 'delete drive file failed');
        res.status(500).json({ error: 'Internal error' });
    }
});

router.post('/:id/drive-upload', authenticate, upload.array('files', 20), async (req: AuthRequest, res: Response) => {
    const role = req.user?.role;
    const permission = req.user?.permission;
    if (role !== JobRole.RH && permission !== Permission.RESPONSABLE && permission !== Permission.ADMIN) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }

    const { id } = req.params;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
        res.status(400).json({ error: 'No files provided' });
        return;
    }

    try {
        const candidate = await candidateService.findById(id);
        if (!candidate) {
            res.status(404).json({ error: 'Candidate not found' });
            return;
        }
        if (!candidate.drive_folder_id) {
            res.status(400).json({ error: 'Candidate has no Drive folder' });
            return;
        }

        const user = await userService.findById(req.user!.id);
        if (!user || !user.oauthToken) {
            res.status(400).json({ error: 'Google Drive non connecté' });
            return;
        }

        const driveService = GoogleDriveService.fromTokens(
            { access_token: user.oauthToken, refresh_token: user.refreshToken ?? undefined },
            userService.googleTokenPersister(user.id),
        );

        const uploaded = await Promise.all(
            files.map((f) => driveService.uploadFile(f.originalname, f.mimetype, f.buffer, candidate.drive_folder_id!)),
        );

        res.json({ uploaded });
    } catch (err) {
        logger.error(err, 'drive-upload failed');
        res.status(500).json({ error: 'Internal error' });
    }
});

// Upload candidate avatar (webcam capture). Stores bytes in Mongo for serving,
// and archives original to the candidate's Drive folder when available.
router.post('/:id/avatar', authenticate, upload.single('photo'), async (req: AuthRequest, res: Response) => {
    const role = req.user?.role;
    const permission = req.user?.permission;
    if (role !== JobRole.RH && permission !== Permission.RESPONSABLE && permission !== Permission.ADMIN) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }

    const { id } = req.params;
    const file = req.file;

    if (!file || file.size === 0) {
        res.status(400).json({ error: 'No photo provided' });
        return;
    }
    const detectedMime = detectImageMime(file.buffer);
    if (!detectedMime) {
        res.status(400).json({ error: 'File must be a JPEG, PNG or WebP image' });
        return;
    }

    try {
        const candidate = await candidateService.findById(id);
        if (!candidate) {
            res.status(404).json({ error: 'Candidate not found' });
            return;
        }

        const now = new Date();

        await CandidateAvatarModel.findOneAndUpdate(
            { candidate_id: id },
            { candidate_id: id, data: file.buffer, content_type: detectedMime, updated_at: now },
            { upsert: true, new: true },
        );

        // Archive to Drive: create the candidate folder if missing, upload the photo
        // into it, and persist both the folder link and the photo link on the profile.
        // Best-effort — failure here must not break avatar saving.
        const driveUpdate: Record<string, unknown> = {};
        try {
            const user = await userService.findById(req.user!.id);
            if (user?.oauthToken) {
                const driveService = GoogleDriveService.fromTokens(
                    { access_token: user.oauthToken, refresh_token: user.refreshToken ?? undefined },
                    userService.googleTokenPersister(user.id),
                );

                let folderId = candidate.drive_folder_id;
                if (!folderId) {
                    const folderName = `${candidate.identity.full_name} - ${id.substring(0, 8)}`;
                    const folder = await driveService.createFolder(
                        folderName,
                        await driveParentFolderForTp(candidate.tp_type, candidate.training_site),
                    );
                    folderId = folder.id;
                    driveUpdate.drive_folder_id = folder.id;
                    driveUpdate.drive_folder_link = folder.webViewLink;
                }

                const ext = file.mimetype.split('/')[1] ?? 'jpg';
                const fileName = `Photo_${candidate.identity.full_name}.${ext}`;
                const { webViewLink: photoLink } = await driveService.uploadFile(
                    fileName,
                    file.mimetype,
                    file.buffer,
                    folderId,
                );
                driveUpdate.photo_link = photoLink;
            }
        } catch (driveErr) {
            logger.warn(driveErr, 'avatar Drive archive failed (avatar still saved)');
        }

        await candidateService.update(id, { identity: { avatar_updated_at: now }, ...driveUpdate } as never);

        res.json({ avatarUpdatedAt: now.toISOString() });
    } catch (err) {
        logger.error(err, 'upload avatar failed');
        res.status(500).json({ error: 'Internal error' });
    }
});

// Authed: serve candidate avatar with a Google Drive fallback. On a Mongo cache
// miss it locates the candidate's photo in their Drive folder (imported "Photo_*"
// files never pass through the webcam upload path), downloads it via the caller's
// OAuth token, caches it in Mongo, then serves. RH-only because it needs a token.
router.get('/:id/avatar-file', authenticate, async (req: AuthRequest, res: Response) => {
    const role = req.user?.role;
    const permission = req.user?.permission;
    if (role !== JobRole.RH && permission !== Permission.RESPONSABLE && permission !== Permission.ADMIN) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }

    const { id } = req.params;
    try {
        const cached = await CandidateAvatarModel.findOne({ candidate_id: id }).lean();
        if (cached) {
            const raw = cached.data as unknown as { buffer?: Buffer };
            const buf = Buffer.isBuffer(cached.data) ? cached.data : Buffer.from(raw.buffer ?? (cached.data as never));
            res.setHeader('Content-Type', cached.content_type);
            res.setHeader('Content-Length', buf.length);
            res.setHeader('Cache-Control', 'private, max-age=3600');
            res.end(buf);
            return;
        }

        const candidate = await candidateService.findById(id);
        if (!candidate) {
            res.status(404).end();
            return;
        }

        const user = await userService.findById(req.user!.id);
        if (!user?.oauthToken) {
            res.status(404).end();
            return;
        }

        const driveService = GoogleDriveService.fromTokens(
            { access_token: user.oauthToken, refresh_token: user.refreshToken ?? undefined },
            userService.googleTokenPersister(user.id),
        );

        // Locate the photo: explicit avatar file id first, else a "Photo_*" image in
        // the folder, else any image in the folder.
        let fileId = candidate.identity.drive_avatar_file_id;
        if (!fileId && candidate.drive_folder_id) {
            const files = await driveService.listFolderFiles(candidate.drive_folder_id);
            const photoFile =
                files.find((f) => f.mimeType.startsWith('image/') && /^photo_/i.test(f.name)) ??
                files.find((f) => f.mimeType.startsWith('image/'));
            fileId = photoFile?.id;
        }
        if (!fileId) {
            res.status(404).end();
            return;
        }

        const { buffer, mimeType } = await driveService.downloadFile(fileId);

        // Cache for future requests (incl. the public route) — best-effort.
        try {
            const now = new Date();
            await CandidateAvatarModel.findOneAndUpdate(
                { candidate_id: id },
                { candidate_id: id, data: buffer, content_type: mimeType, updated_at: now },
                { upsert: true },
            );
            await candidateService.update(id, {
                identity: { avatar_updated_at: now, drive_avatar_file_id: fileId },
            } as never);
        } catch (cacheErr) {
            logger.warn(cacheErr, 'avatar cache write failed (non-blocking)');
        }

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'private, max-age=3600');
        res.end(buffer);
    } catch (err) {
        logger.error(err, 'serve avatar-file failed');
        res.status(500).end();
    }
});

// Public: serve candidate avatar as an <img> source (no auth so it can be hot-linked).
router.get('/:id/avatar', async (req, res: Response) => {
    try {
        const avatar = await CandidateAvatarModel.findOne({ candidate_id: req.params.id }).lean();
        if (!avatar) {
            res.status(404).end();
            return;
        }
        // .lean() yields a BSON Binary, not a Node Buffer — coerce so Express sends raw bytes.
        const raw = avatar.data as unknown as { buffer?: Buffer };
        const buf = Buffer.isBuffer(avatar.data) ? avatar.data : Buffer.from(raw.buffer ?? (avatar.data as never));
        // Les avatars stockés avant la validation par signature portent un type client.
        res.setHeader(
            'Content-Type',
            SERVABLE_IMAGE_MIMES.has(avatar.content_type) ? avatar.content_type : 'application/octet-stream',
        );
        res.setHeader('Content-Length', buf.length);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.end(buf);
    } catch (err) {
        logger.error(err, 'serve avatar failed');
        res.status(500).end();
    }
});

router.post('/:id/generate-summary', authenticate, async (req: AuthRequest, res: Response) => {
    const role = req.user?.role;
    const permission = req.user?.permission;
    if (role !== JobRole.RH && permission !== Permission.RESPONSABLE && permission !== Permission.ADMIN) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }

    const { id } = req.params;
    try {
        const candidate = await candidateService.findById(id);
        if (!candidate) {
            res.status(404).json({ error: 'Candidate not found' });
            return;
        }

        const ollama = new OllamaService();

        const parts: string[] = [];
        const i = candidate.identity;
        if (i.full_name) parts.push(`Nom : ${i.full_name}`);
        if (i.age) parts.push(`Âge : ${i.age} ans`);
        if (i.city) parts.push(`Ville : ${i.city}`);
        if (i.driving_license_b) parts.push('Permis B : oui');
        if (i.has_vehicle) parts.push('Véhicule : oui');

        const tps = (candidate.tp_types?.length ? candidate.tp_types : candidate.tp_type ? [candidate.tp_type] : []).join(', ');
        if (tps) parts.push(`Titres visés : ${tps}`);

        if (candidate.education?.school_level) parts.push(`Niveau d'études : ${candidate.education.school_level}`);

        const b = candidate.background;
        if (b?.last_diploma) parts.push(`Dernier diplôme : ${b.last_diploma}`);
        if (b?.last_diploma_prepared) parts.push(`Diplôme préparé : ${b.last_diploma_prepared}`);
        if (b?.previous_trainings) parts.push(`Formations : ${b.previous_trainings}`);
        if (b?.professional_experiences?.length) {
            for (const exp of b.professional_experiences) {
                const ex = [exp.position, exp.company, exp.duration, exp.responsibilities].filter(Boolean).join(' - ');
                if (ex) parts.push(`Expérience : ${ex}`);
            }
        }

        const p = candidate.profile;
        if (p?.qualities?.length) parts.push(`Qualités : ${p.qualities.join(', ')}`);
        if (p?.hobbies) parts.push(`Centres d'intérêt : ${p.hobbies}`);
        if (p?.digital_skills?.length) parts.push(`Compétences numériques : ${p.digital_skills.join(', ')}`);

        const pp = candidate.professional_projects;
        if (pp?.career_objectives) parts.push(`Objectif : ${pp.career_objectives}`);
        if (pp?.apprenticeship_motivation) parts.push(`Motivation : ${pp.apprenticeship_motivation}`);

        const j = candidate.job_info;
        if (j?.availability_date) parts.push(`Disponible le : ${new Date(j.availability_date).toLocaleDateString('fr-FR')}`);
        if (j?.geographic_mobility?.length) {
            const mob = j.geographic_mobility.join(', ');
            parts.push(`Mobilité : ${mob}`);
        }

        // Tentative de récupération du texte du CV depuis Google Drive
        let cvText: string | null = null;
        if (candidate.cv_link) {
            const fileId = extractDriveFileId(candidate.cv_link);
            if (fileId) {
                try {
                    const user = await userService.findById(req.user!.id);
                    if (user?.oauthToken) {
                        const driveService = GoogleDriveService.fromTokens(
                            { access_token: user.oauthToken, refresh_token: user.refreshToken ?? undefined },
                            userService.googleTokenPersister(user.id),
                        );
                        const meta = await driveService.getFileMeta(fileId);
                        // PDF uniquement (les CV importés sont en PDF)
                        if (meta.mimeType === 'application/pdf') {
                            const { buffer } = await driveService.downloadFile(fileId);
                            const parsed = await pdfParse(buffer);
                            cvText = parsed.text?.trim() || null;
                        }
                    }
                } catch (cvErr) {
                    logger.warn({ err: cvErr }, 'CV extraction skipped (non-blocking)');
                }
            }
        }

        const prompt = parts.join('\n') + (cvText ? `\n\n--- CONTENU DU CV ---\n${cvText}` : '');
        const systemRole = `You are an HR and recruitment assistant.

Your task is to generate a professional summary of a candidate based exclusively on the information provided, including profile fields and the extracted contents of their resume/CV.

Requirements:
- Write in French.
- Write in the third person.
- Target the summary toward recruiters and companies.
- Highlight the candidate's skills, experience, strengths, technologies, achievements, and professional value.
- Make the summary compelling while remaining factual. Never invent, infer, or exaggerate information.
- Use only professionally relevant information. Ignore personal details unless they directly relate to the candidate's professional profile.
- Keep the summary concise (approximately 100-200 words).
- Return only the summary text, without titles, bullet points, comments, or explanations.

If the available information is insufficient, generate the best possible summary using only the provided professional data without mentioning missing information.`;

        const summary = await ollama.chat(prompt, systemRole, 'qwen2.5:3b');

        if (!summary) {
            res.status(500).json({ error: "Le service IA n'a pas pu générer de résumé." });
            return;
        }

        res.json({ summary });
    } catch (err) {
        logger.error({ err }, 'generate-summary failed');
        res.status(500).json({ error: 'Internal error' });
    }
});

router.post('/quick-create', express.json(), authenticate, async (req: AuthRequest, res: Response) => {
    const role = req.user?.role;
    const permission = req.user?.permission;
    if (role !== JobRole.RH && permission !== Permission.RESPONSABLE && permission !== Permission.ADMIN) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }

    const { first_name, last_name, tp_type } = req.body ?? {};
    if (!first_name?.trim() || !last_name?.trim()) {
        res.status(400).json({ error: 'first_name and last_name are required' });
        return;
    }
    if (!Object.values(TitleProfessionalType).includes(tp_type)) {
        res.status(400).json({ error: 'Invalid tp_type' });
        return;
    }
    const fullName = `${first_name.trim()} ${last_name.trim()}`;
    const normalized = normalizeName(fullName);

    try {
        const existing = await candidateRepository.findAll();
        const match = existing.find((c) => normalizeName(c.identity?.full_name ?? '') === normalized);
        if (match) {
            res.json({ id: match._id, already_exists: true, full_name: match.identity.full_name });
            return;
        }

        const id = randomUUID();
        const created = await candidateService.create({
            _id: id,
            candidate_id: id,
            tp_type,
            status: CandidateStatus.SEEKING,
            identity: {
                full_name: fullName,
                email: '',
                phone: '',
            },
        });

        res.status(201).json({ id: created._id, already_exists: false, full_name: created.identity.full_name });
    } catch (err) {
        logger.error(err, 'quick-create candidate failed');
        res.status(500).json({ error: 'Internal error' });
    }
});

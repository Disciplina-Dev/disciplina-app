import express, { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import multer from 'multer';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Role } from '../../types/user.types';
import { CandidateService } from '../../services/CandidateService';
import { CandidateRepository } from '../../repositories/mongo/CandidateRepository';
import { PdfService } from '../../services/PdfService';
import { TitleProfessionalType, CandidateStatus } from '../../types/candidate.types';
import { logger } from '../../external/logger/logger';
import { UserService } from '../../services/UserService';
import { GoogleDriveService, extractDriveFileId } from '../../external/google/drive.service';
import { GoogleTokens } from '../../external/google/types';
import { CandidateAvatarModel } from '../../db/mongo/schemas/candidate.schema';
import { driveParentFolderForTp } from '../../external/google/drive.folders';
import { file } from 'pdfkit';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

export const router: Router = express.Router();

const candidateService = new CandidateService();
const candidateRepository = new CandidateRepository();
const userService = new UserService();

const persistRefreshedTokens = (userId: number) => (refreshed: GoogleTokens) =>
    userService.updateGoogleTokens(userId, refreshed.access_token ?? null, refreshed.refresh_token ?? null);

function normalizeName(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

// PDF de l'Analyse du Besoin (tous les éléments AB), en téléchargement
router.get('/:id/pdf', authenticate, async (req: AuthRequest, res: Response) => {
    const role = req.user?.role;
    if (role !== Role.RH && role !== Role.RESPONSABLE && role !== Role.ADMIN) {
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
    if (role !== Role.RH && role !== Role.RESPONSABLE && role !== Role.ADMIN) {
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
            persistRefreshedTokens(user.id),
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
        if (role !== Role.RH && role !== Role.RESPONSABLE && role !== Role.ADMIN) {
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
                persistRefreshedTokens(user.id),
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
    if (role !== Role.RH && role !== Role.RESPONSABLE && role !== Role.ADMIN) {
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
            persistRefreshedTokens(user.id),
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
    if (role !== Role.RH && role !== Role.RESPONSABLE && role !== Role.ADMIN) {
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
            persistRefreshedTokens(user.id),
        );

        const files = await driveService.listFolderFiles(candidate.drive_folder_id);
        res.json({ files });
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
    if (role !== Role.RH && role !== Role.RESPONSABLE && role !== Role.ADMIN) {
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
            persistRefreshedTokens(user.id),
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
    if (role !== Role.RH && role !== Role.RESPONSABLE && role !== Role.ADMIN) {
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
            persistRefreshedTokens(user.id),
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
    if (role !== Role.RH && role !== Role.RESPONSABLE && role !== Role.ADMIN) {
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
            persistRefreshedTokens(user.id),
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
    if (role !== Role.RH && role !== Role.RESPONSABLE && role !== Role.ADMIN) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }

    const { id } = req.params;
    const file = req.file;

    if (!file || file.size === 0) {
        res.status(400).json({ error: 'No photo provided' });
        return;
    }
    if (!file.mimetype.startsWith('image/')) {
        res.status(400).json({ error: 'File must be an image' });
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
            { candidate_id: id, data: file.buffer, content_type: file.mimetype, updated_at: now },
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
                    persistRefreshedTokens(user.id),
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
        res.setHeader('Content-Type', avatar.content_type);
        res.setHeader('Content-Length', buf.length);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.end(buf);
    } catch (err) {
        logger.error(err, 'serve avatar failed');
        res.status(500).end();
    }
});

router.post('/quick-create', express.json(), authenticate, async (req: AuthRequest, res: Response) => {
    const role = req.user?.role;
    if (role !== Role.RH && role !== Role.RESPONSABLE && role !== Role.ADMIN) {
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

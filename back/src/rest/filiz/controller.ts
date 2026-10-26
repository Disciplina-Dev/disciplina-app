import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { FilizService } from '../../external/filiz/filiz.service';
import { FilizFolderService } from '../../services/FilizFolderService';
import { env } from '../../config/env';
import { logger } from '../../external/logger';

const filizService = new FilizService();
const filizFolderService = new FilizFolderService();
// Création en cours par candidat : évite deux dossiers Filiz sur double clic / requêtes parallèles (instance unique).
const foldersInProgress = new Set<string>();

export async function getDegrees(_req: AuthRequest, res: Response): Promise<void> {
    try {
        const degrees = await filizService.getDegreesInfos();
        if (!degrees) {
            res.status(502).json({ error: 'Failed to fetch degrees from Filiz' });
            return;
        }
        res.json({ degrees });
    } catch (err) {
        logger.error({ err }, 'filiz getDegrees failed');
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function getClasses(req: AuthRequest, res: Response): Promise<void> {
    const degreeId = String(req.query.degreeId ?? '');
    if (!degreeId) {
        res.status(400).json({ error: 'degreeId query param is required' });
        return;
    }
    try {
        const classes = await filizService.getClassInfos(degreeId);
        if (!classes) {
            res.status(502).json({ error: 'Failed to fetch classes from Filiz' });
            return;
        }
        res.json({ classes });
    } catch (err) {
        logger.error({ err }, 'filiz getClasses failed');
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function createFolder(req: AuthRequest, res: Response): Promise<void> {
    if (!env.FILIZ_FOLDER_CREATION_ENABLED) {
        res.status(403).json({ error: 'Filiz folder creation is disabled' });
        return;
    }
    const { candidateId, classId, fileManagerFirstName, fileManagerLastName } = req.body ?? {};
    // L'email du gestionnaire vient du JWT, pas du body : il ne doit pas être falsifiable.
    const fileManagerEmail: unknown = req.user?.email;
    const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
    if (
        !isText(candidateId) ||
        !isText(classId) ||
        !isText(fileManagerFirstName) ||
        !isText(fileManagerLastName) ||
        !isText(fileManagerEmail)
    ) {
        res.status(400).json({
            error: 'candidateId, classId, fileManagerFirstName and fileManagerLastName are required (and an authenticated user email)',
        });
        return;
    }
    if (foldersInProgress.has(candidateId)) {
        res.status(409).json({ error: 'Filiz folder creation already in progress for this candidate' });
        return;
    }
    foldersInProgress.add(candidateId);
    try {
        const created = await filizFolderService.create(candidateId, classId, {
            firstName: fileManagerFirstName,
            lastName: fileManagerLastName,
            mailAddress: fileManagerEmail,
        });
        if (!created.ok) {
            res.status(created.status).json({
                error: created.error,
                ...(created.missing ? { missing: created.missing } : {}),
            });
            return;
        }
        res.json({ folderId: created.folderId, ...(created.step ? { step: created.step } : {}) });
    } catch (err) {
        logger.error({ err }, 'filiz createFolder failed');
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        foldersInProgress.delete(candidateId);
    }
}

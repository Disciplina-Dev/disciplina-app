import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { FilizService } from '../../external/filiz/filiz.service';
import { FilizFolderService } from '../../services/FilizFolderService';
import { FilizSyncService, toClassRef, toDegreeRef } from '../../services/FilizSyncService';
import { FilizReferenceRepository } from '../../repositories/mongo/FilizReferenceRepository';
import { env } from '../../config/env';
import { FilizClassRef, FilizDegreeRef } from '../../types/filizReference.types';
import { logger } from '../../external/logger';

const filizService = new FilizService();
const filizFolderService = new FilizFolderService();
const filizSyncService = new FilizSyncService();
const referenceRepository = new FilizReferenceRepository();
let syncInProgress = false;
// Création en cours par candidat : évite deux dossiers Filiz sur double clic / requêtes parallèles (instance unique).
const foldersInProgress = new Set<string>();

// Forme attendue par le front (identique à la réponse historique de Filiz).
const degreeView = (d: FilizDegreeRef) => ({
    degreeId: d._id,
    degreeType: d.degree_type,
    exactDegreeTitle: d.title,
    preparedTitleName: d.prepared_title,
});
const classView = (c: FilizClassRef) => ({
    degreeId: c.degree_id,
    classId: c._id,
    className: c.name,
    startDate: c.start_date ?? undefined,
    endDate: c.end_date ?? undefined,
});

export async function getDegrees(_req: AuthRequest, res: Response): Promise<void> {
    try {
        const stored = await referenceRepository.findDegrees();
        if (stored.length > 0) {
            res.json({ degrees: stored.map(degreeView) });
            return;
        }
        // Référentiel pas encore synchronisé : repli sur Filiz.
        const fetched = await filizService.getDegreesInfos();
        const degrees = fetched?.map((d) => degreeView(toDegreeRef(d)));
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
        const stored = await referenceRepository.findClassesByDegree(degreeId);
        if (stored.length > 0) {
            res.json({ classes: stored.map(classView) });
            return;
        }
        const fetched = await filizService.getClassInfos(degreeId);
        const classes = fetched?.map((c) => classView(toClassRef(c)));
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

export async function syncFolders(_req: AuthRequest, res: Response): Promise<void> {
    if (syncInProgress) {
        res.status(409).json({ error: 'Filiz sync already in progress' });
        return;
    }
    syncInProgress = true;
    try {
        const result = await filizSyncService.syncAll();
        if (!result) {
            res.status(502).json({ error: 'Failed to fetch folders from Filiz' });
            return;
        }
        res.json(result);
    } catch (err) {
        logger.error({ err }, 'filiz syncFolders failed');
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        syncInProgress = false;
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

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { FilizService } from '../../external/filiz/filiz.service';
import { CandidateService } from '../../services/CandidateService';
import { FilizFolderService } from '../../services/FilizFolderService';
import { FilizFolderRepository } from '../../repositories/mysql/FilizFolderRepository';
import { assertConsent, ConsentType } from '../../services/consentGuard';
import { logger } from '../../external/logger';

const filizService = new FilizService();
const candidateService = new CandidateService();
const filizFolderService = new FilizFolderService();
const filizFolderRepository = new FilizFolderRepository();
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
        const candidate = await candidateService.findById(candidateId);
        if (!candidate) {
            res.status(404).json({ error: `Candidate ${candidateId} not found` });
            return;
        }
        if (candidate.filiz_folder_id) {
            res.json({ folderId: candidate.filiz_folder_id });
            return;
        }
        const prepared = await filizFolderService.prepare(candidate, classId, {
            firstName: fileManagerFirstName,
            lastName: fileManagerLastName,
            mailAddress: fileManagerEmail,
        });
        if (!prepared.ok) {
            res.status(422).json({ error: prepared.error, ...(prepared.missing ? { missing: prepared.missing } : {}) });
            return;
        }
        assertConsent(candidate, [ConsentType.DATA_SHARING], { mode: 'warn' }); // TODO flip to 'block' after backfill window
        const folderId = await filizService.createFolder(prepared.payload);
        if (!folderId) {
            res.status(502).json({ error: 'Filiz folder creation failed' });
            return;
        }
        const updated = await candidateService.update(candidateId, { filiz_folder_id: folderId });
        if (!updated) {
            // Le dossier existe chez Filiz mais n'est pas rattaché : l'id est loggé pour rattrapage manuel.
            logger.error({ candidateId, folderId }, 'filiz folder created but candidate update failed');
            res.status(500).json({ error: 'Failed to update candidate' });
            return;
        }
        try {
            await filizFolderRepository.insert({
                folderId,
                candidateId,
                classId,
                startStep: prepared.step,
                companySiret: prepared.companySiret,
            });
        } catch (err) {
            // Le dossier et son rattachement existent : la ligne de suivi sera reconstruite par la sync.
            logger.error({ err, candidateId, folderId }, 'filiz folder created but filiz_folders insert failed');
        }
        res.json({ folderId, step: prepared.step });
    } catch (err) {
        logger.error({ err }, 'filiz createFolder failed');
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        foldersInProgress.delete(candidateId);
    }
}

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { FilizService } from '../../external/filiz/filiz.service';
import { CandidateService } from '../../services/CandidateService';
import { mapCandidateToFilizStudent } from '../../services/mappers/candidate.mapper';
import { logger } from '../../external/logger';

const filizService = new FilizService();
const candidateService = new CandidateService();

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
    const { candidateId, classId, fileManagerFirstName, fileManagerLastName, fileManagerEmail } = req.body ?? {};
    if (!candidateId || !classId || !fileManagerFirstName || !fileManagerLastName || !fileManagerEmail) {
        res.status(400).json({
            error: 'candidateId, classId, fileManagerFirstName, fileManagerLastName and fileManagerEmail are required',
        });
        return;
    }
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
        const folderId = await filizService.createFolder({
            studentInfos: mapCandidateToFilizStudent(candidate),
            fileManagerInfos: {
                firstName: fileManagerFirstName,
                lastName: fileManagerLastName,
                mailAddress: fileManagerEmail,
            },
            config: {
                folder: {
                    type: 'STUDY',
                    classId,
                    step: 2,
                    contractInformations: {
                        followUpModality: 1,
                        numberOfTrainingOrganizationsInvolved: '1',
                        remainsAtNilCharge: true,
                    },
                },
            },
        });
        if (!folderId) {
            res.status(502).json({ error: 'Filiz folder creation failed' });
            return;
        }
        const updated = await candidateService.update(candidateId, { filiz_folder_id: folderId });
        if (!updated) {
            res.status(500).json({ error: 'Failed to update candidate' });
            return;
        }
        res.json({ folderId });
    } catch (err) {
        logger.error({ err }, 'filiz createFolder failed');
        res.status(500).json({ error: 'Internal server error' });
    }
}

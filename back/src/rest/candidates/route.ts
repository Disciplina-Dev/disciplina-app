import express, { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Role } from '../../types/user.types';
import { CandidateService } from '../../services/CandidateService';
import { CandidateRepository } from '../../repositories/mongo/CandidateRepository';
import {
    TitleProfessionalType,
    CandidateStatus,
} from '../../types/candidate.types';
import { logger } from '../../external/logger/logger';
import { UserService } from '../../services/UserService';
import { GoogleDriveService } from '../../external/google/drive.service';
import { GoogleTokens } from '../../external/google/types';

export const router: Router = express.Router();

const candidateService = new CandidateService();
const candidateRepository = new CandidateRepository();
const userService = new UserService();

const persistRefreshedTokens = (userId: number) => (refreshed: GoogleTokens) =>
    userService.updateGoogleTokens(userId, refreshed.access_token ?? null, refreshed.refresh_token ?? null);


function normalizeName(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

router.post(
    '/:id/cv',
    express.raw({ type: 'application/pdf', limit: '20mb' }),
    authenticate,
    async (req: AuthRequest, res: Response) => {
        const role = req.user?.role;
        if (role !== Role.RH && role !== Role.ADMIN) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }

        const { id } = req.params;
        const pdfBuffer = req.body as Buffer;

        if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
            res.status(400).json({ error: 'PDF body required' });
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

            const fileName = `CV_${candidate.identity.full_name}.pdf`;
            const fileLink = await driveService.uploadFile(fileName, 'application/pdf', pdfBuffer, candidate.drive_folder_id);

            await candidateService.update(id, { cv_link: fileLink });

            res.json({ fileLink });
        } catch (err) {
            logger.error(err, 'upload CV to Drive failed');
            res.status(500).json({ error: 'Internal error' });
        }
    }
);

router.post(
    '/quick-create',
    express.json(),
    authenticate,
    async (req: AuthRequest, res: Response) => {
        const role = req.user?.role;
        if (role !== Role.RH && role !== Role.ADMIN) {
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
            const match = existing.find(c => normalizeName(c.identity?.full_name ?? '') === normalized);
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
    }
);

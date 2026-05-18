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

export const router: Router = express.Router();

const candidateService = new CandidateService();
const candidateRepository = new CandidateRepository();


function normalizeName(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

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

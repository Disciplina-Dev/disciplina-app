import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRoles } from '../middleware/roleGuard';
import { getYears, getReport } from './controller';

export const router: Router = Router();

const access = [authenticate, requireRoles('AD', 'GESTION', 'RH')];

router.get('/years', ...access, getYears);
router.get('/report', ...access, getReport);

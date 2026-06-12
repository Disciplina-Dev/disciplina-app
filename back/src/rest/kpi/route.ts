import express, { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { requireRoles } from '../middleware/roleGuard';
import { getYears, getAnnualSummary, getMonthlyDetail, getWeeklyDetail, upsertKpi, importExcel } from './controller';

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
});

const kpiAccess = [authenticate, requireRoles('ADMIN', 'RESPONSABLE')];

export const router: Router = Router();

router.get('/years', ...kpiAccess, getYears);
router.get('/summary', ...kpiAccess, getAnnualSummary);
router.get('/monthly', ...kpiAccess, getMonthlyDetail);
router.get('/weekly', ...kpiAccess, getWeeklyDetail);
router.post('/', express.json(), ...kpiAccess, upsertKpi);
router.post('/import', ...kpiAccess, upload.single('file'), importExcel);

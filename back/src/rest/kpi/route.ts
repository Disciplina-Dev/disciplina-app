import express, { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { requireRolesOrManager } from '../middleware/roleGuard';
import {
    getYears,
    getAnnualSummary,
    getMonthlyDetail,
    getWeeklyDetail,
    getOverview,
    getUserDetail,
    getLiveSnapshot,
    getActivity,
    getCombined,
    upsertKpi,
    importExcel,
    getSelectableUsers,
} from './controller';

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
});

// ADMIN/RESPONSABLE (toute permission de niveau manager, ex. RH responsable sur le
// dashboard commercial) voient tous les secteurs ; les autres passent par le rôle métier.
const kpiAccess = [authenticate, requireRolesOrManager('AD', 'GESTION')];
// Lecture scopée : un COMMERCIAL n'obtient que ses propres chiffres (contrôle dans le controller).
const kpiReadAccess = [authenticate, requireRolesOrManager('AD', 'GESTION', 'COMMERCIAL')];

export const router: Router = Router();

router.get('/users', ...kpiAccess, getSelectableUsers);
router.get('/years', ...kpiReadAccess, getYears);
router.get('/live', ...kpiReadAccess, getLiveSnapshot);
router.get('/activity', ...kpiReadAccess, getActivity);
router.get('/combined', ...kpiReadAccess, getCombined);
router.get('/overview', ...kpiAccess, getOverview);
router.get('/user/:id', ...kpiReadAccess, getUserDetail);
router.get('/summary', ...kpiAccess, getAnnualSummary);
router.get('/monthly', ...kpiAccess, getMonthlyDetail);
router.get('/weekly', ...kpiAccess, getWeeklyDetail);
router.post('/', express.json(), ...kpiAccess, upsertKpi);
router.post('/import', ...kpiAccess, upload.single('file'), importExcel);

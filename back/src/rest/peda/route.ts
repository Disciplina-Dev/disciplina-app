import express, { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRoles } from '../middleware/roleGuard';
import { getConfig, putSheet, deleteSheet, getDraftHour, putDraftHour, runNow } from './controller';

export const router: Router = Router();

const access = [authenticate, requireRoles('ADMIN', 'PEDA')];
const json = express.json({ limit: '256kb' });

// Sheet d'absences du Peda connecté
router.get('/config', ...access, getConfig);
router.put('/config/sheet', ...access, json, putSheet);
router.delete('/config/sheet', ...access, deleteSheet);

// Heure globale du job quotidien
router.get('/config/hour', ...access, getDraftHour);
router.put('/config/hour', ...access, json, putDraftHour);

// Déclenchement manuel du job (tous les Pedas)
router.post('/run', ...access, runNow);

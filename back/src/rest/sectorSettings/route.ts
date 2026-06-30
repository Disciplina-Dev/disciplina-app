import { Router } from 'express';
import express from 'express';
import { authenticate } from '../middleware/auth';
import { requireRoles } from '../middleware/roleGuard';
import { getSectorSettings, updateSectorSettings } from './controller';

export const router: Router = Router();

// Lecture : tout staff (le front pré-remplit le lieu de RDV depuis ces valeurs).
router.get('/', authenticate, requireRoles('ADMIN', 'RESPONSABLE', 'RH'), getSectorSettings);
// Écriture : admin uniquement.
router.put('/', authenticate, requireRoles('ADMIN'), express.json(), updateSectorSettings);

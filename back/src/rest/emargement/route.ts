import express, { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRoles } from '../middleware/roleGuard';
import { create, get, list, remove, resend, update } from './controller';

export const router: Router = express.Router();

// La signature manuscrite est une image PNG en data-URL : plafond dédié.
router.use(express.json({ limit: '3mb' }));

const access = [authenticate, requireRoles('AD', 'GESTION', 'PEDA')];

router.get('/seances', ...access, list);
router.post('/seances', ...access, create);
router.get('/seances/:id', ...access, get);
router.put('/seances/:id', ...access, update);
router.delete('/seances/:id', ...access, remove);
router.post('/seances/:id/resend', ...access, resend);

import express, { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRoles } from '../middleware/roleGuard';
import { addNote, create, get, list, update } from './controller';

export const router: Router = express.Router();

const access = [authenticate, requireRoles('AD', 'GESTION', 'PEDA')];
const json = express.json({ limit: '256kb' });

// Annuaire des formateurs du Peda : fiches, résumé d'activité et journal des
// saisies (notes du Peda comprises). Mêmes droits que le reste de l'espace.
router.get('/', ...access, list);
router.post('/', ...access, json, create);
router.get('/:id', ...access, get);
router.put('/:id', ...access, json, update);
router.post('/:id/notes', ...access, json, addNote);

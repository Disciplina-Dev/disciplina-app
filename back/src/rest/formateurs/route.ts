import express, { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRoles } from '../middleware/roleGuard';
import {
    addNote,
    create,
    createAccount,
    deleteAccount,
    get,
    list,
    remove,
    resetAccountPassword,
    update,
} from './controller';

export const router: Router = express.Router();

const access = [authenticate, requireRoles('AD', 'GESTION', 'PEDA')];
const json = express.json({ limit: '256kb' });

// Annuaire des formateurs du Peda : fiches, résumé d'activité, journal des
// saisies (notes du Peda comprises) et compte de connexion à l'espace formateur.
router.get('/', ...access, list);
router.post('/', ...access, json, create);
router.get('/:id', ...access, get);
router.put('/:id', ...access, json, update);
router.post('/:id/notes', ...access, json, addNote);
router.delete('/:id', ...access, remove);
// Compte de connexion : créé avec un mot de passe, réinitialisé, retiré.
router.post('/:id/account', ...access, json, createAccount);
router.put('/:id/account', ...access, json, resetAccountPassword);
router.delete('/:id/account', ...access, deleteAccount);

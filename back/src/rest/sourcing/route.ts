import express, { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
    checkSiret,
    companiesByMulticriteria,
    additionalSearch,
    searchBySiren,
    getCompletion,
    getDepartement,
} from './controller';

export const router: Router = express.Router();
router.post('/search', express.json(), authenticate, additionalSearch);
// Express 5 (path-to-regexp v8) ne supporte plus la syntaxe `:param(\d{n})` :
// le contrôle de format vit désormais dans les contrôleurs (404 si invalide).
router.get('/:siren', express.json(), authenticate, searchBySiren);
router.get('/:siret', express.json(), authenticate, checkSiret);
router.post('/multicriteria', express.json(), authenticate, companiesByMulticriteria);
router.get('/completion', authenticate, getCompletion);
router.get('/departement', authenticate, getDepartement);

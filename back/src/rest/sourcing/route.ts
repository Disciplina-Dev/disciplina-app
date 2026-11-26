import express, { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
    companiesByMulticriteria,
    additionalSearch,
    searchBySirenOrSiret,
    getCompletion,
    getDepartement,
} from './controller';

export const router: Router = express.Router();
router.post('/search', express.json(), authenticate, additionalSearch);
router.post('/multicriteria', express.json(), authenticate, companiesByMulticriteria);
router.get('/completion', authenticate, getCompletion);
router.get('/departement', authenticate, getDepartement);
// Express 5 (path-to-regexp v8) ne supporte plus la syntaxe `:param(\d{n})` :
// un seul paramètre `:sirenOrSiret` dispatche vers searchBySiren (9 chiffres)
// ou checkSiret (14 chiffres) dans le contrôleur (404 si invalide).
// Les routes statiques ci-dessus doivent rester AVANT celle-ci,
// sinon `/:sirenOrSiret` les intercepterait (`/completion`, `/departement` → 404).
router.get('/:sirenOrSiret', express.json(), authenticate, searchBySirenOrSiret);

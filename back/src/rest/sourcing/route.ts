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
router.get('/:siren(\\d{9})', express.json(), authenticate, searchBySiren);
router.get('/:siret(\\d{14})', express.json(), authenticate, checkSiret);
router.post('/multicriteria', express.json(), authenticate, companiesByMulticriteria);
router.get('/completion', authenticate, getCompletion);
router.get('/departement', authenticate, getDepartement);

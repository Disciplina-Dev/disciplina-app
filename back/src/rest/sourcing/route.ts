import express, { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { checkSiret, companiesByCommune, additionalSearch } from './controller';

export const router: Router = express.Router();
router.post('/search', express.json(), authenticate, additionalSearch);
router.get('/:siret(\\d{14})', express.json(), authenticate, checkSiret);
router.get('/:commune', express.json(), authenticate, companiesByCommune);

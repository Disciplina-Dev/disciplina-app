import express, { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { checkSiret, companiesByCommune } from './controller';

export const router: Router = express.Router();
router.get('/companies/:commune', express.json(), authenticate, companiesByCommune);
router.get('/:siret', express.json(), authenticate, checkSiret);

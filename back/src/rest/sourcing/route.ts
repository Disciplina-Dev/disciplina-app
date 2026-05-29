import express, { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { checkSiret, companiesByCommune } from './controller';

export const router: Router = express.Router();
router.get('/:siret(\\d{14})', express.json(), authenticate, checkSiret);
router.get('/:commune', express.json(), authenticate, companiesByCommune);

import express, { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { checkSiret } from './controller';

export const router: Router = express.Router();
router.get('/:siret', express.json(), authenticate, checkSiret);

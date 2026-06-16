import express, { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { downloadPdf, sendSignature } from './controller';

export const router: Router = express.Router();

router.get('/:id/pdf', authenticate, downloadPdf);
router.post('/:id/sign', authenticate, sendSignature);

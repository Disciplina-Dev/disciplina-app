import express, { Router } from 'express';
import { sendEmail, createDraft } from './controller';
import { authenticate } from '../middleware/auth';

export const router: Router = express.Router();

router.post('/api/email/send', express.json({ limit: '25mb' }), authenticate, sendEmail);
router.post('/api/email/draft', express.json({ limit: '25mb' }), authenticate, createDraft);

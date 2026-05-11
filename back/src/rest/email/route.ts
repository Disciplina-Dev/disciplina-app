import express, { Router } from 'express';
import { sendEmail } from './controller';

export const router: Router = express.Router();

router.post('/api/email/send', express.json({ limit: '25mb' }), sendEmail);

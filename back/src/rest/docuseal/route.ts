import express, { Router } from 'express';
import { handleDocusealWebhook } from './controller';

export const router: Router = Router();

// Webhook DocuSeal (signature terminée).
router.post('/api/webhooks/docuseal', express.json(), handleDocusealWebhook);

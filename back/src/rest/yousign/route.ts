import express, { Router } from 'express';
import { handleYousignWebhook } from './controller';

export const router: Router = Router();

// Webhook endpoint for Yousign callback notifications
router.post('/api/webhooks/yousign', express.json(), handleYousignWebhook);

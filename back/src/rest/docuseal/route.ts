import { Router } from 'express';
import { handleDocusealWebhook } from './controller';
import { docusealWebhookGuard } from '../middleware/webhookSignature';
import { env } from '../../config/env';

export const router: Router = Router();

router.post('/api/webhooks/docuseal', ...docusealWebhookGuard(env.DOCUSEAL_WEBHOOK_SECRET), handleDocusealWebhook);

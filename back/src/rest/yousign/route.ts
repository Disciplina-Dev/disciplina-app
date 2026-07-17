import { Router, Response } from 'express';
import { handleYousignWebhook } from './controller';
import { addClient, removeClient } from './sse';
import { yousignWebhookGuard } from '../middleware/webhookSignature';
import { authenticateStaffStream } from '../middleware/sseAuth';
import { AuthRequest } from '../middleware/auth';
import { env } from '../../config/env';

export const router: Router = Router();

router.post('/api/webhooks/yousign', ...yousignWebhookGuard(env.YOUSIGN_WEBHOOK_SECRET), handleYousignWebhook);

// SSE stream — identity comes from the token, never from the query
router.get('/api/webhooks/yousign/stream', (req: AuthRequest, res: Response) => {
    const staff = authenticateStaffStream(req, res);
    if (!staff) return;
    const userID = String(staff.id);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.write(': connected\n\n');

    addClient(userID, res);
    const heartbeat = setInterval(() => {
        try {
            res.write(': ping\n\n');
        } catch {
            /* ignore */
        }
    }, 30000);

    req.on('close', () => {
        clearInterval(heartbeat);
        removeClient(userID, res);
    });
});

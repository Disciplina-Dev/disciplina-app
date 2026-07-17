import express, { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRoles } from '../middleware/roleGuard';
import { authenticateStaffStream } from '../middleware/sseAuth';
import { listNotifications, markNotificationRead, markAllNotificationsRead, createNotification } from './controller';
import { addClient, removeClient } from './sse';

export const router: Router = Router();

// Liste des notifications de l'utilisateur courant + compteur non lus.
router.get('/', authenticate, listNotifications);

// Marquer une / toutes comme lue(s).
router.post('/read-all', authenticate, markAllNotificationsRead);
router.post('/:id/read', authenticate, markNotificationRead);

// Création manuelle (ADMIN) — test du système générique.
router.post('/', express.json(), authenticate, requireRoles('ADMIN'), createNotification);

// Flux SSE temps réel — l'identité vient du token, jamais de la query.
router.get('/stream', (req: AuthRequest, res: Response) => {
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

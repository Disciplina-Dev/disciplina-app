import express, { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRoles } from '../middleware/roleGuard';
import {
    listNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    createNotification,
} from './controller';
import { addClient, removeClient } from './sse';

export const router: Router = Router();

// Liste des notifications de l'utilisateur courant + compteur non lus.
router.get('/', authenticate, listNotifications);

// Marquer une / toutes comme lue(s).
router.post('/read-all', authenticate, markAllNotificationsRead);
router.post('/:id/read', authenticate, markNotificationRead);

// Création manuelle (ADMIN) — test du système générique.
router.post('/', express.json(), authenticate, requireRoles('ADMIN'), createNotification);

// Flux SSE temps réel — l'utilisateur s'abonne avec son userID.
router.get('/stream', (req: Request, res: Response) => {
    const userID = typeof req.query.userID === 'string' ? req.query.userID : '';
    if (!userID) {
        res.status(400).end();
        return;
    }

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

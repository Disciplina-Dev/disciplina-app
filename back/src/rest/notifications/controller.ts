import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { NotificationService } from '../../services/NotificationService';
import { notificationToDto } from '../../services/mappers/notification.mapper';
import { logger } from '../../external/logger';

const notificationService = new NotificationService();

export async function listNotifications(req: AuthRequest, res: Response): Promise<void> {
    try {
        const userId = Number(req.user.id);
        const [notifications, unreadCount] = await Promise.all([
            notificationService.listForUser(userId),
            notificationService.countUnread(userId),
        ]);
        res.status(200).json({ notifications: notifications.map(notificationToDto), unreadCount });
    } catch (error) {
        logger.error({ err: error }, 'Failed to list notifications');
        res.status(500).json({ error: 'Failed to list notifications' });
    }
}

export async function markNotificationRead(req: AuthRequest, res: Response): Promise<void> {
    try {
        const userId = Number(req.user.id);
        const ok = await notificationService.markRead(userId, req.params.id);
        if (!ok) {
            res.status(404).json({ error: 'Notification not found' });
            return;
        }
        res.status(200).json({ success: true });
    } catch (error) {
        logger.error({ err: error }, 'Failed to mark notification as read');
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
}

export async function markAllNotificationsRead(req: AuthRequest, res: Response): Promise<void> {
    try {
        const userId = Number(req.user.id);
        await notificationService.markAllRead(userId);
        res.status(200).json({ success: true });
    } catch (error) {
        logger.error({ err: error }, 'Failed to mark all notifications as read');
        res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
}

/**
 * Création manuelle d'une notification (réservé ADMIN) — utile pour tester le
 * système générique et démontrer son côté modulable.
 */
export async function createNotification(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { userId, type, title, level, message, link } = req.body ?? {};
        if (!userId || !type || !title) {
            res.status(400).json({ error: 'userId, type and title are required' });
            return;
        }
        const notification = await notificationService.create({
            userId: Number(userId),
            type,
            title,
            level,
            message,
            link,
        });
        res.status(201).json(notificationToDto(notification));
    } catch (error) {
        logger.error({ err: error }, 'Failed to create notification');
        res.status(500).json({ error: 'Failed to create notification' });
    }
}

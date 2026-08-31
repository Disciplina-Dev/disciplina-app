import { NotificationRepository } from '../repositories/mongo/NotificationRepository';
import { CreateNotificationInput, Notification } from '../types/notification.types';
import { notificationToDto } from './mappers/notification.mapper';
import { pushToUser } from '../rest/notifications/sse';

/**
 * Point d'entrée unique pour le système de notifications.
 *
 * N'importe quelle partie du code (RH, commercial, webhooks…) peut émettre une
 * notification via `create()`. Elle est persistée (cache éphémère 48h) puis
 * poussée en temps réel au destinataire via SSE.
 */
export class NotificationService {
    private repository = new NotificationRepository();

    async create(input: CreateNotificationInput): Promise<Notification> {
        const notification = await this.repository.create(input);
        pushToUser(input.userId, { event: 'notification', notification: notificationToDto(notification) });
        return notification;
    }

    async listForUser(userId: number, category?: string): Promise<Notification[]> {
        return this.repository.findForUser(userId, 50, category);
    }

    async countUnread(userId: number): Promise<number> {
        return this.repository.countUnread(userId);
    }

    async markRead(userId: number, id: string): Promise<boolean> {
        return this.repository.markRead(userId, id);
    }

    async markAllRead(userId: number): Promise<void> {
        await this.repository.markAllRead(userId);
    }
}

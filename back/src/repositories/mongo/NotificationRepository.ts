import { randomUUID } from 'crypto';
import { NotificationModel } from '../../db/mongo/schemas/notification.schema';
import { Notification, CreateNotificationInput } from '../../types/notification.types';

export class NotificationRepository {
    async create(input: CreateNotificationInput): Promise<Notification> {
        const doc = await NotificationModel.create({
            _id: randomUUID(),
            user_id: input.userId,
            type: input.type,
            level: input.level ?? 'info',
            title: input.title,
            message: input.message,
            link: input.link,
            read: false,
            created_at: new Date(),
        });
        return doc.toObject() as Notification;
    }

    async findForUser(userId: number, limit = 50): Promise<Notification[]> {
        return NotificationModel.find({ user_id: userId }).sort({ created_at: -1 }).limit(limit).lean();
    }

    async countUnread(userId: number): Promise<number> {
        return NotificationModel.countDocuments({ user_id: userId, read: false });
    }

    /** Marque une notification comme lue. Renvoie false si elle n'appartient pas à l'utilisateur. */
    async markRead(userId: number, id: string): Promise<boolean> {
        const result = await NotificationModel.updateOne({ _id: id, user_id: userId }, { $set: { read: true } });
        return result.matchedCount > 0;
    }

    async markAllRead(userId: number): Promise<void> {
        await NotificationModel.updateMany({ user_id: userId, read: false }, { $set: { read: true } });
    }
}

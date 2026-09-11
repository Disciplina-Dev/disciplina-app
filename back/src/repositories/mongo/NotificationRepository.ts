import { randomUUID } from 'crypto';
import { getModels } from '../../db/mongo/tenant';
import { Notification, CreateNotificationInput } from '../../types/notification.types';

export class NotificationRepository {
    async create(input: CreateNotificationInput): Promise<Notification> {
        const doc = await getModels().Notification.create({
            _id: randomUUID(),
            user_id: input.userId,
            type: input.type,
            category: input.category,
            level: input.level ?? 'info',
            title: input.title,
            message: input.message,
            link: input.link,
            read: false,
            created_at: new Date(),
        });
        return doc.toObject() as Notification;
    }

    async findForUser(userId: number, limit = 50, category?: string): Promise<Notification[]> {
        const filter: Record<string, unknown> = { user_id: userId };
        if (category) filter.category = category;
        return getModels().Notification.find(filter).sort({ created_at: -1 }).limit(limit).lean();
    }

    async countUnread(userId: number): Promise<number> {
        return getModels().Notification.countDocuments({ user_id: userId, read: false });
    }

    /** Marque une notification comme lue. Renvoie false si elle n'appartient pas à l'utilisateur. */
    async markRead(userId: number, id: string): Promise<boolean> {
        const result = await getModels().Notification.updateOne({ _id: id, user_id: userId }, { $set: { read: true } });
        return result.matchedCount > 0;
    }

    async markAllRead(userId: number): Promise<void> {
        await getModels().Notification.updateMany({ user_id: userId, read: false }, { $set: { read: true } });
    }

    /** Purge définitive des notifications d'un compte (soft-)supprimé. */
    async deleteAllForUser(userId: number): Promise<number> {
        return (await getModels().Notification.deleteMany({ user_id: userId })).deletedCount;
    }
}

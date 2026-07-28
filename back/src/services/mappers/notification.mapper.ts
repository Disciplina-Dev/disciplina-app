import { Notification } from '../../types/notification.types';

/** Notification (snake_case DB) → objet JSON camelCase pour le front. */
export function notificationToDto(n: Notification): object {
    return {
        id: n._id,
        type: n.type,
        category: n.category,
        level: n.level,
        title: n.title,
        message: n.message ?? null,
        link: n.link ?? null,
        read: n.read,
        createdAt: n.created_at instanceof Date ? n.created_at.toISOString() : n.created_at,
    };
}

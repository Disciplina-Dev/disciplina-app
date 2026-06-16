/**
 * Notifications génériques par utilisateur, stockées de façon éphémère
 * (supprimées automatiquement après 48h via un index TTL MongoDB).
 *
 * Le champ `type` est volontairement une chaîne libre : n'importe quelle partie
 * du code peut émettre un nouveau type sans modifier ce modèle.
 */
export type NotificationLevel = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
    _id: string;
    user_id: number;
    type: string;
    level: NotificationLevel;
    title: string;
    message?: string;
    /** Lien front optionnel vers lequel naviguer au clic. */
    link?: string;
    read: boolean;
    created_at: Date;
}

/** Données nécessaires pour émettre une notification. */
export interface CreateNotificationInput {
    userId: number;
    type: string;
    title: string;
    level?: NotificationLevel;
    message?: string;
    link?: string;
}

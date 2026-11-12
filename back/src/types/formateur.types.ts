/**
 * Référentiel des formateurs du Peda.
 *
 * Les séances gardent un snapshot `formateur_name` / `formateur_email` (la
 * feuille reste lisible si l'annuaire change) et pointent vers l'annuaire par
 * `formateur_id` quand la séance a été créée ou modifiée après l'ouverture de
 * cette section. Les séances plus anciennes restent rattachées par e-mail.
 */
export interface Formateur {
    _id: string;
    /** Nom affiché, tel que saisi par le Peda. */
    name: string;
    /** E-mail normalisé (minuscules, sans espaces) : clé de rattachement des séances. */
    email: string;
    phone: string | null;
    /** Commentaire libre du Peda (consignes, disponibilités…). */
    comment: string | null;
    /**
     * Compte `users` donnant accès à l'espace formateur (`JobRole.FORMATEUR`).
     * `null` = fiche sans accès : le formateur n'existe que comme contact.
     * Unicité vérifiée côté service (pas d'index unique : Mongo n'accepte qu'un
     * seul `null` par index unique non sparse).
     */
    user_id: number | null;
    created_by: number | null;
    created_at: Date | string;
    updated_at: Date | string;
}

/** Champs tracés dans le journal d'une fiche formateur. */
export const FORMATEUR_CHANGE_FIELDS = ['name', 'email', 'phone', 'comment'] as const;
export type FormateurChangeField = (typeof FORMATEUR_CHANGE_FIELDS)[number];

export interface FormateurChange {
    field: FormateurChangeField;
    from: string | null;
    to: string | null;
}

export const FORMATEUR_HISTORY_ACTIONS = [
    'formateur_created',
    'formateur_updated',
    'note',
    'formateur_deleted',
    'account_created',
    'account_password_reset',
    'account_deleted',
] as const;
export type FormateurHistoryAction = (typeof FORMATEUR_HISTORY_ACTIONS)[number];

/**
 * Journal append-only : création, modifications de champs et notes libres du
 * Peda. Une note n'est jamais modifiée ni supprimée.
 */
export interface FormateurHistoryEntry {
    _id: string;
    formateur_id: string;
    action: FormateurHistoryAction;
    /** Diff des champs modifiés (`formateur_updated`), vide sinon. */
    changes: FormateurChange[];
    note: string | null;
    actor_id: number | null;
    actor_name: string | null;
    at: Date | string;
}

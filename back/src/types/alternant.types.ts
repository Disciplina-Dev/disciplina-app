/**
 * Types domaine Alternant (pédagogie). Comme `candidate.types.ts`, ces types
 * sont en snake_case et miroient le document Mongo — la conversion camelCase
 * se fait au resolver (cf. `services/mappers/alternant.mapper.ts`).
 */

export interface AlternantCompany {
    name?: string | null;
    address?: string | null;
    mentor_name?: string | null;
    start_date: Date | string;
    end_date?: Date | string | null;
}

export interface Alternant {
    _id: string;
    first_name: string;
    last_name: string;
    /** Libellé de la session du jeune (dénormalisé depuis la Session si liée). */
    session: string;
    /** Référence vers la Session (page Sessions) — `null` = hors session / libellé libre. */
    session_id?: string | null;
    email?: string | null;
    phone?: string | null;
    /** Lien optionnel vers la fiche candidat d'origine (auto-remplissage). */
    candidate_id?: string | null;
    /** `null` = le jeune n'a plus d'entreprise (cf. `removeCompany`). */
    company: AlternantCompany | null;
    linked_alternant_ids: string[];
    /** `null` = actif ; date posée = archivé (rupture « quitte la formation »). */
    archived_at?: Date | string | null;
    created_at: Date | string;
    updated_at: Date | string;
}

export enum AlternantSequenceStatus {
    PENDING = 'pending',
    DONE = 'done',
    NOT_DONE = 'not_done',
}

export interface AlternantSequenceContacts {
    mentor: boolean;
    alternant: boolean;
    formateur: boolean;
}

export interface AlternantSequence {
    _id: string;
    alternant_id: string;
    /** Numéro de SA, auto-incrémenté par alternant. */
    numero: number;
    prevue_le: Date | string;
    status: AlternantSequenceStatus;
    contacts: AlternantSequenceContacts;
    /** Date de réalisation effective, posée à la validation manuelle (3/3 + date). */
    realisee_le?: Date | string | null;
    /** `true` si générée automatiquement (planning J+15 / 10 semaines / 4 mois). */
    auto_generated: boolean;
    /** Horodatage de la notif « SA en cours » (entrée dans les 14 jours) — dédup scheduler. */
    soon_notified_at?: Date | string | null;
    /** Horodatage de la notif « SA en retard » (date prévue dépassée) — dédup scheduler. */
    late_notified_at?: Date | string | null;
    /** `null` = active ; date posée = archivée avec son alternant. */
    archived_at?: Date | string | null;
    created_at: Date | string;
    updated_at: Date | string;
}

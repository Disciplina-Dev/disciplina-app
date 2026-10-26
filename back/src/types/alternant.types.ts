/**
 * Types domaine Alternant (pédagogie). Comme `candidate.types.ts`, ces types
 * sont en snake_case et miroient le document Mongo — la conversion camelCase
 * se fait au resolver (cf. `services/mappers/alternant.mapper.ts`).
 */

/** Raison d'archivage d'un alternant : rupture « quitte » ou fin normale de formation. */
export type AlternantArchiveReason = 'rupture' | 'fin_formation';

export interface AlternantCompany {
    name?: string | null;
    address?: string | null;
    mentor_name?: string | null;
    start_date: Date | string;
    end_date?: Date | string | null;
}

/** Miroir du folder Filiz, écrit uniquement par la sync / la création de folder (jamais par la péda). */
export interface AlternantFiliz {
    folder_id: string;
    class_id: string;
    degree_id?: string | null;
    student_id?: string | null;
    /** Étape courante du folder chez Filiz. */
    step: number;
    /** Étape choisie à la création du folder — absente pour un folder créé directement chez Filiz. */
    start_step?: number | null;
    company_siret?: string | null;
    /** `updateDate` côté Filiz. */
    updated_at?: Date | string | null;
    synced_at: Date | string;
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
    /** `null` = actif ; date posée = archivé (rupture « quitte » ou fin de formation). */
    /** Absent = alternant saisi à la main, sans folder Filiz. */
    filiz?: AlternantFiliz | null;
    /** `null` = actif ; date posée = archivé (rupture « quitte la formation »). */
    archived_at?: Date | string | null;
    /** Raison de l'archivage — `null` sur les archives antérieures = rupture. */
    archive_reason?: AlternantArchiveReason | null;
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
    /** Ids des événements Google Calendar créés pour cette SA, par id d'utilisateur Peda. */
    google_event_ids?: Record<string, string> | null;
    /** `null` = active ; date posée = archivée avec son alternant. */
    archived_at?: Date | string | null;
    created_at: Date | string;
    updated_at: Date | string;
}

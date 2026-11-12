/**
 * Types domaine Alternant (pédagogie). Comme `candidate.types.ts`, ces types
 * sont en snake_case et miroient le document Mongo — la conversion camelCase
 * se fait au resolver (cf. `services/mappers/alternant.mapper.ts`).
 */

export interface AlternantCompany {
    name?: string | null;
    address?: string | null;
    mentor_name?: string | null;
    /** Nécessaire pour la proposition de RDV automatique avant chaque SA (#961). */
    mentor_email?: string | null;
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

/**
 * Type de séquence — détermine quel modèle de document s'applique (#888).
 * J15/J10W sont les deux jalons auto-générés uniques ; PERIODIQUE couvre à la
 * fois les suivis réguliers auto-générés (tous les 4 mois) et toute SA créée
 * manuellement (cf. `AlternantService.createManualSequence`).
 */
export enum AlternantSequenceType {
    J15 = 'j15',
    J10W = 'j10w',
    PERIODIQUE = 'periodique',
    /** SA finale avant l'examen (#960) — jamais auto-générée (pas de date d'examen suivie), toujours créée manuellement. */
    SA_FINALE = 'sa_finale',
}

export interface AlternantSequenceContacts {
    mentor: boolean;
    alternant: boolean;
    formateur: boolean;
}

/**
 * Contenu réellement rédigé pour une SA donnée. Tant qu'il vaut `null`, l'UI
 * affiche le modèle résolu (système pour J15/J10W, celui de la Session pour
 * PERIODIQUE) sans le persister — dès la première sauvegarde, ce snapshot est
 * figé : un modèle modifié plus tard n'altère jamais une SA déjà remplie.
 */
export interface AlternantSequenceDocument {
    maitre_apprentissage: string | null;
    alternant: string | null;
    formateur: string | null;
    /** Signature dessinée (PNG en data-URL), informelle — aucune valeur légale recherchée. */
    signature_maitre_apprentissage: string | null;
    signature_alternant: string | null;
    signature_formateur: string | null;
}

export interface AlternantSequence {
    _id: string;
    alternant_id: string;
    /** Numéro de SA, auto-incrémenté par alternant. */
    numero: number;
    /** Fixé à la création (auto ou manuelle), jamais recalculé. */
    type: AlternantSequenceType;
    prevue_le: Date | string;
    status: AlternantSequenceStatus;
    contacts: AlternantSequenceContacts;
    /** Date de réalisation effective, posée à la validation manuelle (3/3 + date). */
    realisee_le?: Date | string | null;
    /** `true` si générée automatiquement (planning J+15 / 10 semaines / 4 mois). */
    auto_generated: boolean;
    document: AlternantSequenceDocument | null;
    /** Horodatage de la notif « SA en cours » (entrée dans les 14 jours) — dédup scheduler. */
    soon_notified_at?: Date | string | null;
    /** Horodatage de la notif « SA en retard » (date prévue dépassée) — dédup scheduler. */
    late_notified_at?: Date | string | null;
    /** Ids des événements Google Calendar créés pour cette SA, par id d'utilisateur Peda. */
    google_event_ids?: Record<string, string> | null;
    /** Horodatage d'envoi de la proposition de RDV au maître d'apprentissage (#961) — dédup scheduler. */
    appointment_proposed_at?: Date | string | null;
    /** Horodatage de la confirmation du RDV par le maître d'apprentissage (lien signé, #961). */
    appointment_confirmed_at?: Date | string | null;
    /** `null` = active ; date posée = archivée avec son alternant. */
    archived_at?: Date | string | null;
    created_at: Date | string;
    updated_at: Date | string;
}

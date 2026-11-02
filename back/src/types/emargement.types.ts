/**
 * Types domaine Émargement (pédagogie). Comme les autres types Mongo du projet,
 * les interfaces sont en snake_case et miroient le document ; la conversion
 * camelCase se fait dans le service (`EmargementService` → DTO).
 */

/** Sites de formation proposés à la création d'une séance. */
export const SEANCE_SITES = ['Nord', 'Ouest', 'Sud', 'Annemasse'] as const;
export type SeanceSite = (typeof SEANCE_SITES)[number];

/** Modalité de la séance : présentiel en salle ou distanciel. */
export const SEANCE_MODES = ['salle', 'distanciel'] as const;
export type SeanceMode = (typeof SEANCE_MODES)[number];

/** Une feuille d'émargement est scindée entre matin et après-midi. */
export const EMARGEMENT_HALVES = ['morning', 'afternoon'] as const;
export type EmargementHalf = (typeof EMARGEMENT_HALVES)[number];

/**
 * Statut d'un alternant pour un demi-journée. `na` est la valeur par défaut
 * (aucune saisie) ; `late` et `left_early` portent une heure dans `status_time`.
 */
export const EMARGEMENT_STATUSES = ['na', 'present', 'absent', 'late', 'left_early'] as const;
export type EmargementStatus = (typeof EMARGEMENT_STATUSES)[number];

/**
 * Origine de la signature d'une demi-journée :
 * - `qr` : l'alternant a signé lui-même sur son téléphone (QR de la séance) ;
 * - `manual` : le formateur a saisi le statut sans signature de l'alternant ;
 * - `handwritten` : l'alternant a tracé sa signature sur l'appareil du formateur
 *   (repli quand son téléphone est indisponible) — l'image est conservée.
 */
export const EMARGEMENT_SIGNATURE_MODES = ['qr', 'manual', 'handwritten'] as const;
export type EmargementSignatureMode = (typeof EMARGEMENT_SIGNATURE_MODES)[number];

/**
 * Auteur de la validation d'une demi-journée :
 * - `formateur` : le formateur a signé la demi-journée depuis son lien ;
 * - `peda` : le service pédagogique a régularisé une demi-journée que le
 *   formateur n'a pas signée (lien expiré, formateur injoignable), avec motif.
 */
export const SEANCE_VALIDATION_SOURCES = ['formateur', 'peda'] as const;
export type SeanceValidationSource = (typeof SEANCE_VALIDATION_SOURCES)[number];

/** Validation d'une demi-journée (une signature formateur ou une validation Peda). */
export interface SeanceValidation {
    signed_at: Date | string;
    signed_by_name: string;
    source: SeanceValidationSource;
    /** Tracé du formateur ; `null` quand la demi-journée est régularisée par le Peda. */
    signature_image: string | null;
    signed_ip: string | null;
    signed_user_agent: string | null;
}

/**
 * État de validation d'une feuille :
 * - `in_progress` : au moins un créneau n'est pas encore fermé ;
 * - `to_validate` : tous les créneaux sont fermés, le formateur peut encore signer ;
 * - `anomaly` : le lien a expiré (J+7) et une demi-journée reste non signée ;
 * - `validated` : toutes les demi-journées sont validées (formateur ou Peda).
 */
export const SEANCE_VALIDATION_STATUSES = ['in_progress', 'to_validate', 'anomaly', 'validated'] as const;
export type SeanceValidationStatus = (typeof SEANCE_VALIDATION_STATUSES)[number];

/**
 * Actions journalisées dans l'historique d'une feuille d'émargement. Le journal
 * est append-only : il permet de reconstituer qui a changé quoi, quand et depuis
 * quel appareil, y compris après une correction du formateur ou du Peda.
 */
export const EMARGEMENT_HISTORY_ACTIONS = [
    /** Séance créée par le Peda (la feuille existe, aucun statut saisi). */
    'seance_created',
    /** Statut d'un alternant saisi ou corrigé par le formateur. */
    'attendance_set',
    /** Signature de secours de l'alternant, tracée sur l'appareil du formateur. */
    'attendance_signed',
    /** Signature de l'alternant sur son téléphone via le QR code. */
    'qr_signed',
    /** Demi-journée signée par le formateur (verrouille cette demi-journée). */
    'half_signed',
    /** Demi-journée validée par le service pédagogique (régularisation, avec motif). */
    'half_validated',
] as const;
export type EmargementHistoryAction = (typeof EMARGEMENT_HISTORY_ACTIONS)[number];

/** Auteur d'un événement du journal. */
export const EMARGEMENT_HISTORY_SOURCES = ['peda', 'formateur', 'alternant', 'system'] as const;
export type EmargementHistorySource = (typeof EMARGEMENT_HISTORY_SOURCES)[number];

/**
 * Entrée du journal d'une séance. `from_status` est `null` à la création de la
 * ligne ; une entrée n'est écrite que si le statut (ou son heure) change, ou
 * lorsqu'une signature / validation est enregistrée.
 */
export interface EmargementHistoryEntry {
    _id: string;
    seance_id: string;
    /** Alternant concerné ; `null` pour les événements au niveau de la feuille. */
    alternant_id: string | null;
    /** Nom figé au moment de l'événement (l'alternant peut être renommé ensuite). */
    alternant_name: string | null;
    half: EmargementHalf | null;
    action: EmargementHistoryAction;
    from_status: EmargementStatus | null;
    to_status: EmargementStatus | null;
    from_status_time: string | null;
    to_status_time: string | null;
    source: EmargementHistorySource;
    /** Nom de l'auteur (formateur, alternant ou utilisateur Peda). */
    actor_name: string | null;
    /** Motif saisi par le Peda (validation) ou contexte de l'action. */
    note: string | null;
    ip: string | null;
    user_agent: string | null;
    at: Date | string;
}

export interface Seance {
    _id: string;
    /** Classe Filiz qui tient lieu de session (groupe d'alternants). */
    session_id: string;
    /** Nom de la session au moment de la création (snapshot d'affichage). */
    session_nom: string;
    /**
     * Titre professionnel préparé, snapshot de `Session.filiere` à la création :
     * la feuille doit rester lisible même si la promo Filiz est renommée.
     */
    degree_title: string | null;
    /** Module ou séquence traités pendant la séance (libellé libre, facultatif). */
    module: string | null;
    /** Lieu précis : salle, adresse ou lien visio (libellé libre, facultatif). */
    location: string | null;
    /** Jour de la séance, `YYYY-MM-DD` (heure locale du tenant). */
    date: string;
    /** Horaires de la séance, `HH:mm` (heure locale du tenant). */
    start_time: string;
    end_time: string;
    site: SeanceSite;
    mode: SeanceMode;
    formateur_name: string;
    formateur_email: string;
    /** Créneau d'émargement du matin, `HH:mm` locaux. */
    morning_start: string;
    morning_end: string;
    /** Créneau d'émargement de l'après-midi ; `null` = séance sans après-midi. */
    afternoon_start: string | null;
    afternoon_end: string | null;
    /** Fuseau IANA figé à la création (les créneaux sont comparés dans ce fuseau). */
    timezone: string;
    /** Secret utilisé pour dériver les jetons formateur/QR (jamais exposé). */
    token_secret: string;
    /**
     * Fin de validité des liens de la séance : fin de la journée locale + délai
     * de régularisation (`EMARGEMENT_GRACE_DAYS`), pour que le formateur puisse
     * encore corriger et signer après le jour J. La signature des alternants,
     * elle, reste bornée aux créneaux.
     */
    invite_expires_at: Date | string;
    /**
     * Validation par demi-journée : le formateur signe le matin après la
     * fermeture du créneau du matin, l'après-midi après le sien. Une
     * demi-journée validée est verrouillée, l'autre reste éditable.
     */
    validations: {
        morning: SeanceValidation | null;
        afternoon: SeanceValidation | null;
    };
    /** Auteur de la validation Peda (id utilisateur), `null` si le formateur a tout signé. */
    validated_by: number | null;
    /** Motif saisi par le Peda lors d'une validation de régularisation. */
    validation_note: string | null;
    /**
     * @deprecated Ancien stockage « feuille signée en un bloc », antérieur au lot 4.
     * Conservé pour relire les feuilles existantes (repli dans `validationsOf`).
     */
    signed_at?: Date | string | null;
    signed_by_name?: string | null;
    signature_image?: string | null;
    signed_ip?: string | null;
    signed_user_agent?: string | null;
    created_by: number | null;
    created_at: Date | string;
    updated_at: Date | string;
}

export interface EmargementRecord {
    _id: string;
    seance_id: string;
    alternant_id: string;
    /** Snapshot du nom au moment de la saisie (la fiche alternant peut être renommée). */
    first_name: string;
    last_name: string;
    half: EmargementHalf;
    status: EmargementStatus;
    /** Heure saisie pour `late` / `left_early` (`HH:mm`), sinon `null`. */
    status_time: string | null;
    /** Dernière signature : `qr` (alternant), `manual` (saisie formateur) ou `handwritten`. */
    signature_mode: EmargementSignatureMode;
    /**
     * Signature manuscrite de l'alternant (data-URL PNG) quand `signature_mode`
     * vaut `handwritten` ; `null` sinon. Effacée si la ligne est rejouée par QR
     * ou par une saisie formateur.
     */
    signature_image: string | null;
    /** Horodatage serveur de la dernière saisie. */
    signed_at: Date | string;
    /** Première signature, jamais écrasée : conserve la preuve du passage QR. */
    first_signed_at: Date | string;
    first_signature_mode: EmargementSignatureMode;
    ip: string | null;
    user_agent: string | null;
    created_at: Date | string;
    updated_at: Date | string;
}

/** Entrée de création d'une séance (camelCase, comme les autres inputs de service). */
export interface CreateSeanceInput {
    sessionId: string;
    date: string;
    startTime: string;
    endTime: string;
    site: string;
    mode: string;
    formateurName: string;
    formateurEmail: string;
    morningStart: string;
    morningEnd: string;
    afternoonStart?: string | null;
    afternoonEnd?: string | null;
    /** Module / séquence (facultatif, vide = non renseigné). */
    module?: string | null;
    /** Lieu précis : salle, adresse, lien visio (facultatif). */
    location?: string | null;
}

export type UpdateSeanceInput = Partial<CreateSeanceInput>;

export interface AttendanceInput {
    alternantId: string;
    half: string;
    status: string;
    statusTime?: string | null;
}

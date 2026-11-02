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
    signed_at: Date | string | null;
    signed_by_name: string | null;
    /** Signature manuscrite du formateur (data-URL PNG), `null` tant que non signée. */
    signature_image: string | null;
    signed_ip: string | null;
    signed_user_agent: string | null;
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

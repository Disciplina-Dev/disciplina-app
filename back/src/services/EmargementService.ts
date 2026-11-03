import { logger } from '../external/logger';
import { generateSignature } from '../external/crypto';
import { sendSystemEmail } from '../external/google/system-mail';
import { GoogleGmailService } from '../external/google/gmail.service';
import { withNoReply } from '../external/google/no-reply';
import { env } from '../config/env';
import { tenantTimezone } from '../config/tenant';
import { EmargementRepository } from '../repositories/mongo/EmargementRepository';
import {
    EmargementHistoryRepository,
    HISTORY_EXPORT_LIMIT,
    RecordHistoryInput,
} from '../repositories/mongo/EmargementHistoryRepository';
import { AlternantRepository } from '../repositories/mongo/AlternantRepository';
import { RuptureRepository } from '../repositories/mongo/RuptureRepository';
import { SeanceListFilter, SeanceRepository } from '../repositories/mongo/SeanceRepository';
import { Alternant, AlternantArchiveReason } from '../types/alternant.types';
import { Rupture } from '../types/rupture.types';
import { SessionService } from './SessionService';
import { UserService } from './UserService';
import { httpError } from './httpError';
import { renderTemplate } from './renderTemplate';
import { EMARGEMENT_INVITE_BODY, EMARGEMENT_INVITE_SUBJECT } from './emargementInviteTemplate';
import { buildSeanceToken, parseSeanceToken, SeanceTokenKind, verifySeanceToken } from './emargementTokens';
import {
    CreateSeanceInput,
    EMARGEMENT_HALVES,
    EMARGEMENT_STATUSES,
    EmargementHalf,
    EmargementHistoryAction,
    EmargementHistoryEntry,
    EmargementHistorySource,
    EmargementRecord,
    EmargementSignatureMode,
    EmargementStatus,
    SEANCE_MODES,
    SEANCE_SITES,
    Seance,
    SeanceMode,
    SeanceSite,
    SeanceValidation,
    SeanceValidationSource,
    SeanceValidationStatus,
} from '../types/emargement.types';
import {
    addDaysToDate,
    endOfLocalDay,
    formatLongDateFr,
    isHhMm,
    isIsoDate,
    localDate,
    minutesOfDay,
    windowState,
    WindowState,
    zonedDateTimeToUtc,
} from '../utils/zonedTime';

export interface SeanceLinks {
    formateurUrl: string;
    qrUrl: string;
}

/**
 * Délai de régularisation après le jour de la séance : le formateur garde la
 * main sur sa feuille (saisie, signature manuscrite, signature finale) au-delà
 * de minuit. Les alternants, eux, ne peuvent plus signer dès que le créneau est
 * fermé — c'est le créneau qui ferme leur accès, pas ce délai.
 */
export const EMARGEMENT_GRACE_DAYS = 7;

/** Fin de validité des liens : fin du jour J + délai de régularisation. */
function linksExpiry(date: string, timeZone: string): Date {
    return endOfLocalDay(addDaysToDate(date, EMARGEMENT_GRACE_DAYS), timeZone);
}

/** Création : la séance existe même si l'e-mail d'invitation n'a pas pu partir. */
export interface CreatedSeance {
    seance: SeanceDto;
    inviteSent: boolean;
}

export interface InviteResult {
    links: SeanceLinks;
    /** `false` = aucun compte Google connecté n'a pu envoyer le mail : lien à transmettre manuellement. */
    inviteSent: boolean;
}

export interface EmargementRecordDto {
    status: EmargementStatus;
    statusTime: string | null;
    signatureMode: EmargementSignatureMode;
    /** Signature manuscrite de l'alternant (data-URL PNG), `null` hors mode `handwritten`. */
    signatureImage: string | null;
    signedAt: string;
    firstSignedAt: string;
    firstSignatureMode: EmargementSignatureMode;
}

/**
 * Situation d'un alternant vis-à-vis de sa session : archivage (sortie) et
 * dernière rupture déclarée. Sert à expliquer pourquoi une ligne reste ou non
 * attendue sur une feuille d'émargement (7.4).
 */
export interface AlternantPresenceDto {
    /** `true` = sorti de la formation (archivé) : plus attendu sur les séances suivantes. */
    archived: boolean;
    /** `rupture` = sortie par rupture, `fin_formation` = fin normale, `null` = actif. */
    archiveReason: AlternantArchiveReason | null;
    /**
     * Date d'effet de la sortie (`YYYY-MM-DD`) : date de la rupture déclarée
     * quand elle existe, sinon date d'archivage. `null` quand l'alternant est actif.
     */
    archiveDate: string | null;
    /** Dernière rupture déclarée, même quand le jeune poursuit sa formation. */
    ruptureDate: string | null;
    /** La dernière rupture déclarée indique que le jeune poursuit sa formation. */
    poursuitFormation: boolean;
}

export interface AlternantEmargementDto {
    id: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    /** Financeur de la formation (OPCO, Région…) — figure sur la feuille et les exports. */
    financeur?: string | null;
    /** Statut d'archivage / rupture, affiché sur la feuille à côté du nom (7.4). */
    presence: AlternantPresenceDto;
    attendance: {
        morning: EmargementRecordDto | null;
        afternoon: EmargementRecordDto | null;
    };
}

/**
 * Avancement de la saisie d'une feuille : combien d'alternants sont attendus et
 * combien ont un statut réellement saisi (« non renseigné » ne compte pas).
 */
export interface SeanceAttendanceProgressDto {
    /** Alternants attendus sur la séance, toutes demi-journées confondues. */
    expected: number;
    morning: { expected: number; recorded: number };
    afternoon: { expected: number; recorded: number };
    /** Statuts manquants sur des demi-journées déjà fermées. */
    missing: number;
    /** Demi-journées fermées avec au moins un statut manquant. */
    missingHalves: EmargementHalf[];
}

export interface SeanceWindowDto {
    start: string;
    end: string;
    state: WindowState;
}

export interface SeanceValidationDto {
    signedAt: string;
    signedByName: string;
    source: SeanceValidationSource;
    /** Tracé du formateur ; `null` quand la demi-journée est régularisée par le Peda. */
    signatureImage: string | null;
}

export type SeanceValidationsDto = {
    morning: SeanceValidationDto | null;
    afternoon: SeanceValidationDto | null;
};

/** Événement du journal d'une séance, tel qu'affiché côté Peda. */
export interface EmargementHistoryDto {
    id: string;
    at: string;
    action: EmargementHistoryAction;
    alternantId: string | null;
    alternantName: string | null;
    half: EmargementHalf | null;
    fromStatus: EmargementStatus | null;
    toStatus: EmargementStatus | null;
    fromStatusTime: string | null;
    toStatusTime: string | null;
    source: EmargementHistorySource;
    actorName: string | null;
    note: string | null;
}

export interface SeanceDto {
    id: string;
    sessionId: string;
    sessionNom: string;
    /** Titre professionnel préparé (snapshot de la filière Filiz). */
    degreeTitle: string | null;
    /** Module ou séquence traités pendant la séance. */
    module: string | null;
    /** Lieu précis : salle, adresse ou lien visio. */
    location: string | null;
    date: string;
    /** Début des cours (dérivé : `morningClassStart`). */
    startTime: string;
    /** Fin des cours (dérivée : `afternoonClassEnd`, sinon `morningClassEnd`). */
    endTime: string;
    /** Horaires de cours du matin, base des heures prévues / réalisées. */
    morningClassStart: string | null;
    morningClassEnd: string | null;
    /** Horaires de cours de l'après-midi ; `null` = séance sans après-midi. */
    afternoonClassStart: string | null;
    afternoonClassEnd: string | null;
    site: SeanceSite;
    mode: SeanceMode;
    formateurName: string;
    formateurEmail: string;
    morningStart: string;
    morningEnd: string;
    afternoonStart: string | null;
    afternoonEnd: string | null;
    timezone: string;
    inviteExpiresAt: string;
    /** Validation par demi-journée (formateur ou Peda). */
    validations: SeanceValidationsDto;
    validationStatus: SeanceValidationStatus;
    /** `peda` dès qu'au moins une demi-journée a été régularisée par le service pédagogique. */
    validationSource: SeanceValidationSource | null;
    validatedBy: number | null;
    validationNote: string | null;
    /** `true` quand le Peda peut valider lui-même (créneaux fermés, validation incomplète). */
    canValidateByPeda: boolean;
    createdAt: string;
    updatedAt: string;
    formateurUrl: string;
    qrUrl: string;
    marked: number;
    present: number;
    /** Avancement de la saisie (statuts manquants sur les créneaux fermés). */
    attendanceProgress: SeanceAttendanceProgressDto;
}

export interface SeanceDetailDto extends SeanceDto {
    alternants: AlternantEmargementDto[];
    /** Journal des changements (statuts, signatures, validations), du plus récent au plus ancien. */
    history: EmargementHistoryDto[];
}

// ── Exports (§8) ─────────────────────────────────────────────────────────────

/** Filtre commun aux exports de période : une séance, une session, ou des dates. */
export interface EmargementExportFilter {
    /** Restreint l'export à une séance (ignoré si absent). */
    seanceId?: string;
    sessionId?: string;
    /** Borne basse incluse, `YYYY-MM-DD`. */
    from?: string;
    /** Borne haute incluse, `YYYY-MM-DD`. */
    to?: string;
    /**
     * Inclut aussi les alternants archivés dont la sortie est antérieure à la
     * séance (export historique). Par défaut, un sorti n'apparaît que sur les
     * séances où il était encore présent.
     */
    includeArchived?: boolean;
}

/** Une ligne d'export = un alternant × une demi-journée d'une séance. */
export interface AttendanceExportRow {
    seanceId: string;
    sessionId: string;
    date: string;
    startTime: string;
    endTime: string;
    sessionNom: string;
    degreeTitle: string | null;
    module: string | null;
    formateurName: string;
    site: SeanceSite;
    mode: SeanceMode;
    validationStatus: SeanceValidationStatus;
    alternantId: string;
    firstName: string;
    lastName: string;
    financeur: string | null;
    /** Situation de l'alternant (actif / rupture / sortie) au moment de la séance. */
    presence: AlternantPresenceDto;
    half: EmargementHalf;
    status: EmargementStatus;
    statusTime: string | null;
    signatureMode: EmargementSignatureMode | null;
    signedAt: string | null;
    /** Durée du créneau (minutes) : base des heures prévues. */
    plannedMinutes: number;
    /** Heures réellement suivies, selon le statut et l'heure éventuelle. */
    attendedMinutes: number;
    /** `true` quand la demi-journée est fermée et que le statut n'a pas été saisi. */
    missing: boolean;
    validation: SeanceValidationDto | null;
}

/** Synthèse par alternant, second tableau des exports Excel. */
export interface AttendanceExportSummary {
    alternantId: string;
    firstName: string;
    lastName: string;
    financeur: string | null;
    /** Situation de l'alternant à la fin de la période exportée. */
    presence: AlternantPresenceDto;
    sessions: number;
    halves: number;
    absences: number;
    /** Demi-journées fermées sans statut saisi : le taux peut être sous-évalué. */
    missingHalves: number;
    plannedMinutes: number;
    attendedMinutes: number;
}

export interface AttendanceExportDto {
    generatedAt: string;
    from: string | null;
    to: string | null;
    sessionId: string | null;
    seanceId: string | null;
    rows: AttendanceExportRow[];
    summaries: AttendanceExportSummary[];
}

/** Une ligne d'export du journal d'audit (append-only, cf. lot 5). */
export interface HistoryExportRow {
    at: string;
    seanceId: string;
    date: string;
    sessionNom: string;
    action: EmargementHistoryAction;
    alternantName: string | null;
    half: EmargementHalf | null;
    fromStatus: EmargementStatus | null;
    toStatus: EmargementStatus | null;
    fromStatusTime: string | null;
    toStatusTime: string | null;
    source: EmargementHistorySource;
    actorName: string | null;
    note: string | null;
}

export interface HistoryExportDto {
    generatedAt: string;
    from: string | null;
    to: string | null;
    sessionId: string | null;
    seanceId: string | null;
    rows: HistoryExportRow[];
}

export interface AttestationSeanceDto {
    seanceId: string;
    date: string;
    startTime: string;
    endTime: string;
    module: string | null;
    validationStatus: SeanceValidationStatus;
    plannedMinutes: number;
    attendedMinutes: number;
    halves: {
        half: EmargementHalf;
        status: EmargementStatus;
        statusTime: string | null;
        plannedMinutes: number;
        attendedMinutes: number;
        /** `true` quand le créneau est fermé et que le statut n'a pas été saisi. */
        missing: boolean;
        validation: SeanceValidationDto | null;
    }[];
}

/** Synthèse d'assiduité d'un groupe (session) sur une période — export PDF « par groupe ». */
export interface GroupSummaryDto {
    generatedAt: string;
    sessionId: string;
    sessionNom: string;
    degreeTitle: string | null;
    from: string | null;
    to: string | null;
    plannedMinutes: number;
    attendedMinutes: number;
    rows: AttendanceExportSummary[];
}

/** Données d'une attestation d'assiduité (un alternant, une période). */
export interface AttestationDto {
    generatedAt: string;
    alternantId: string;
    firstName: string;
    lastName: string;
    financeur: string | null;
    sessionNom: string;
    degreeTitle: string | null;
    from: string | null;
    to: string | null;
    plannedMinutes: number;
    attendedMinutes: number;
    seances: AttestationSeanceDto[];
}

// ── Assiduité (7.1 / 7.2) ────────────────────────────────────────────────────

/** Filtre du tableau de bord d'assiduité. */
export interface AssiduiteFilter {
    /** Borne basse incluse, `YYYY-MM-DD`. */
    from?: string;
    /** Borne haute incluse, `YYYY-MM-DD`. */
    to?: string;
    sessionId?: string;
    site?: SeanceSite;
}

/** Compteurs d'heures communs aux lignes et aux totaux. */
export interface AssiduiteTotalsDto {
    alternants: number;
    seances: number;
    /** Demi-journées réellement saisies (statut ≠ « non renseigné »). */
    halves: number;
    /** Demi-journées fermées sans statut saisi : le taux peut être sous-évalué. */
    missingHalves: number;
    absences: number;
    plannedMinutes: number;
    attendedMinutes: number;
    /** `attended / planned` entre 0 et 1 ; `null` quand aucune heure n'est prévue. */
    rate: number | null;
}

/** Une ligne du tableau de bord : un alternant, une session ou un site. */
export interface AssiduiteRowDto extends AssiduiteTotalsDto {
    key: string;
    label: string;
}

export interface AssiduiteAlternantRowDto extends AssiduiteRowDto {
    alternantId: string;
    firstName: string;
    lastName: string;
    financeur: string | null;
    /** Nombre de sessions distinctes fréquentées sur la période. */
    sessions: number;
    lastSeanceDate: string | null;
    presence: AlternantPresenceDto;
}

export interface AssiduiteDto {
    generatedAt: string;
    from: string | null;
    to: string | null;
    sessionId: string | null;
    site: SeanceSite | null;
    totals: AssiduiteTotalsDto;
    alternants: AssiduiteAlternantRowDto[];
    sessions: AssiduiteRowDto[];
    sites: AssiduiteRowDto[];
}

/** Assiduité d'un alternant : synthèse + détail séance par séance. */
export interface AssiduiteAlternantDto {
    generatedAt: string;
    alternantId: string;
    firstName: string;
    lastName: string;
    financeur: string | null;
    sessionNom: string;
    degreeTitle: string | null;
    presence: AlternantPresenceDto;
    from: string | null;
    to: string | null;
    totals: AssiduiteTotalsDto;
    seances: AttestationSeanceDto[];
}

export interface FormateurViewDto {
    seance: {
        id: string;
        sessionNom: string;
        degreeTitle: string | null;
        module: string | null;
        location: string | null;
        date: string;
        startTime: string;
        endTime: string;
        /** Horaires de cours (`null` sur les séances antérieures au lot 8). */
        morningClassStart: string | null;
        morningClassEnd: string | null;
        afternoonClassStart: string | null;
        afternoonClassEnd: string | null;
        site: SeanceSite;
        mode: SeanceMode;
        formateurName: string;
        validations: SeanceValidationsDto;
        validationStatus: SeanceValidationStatus;
        qrUrl: string;
    };
    alternants: AlternantEmargementDto[];
    serverNow: string;
    openHalf: EmargementHalf | null;
    windows: {
        morning: SeanceWindowDto;
        afternoon: SeanceWindowDto | null;
    };
    expired: boolean;
    /** `true` tant qu'au moins une demi-journée reste éditable (non validée, lien valide). */
    canEdit: boolean;
    /** Demi-journées encore modifiables (statuts, signature manuscrite). */
    editableHalves: EmargementHalf[];
    /** Demi-journées signables par le formateur : créneau fermé, non validée, lien valide. */
    signableHalves: EmargementHalf[];
}

export interface PublicSigningDto {
    sessionNom: string;
    degreeTitle: string | null;
    module: string | null;
    location: string | null;
    date: string;
    startTime: string;
    endTime: string;
    /** Horaires de cours (`null` sur les séances antérieures au lot 8). */
    morningClassStart: string | null;
    morningClassEnd: string | null;
    afternoonClassStart: string | null;
    afternoonClassEnd: string | null;
    site: SeanceSite;
    mode: SeanceMode;
    signed: boolean;
    expired: boolean;
    serverNow: string;
    openHalf: EmargementHalf | null;
    windows: {
        morning: SeanceWindowDto;
        afternoon: SeanceWindowDto | null;
    };
}

export interface SignSheetResult {
    half: EmargementHalf;
    signedAt: string;
    signedByName: string;
}

export interface QrSignResult {
    fullName: string;
    half: EmargementHalf;
    signedAt: string;
    alreadySigned: boolean;
}

/** Métadonnées de la requête, lues côté serveur (jamais dans le corps). */
export interface ClientMeta {
    ip: string | null;
    userAgent: string | null;
}

function asRecord(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function requiredString(value: unknown, label: string, maxLength = 200): string {
    if (typeof value !== 'string' || !value.trim()) {
        throw httpError(400, 'validation', `${label} est requis`);
    }
    const trimmed = value.trim();
    if (trimmed.length > maxLength) {
        throw httpError(400, 'validation', `${label} est trop long`);
    }
    return trimmed;
}

function optionalTime(value: unknown, label: string): string | null {
    if (value === undefined || value === null || value === '') return null;
    if (!isHhMm(value)) throw httpError(400, 'validation', `${label} doit être au format HH:mm`);
    return value;
}

/** Libellé libre facultatif (module, lieu) : `null` si absent ou vide. */
function optionalLabel(value: unknown, label: string, maxLength = 120): string | null {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string') throw httpError(400, 'validation', `${label} est invalide`);
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.length > maxLength) throw httpError(400, 'validation', `${label} est trop long`);
    return trimmed;
}

function requiredTime(value: unknown, label: string): string {
    if (!isHhMm(value)) throw httpError(400, 'validation', `${label} doit être au format HH:mm`);
    return value;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
    if (typeof value !== 'string' || !allowed.includes(value as T)) {
        throw httpError(400, 'validation', `${label} invalide`);
    }
    return value as T;
}

function isEmail(value: unknown): value is string {
    return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * Un créneau de signature doit tenir dans les horaires de la séance : sinon la
 * fermeture du créneau ne borne plus rien (signature possible avant le cours ou
 * après sa fin).
 */
function assertWindowInsideSeance(
    windowStart: string,
    windowEnd: string,
    seanceStart: string,
    seanceEnd: string,
    label: string,
): void {
    if (minutesOfDay(windowStart) < minutesOfDay(seanceStart)) {
        throw httpError(400, 'validation', `Le créneau ${label} ne peut pas ouvrir avant le début de la séance`);
    }
    if (minutesOfDay(windowEnd) > minutesOfDay(seanceEnd)) {
        throw httpError(400, 'validation', `Le créneau ${label} ne peut pas fermer après la fin de la séance`);
    }
}

/** Signature manuscrite : PNG/JPEG en data-URL, plafonnée (corps de requête à 3 Mo). */
function requireSignatureImage(value: unknown): string {
    if (typeof value !== 'string' || !/^data:image\/(png|jpeg);base64,/.test(value)) {
        throw httpError(400, 'signature', 'La signature manuscrite est requise');
    }
    if (value.length > 2_500_000) {
        throw httpError(400, 'signature', 'La signature est trop volumineuse');
    }
    return value;
}

function toIso(value: Date | string | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    return new Date(value).toISOString();
}

function normalizeEmail(value: string): string {
    return value.trim().toLowerCase();
}

/** Demi-journées à valider : l'après-midi n'existe que s'il a un créneau. */
function applicableHalves(seance: Seance): EmargementHalf[] {
    return seance.afternoon_start ? [...EMARGEMENT_HALVES] : ['morning'];
}

/** Bornes horaires d'une demi-journée (`null` si la séance n'a pas ce créneau). */
function halfBounds(seance: Seance, half: EmargementHalf): { start: string; end: string } | null {
    const start = half === 'morning' ? seance.morning_start : seance.afternoon_start;
    const end = half === 'morning' ? seance.morning_end : seance.afternoon_end;
    return start && end ? { start, end } : null;
}

/**
 * Horaires de cours d'une demi-journée, qui servent au calcul des heures.
 * Les séances créées avant le lot 8 n'ont pas ces champs : on retombe alors sur
 * le créneau de signature, ce qui reproduit exactement les heures d'avant.
 */
function classSchedule(seance: Seance, half: EmargementHalf): { start: string; end: string } | null {
    const start = half === 'morning' ? seance.morning_class_start : seance.afternoon_class_start;
    const end = half === 'morning' ? seance.morning_class_end : seance.afternoon_class_end;
    if (start && end) return { start, end };
    return halfBounds(seance, half);
}

/** Heures prévues d'une demi-journée : la durée des horaires de cours. */
function plannedMinutesOf(seance: Seance, half: EmargementHalf): number {
    const bounds = classSchedule(seance, half);
    if (!bounds) return 0;
    return Math.max(0, minutesOfDay(bounds.end) - minutesOfDay(bounds.start));
}

/**
 * Heures réalisées d'une demi-journée :
 * - `present` → tous les horaires de cours ;
 * - `late` → de l'heure d'arrivée à la fin des cours ;
 * - `left_early` → du début des cours à l'heure de départ ;
 * - `absent` / `na` → 0.
 *
 * Sans heure saisie, une arrivée tardive ou un départ anticipé comptent la
 * demi-journée entière : mieux vaut surestimer la présence que de la nier.
 */
function attendedMinutesOf(seance: Seance, half: EmargementHalf, record: EmargementRecord | null): number {
    const planned = plannedMinutesOf(seance, half);
    if (!record || planned === 0) return 0;
    const bounds = classSchedule(seance, half)!;
    if (record.status === 'present') return planned;
    if (record.status === 'late' && record.status_time) {
        return Math.max(0, Math.min(planned, minutesOfDay(bounds.end) - minutesOfDay(record.status_time)));
    }
    if (record.status === 'left_early' && record.status_time) {
        return Math.max(0, Math.min(planned, minutesOfDay(record.status_time) - minutesOfDay(bounds.start)));
    }
    return 0;
}

/**
 * Validations stockées, avec repli sur l'ancien champ `signed_at` : les feuilles
 * signées avant le lot 4 n'ont qu'une signature globale, qui valait pour toutes
 * les demi-journées du jour. Aucune migration de données n'est nécessaire.
 */
function validationsOf(seance: Seance): {
    morning: SeanceValidation | null;
    afternoon: SeanceValidation | null;
} {
    const stored = seance.validations ?? { morning: null, afternoon: null };
    if (stored.morning || stored.afternoon) {
        return { morning: stored.morning ?? null, afternoon: stored.afternoon ?? null };
    }
    if (!seance.signed_at) return { morning: null, afternoon: null };
    const legacy: SeanceValidation = {
        signed_at: seance.signed_at,
        signed_by_name: seance.signed_by_name ?? seance.formateur_name,
        source: 'formateur',
        signature_image: seance.signature_image ?? null,
        signed_ip: seance.signed_ip ?? null,
        signed_user_agent: seance.signed_user_agent ?? null,
    };
    return { morning: legacy, afternoon: seance.afternoon_start ? legacy : null };
}

function validationDto(validation: SeanceValidation | null): SeanceValidationDto | null {
    if (!validation) return null;
    return {
        signedAt: toIso(validation.signed_at)!,
        signedByName: validation.signed_by_name,
        source: validation.source,
        signatureImage: validation.signature_image ?? null,
    };
}

function historyDto(entry: EmargementHistoryEntry): EmargementHistoryDto {
    return {
        id: entry._id,
        at: toIso(entry.at)!,
        action: entry.action,
        alternantId: entry.alternant_id ?? null,
        alternantName: entry.alternant_name ?? null,
        half: entry.half ?? null,
        fromStatus: entry.from_status ?? null,
        toStatus: entry.to_status ?? null,
        fromStatusTime: entry.from_status_time ?? null,
        toStatusTime: entry.to_status_time ?? null,
        source: entry.source,
        actorName: entry.actor_name ?? null,
        note: entry.note ?? null,
    };
}

/** Un alternant et sa situation (archive / rupture) au moment de la lecture. */
interface RosterEntry {
    alternant: Alternant;
    presence: AlternantPresenceDto;
}

/** Date locale `YYYY-MM-DD` d'un horodatage Mongo. */
function localDay(value: Date | string | null | undefined, timezone: string): string | null {
    if (value === null || value === undefined) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : localDate(date, timezone);
}

/**
 * Situation d'un alternant : sortie (archivage) et dernière rupture déclarée.
 *
 * La date d'effet d'une sortie par rupture est celle de la rupture déclarée
 * (celle qui a archivé), pas la date d'archivage technique ; elle décide si
 * l'alternant était encore attendu sur une séance donnée.
 */
function presenceOf(alternant: Alternant, ruptures: Rupture[], timezone: string): AlternantPresenceDto {
    const sorted = ruptures
        .slice()
        .sort((a, b) => new Date(b.date_rupture).getTime() - new Date(a.date_rupture).getTime());
    const latest = sorted[0] ?? null;
    const quitting = sorted.find((rupture) => rupture.poursuit_formation === false) ?? null;
    const archived = Boolean(alternant.archived_at);
    const archiveReason = archived ? (alternant.archive_reason ?? 'rupture') : null;
    const archiveDate = archived
        ? archiveReason === 'rupture' && quitting
            ? localDay(quitting.date_rupture, timezone)
            : localDay(alternant.archived_at, timezone)
        : null;
    return {
        archived,
        archiveReason,
        archiveDate,
        ruptureDate: latest ? localDay(latest.date_rupture, timezone) : null,
        poursuitFormation: latest?.poursuit_formation === true,
    };
}

/** Accumulateur d'assiduité : on additionne des lignes, on calcule le taux à la fin. */
interface AssiduiteAccumulator {
    seanceIds: Set<string>;
    sessionIds: Set<string>;
    alternantIds: Set<string>;
    halves: number;
    missingHalves: number;
    absences: number;
    plannedMinutes: number;
    attendedMinutes: number;
}

function emptyAccumulator(): AssiduiteAccumulator {
    return {
        seanceIds: new Set(),
        sessionIds: new Set(),
        alternantIds: new Set(),
        halves: 0,
        missingHalves: 0,
        absences: 0,
        plannedMinutes: 0,
        attendedMinutes: 0,
    };
}

/**
 * Une ligne d'export = un alternant × une demi-journée. `halves` ne compte que
 * les demi-journées réellement saisies ; les non renseignées sont comptées à
 * part (`missingHalves`) pour signaler un taux potentiellement sous-évalué.
 */
function accumulateRow(acc: AssiduiteAccumulator, row: AttendanceExportRow): void {
    acc.seanceIds.add(row.seanceId);
    acc.sessionIds.add(row.sessionId);
    acc.alternantIds.add(row.alternantId);
    if (row.status !== 'na') acc.halves += 1;
    if (row.missing) acc.missingHalves += 1;
    if (row.status === 'absent') acc.absences += 1;
    acc.plannedMinutes += row.plannedMinutes;
    acc.attendedMinutes += row.attendedMinutes;
}

function totalsFrom(acc: AssiduiteAccumulator): AssiduiteTotalsDto {
    return {
        alternants: acc.alternantIds.size,
        seances: acc.seanceIds.size,
        halves: acc.halves,
        missingHalves: acc.missingHalves,
        absences: acc.absences,
        plannedMinutes: acc.plannedMinutes,
        attendedMinutes: acc.attendedMinutes,
        rate: acc.plannedMinutes > 0 ? acc.attendedMinutes / acc.plannedMinutes : null,
    };
}

export class EmargementService {
    constructor(
        private readonly seances = new SeanceRepository(),
        private readonly emargements = new EmargementRepository(),
        private readonly history = new EmargementHistoryRepository(),
        private readonly alternants = new AlternantRepository(),
        private readonly ruptures = new RuptureRepository(),
        private readonly sessions = new SessionService(),
        private readonly users = new UserService(),
        private readonly gmailService = new GoogleGmailService(),
    ) {}

    // ── Côté Peda ────────────────────────────────────────────────────────────

    async list(filter: SeanceListFilter = {}): Promise<SeanceDto[]> {
        const seances = await this.seances.findAll(filter);
        const ids = seances.map((seance) => seance._id);
        const [counts, recorded, rosters] = await Promise.all([
            this.emargements.countsBySeance(ids),
            this.emargements.countsBySeanceAndHalf(ids),
            this.sessionRosters(seances),
        ]);
        const now = new Date();
        const dtos = seances.map((seance) => {
            const roster = (rosters.get(seance.session_id) ?? []).filter((entry) =>
                this.isOnSeance(entry, seance, false),
            );
            return this.toDto(
                seance,
                counts.get(seance._id),
                undefined,
                this.attendanceProgress(seance, roster, recorded.get(seance._id), now),
            );
        });
        // L'état dépend de l'heure courante et des créneaux : il se calcule après
        // lecture, les filtres ne peuvent pas être poussés dans la requête Mongo.
        return dtos.filter(
            (dto) =>
                (!filter.validation || dto.validationStatus === filter.validation) &&
                (!filter.missing || dto.attendanceProgress.missing > 0),
        );
    }

    async get(id: string): Promise<SeanceDetailDto> {
        const seance = await this.requireSeance(id);
        const roster = (await this.sessionRosters([seance])).get(seance.session_id) ?? [];
        const entries = roster.filter((entry) => this.isOnSeance(entry, seance, false));
        const [records, history] = await Promise.all([
            this.emargements.findBySeance(seance._id),
            this.history.findBySeance(seance._id),
        ]);
        const presenceById = new Map(entries.map((entry) => [entry.alternant._id, entry.presence]));
        return {
            ...this.toDto(
                seance,
                this.countsFrom(records),
                undefined,
                this.attendanceProgress(seance, entries, this.recordedHalvesFrom(records), new Date()),
            ),
            alternants: this.alternantsWithAttendance(
                entries.map((entry) => entry.alternant),
                records,
                true,
                presenceById,
            ),
            history: history.map(historyDto),
        };
    }

    // ── Exports (§8) ─────────────────────────────────────────────────────────

    /** Séances d'un export : une séance précise, sinon la période / la session demandée. */
    private async exportSeances(filter: EmargementExportFilter): Promise<Seance[]> {
        if (filter.seanceId) return [await this.requireSeance(filter.seanceId)];
        return this.seances.findAll({
            sessionId: filter.sessionId,
            from: filter.from,
            to: filter.to,
        });
    }

    /**
     * Export des présences et des heures : une ligne par alternant × demi-journée,
     * plus une synthèse par alternant (heures prévues / réalisées, absences).
     */
    async exportAttendance(filter: EmargementExportFilter = {}): Promise<AttendanceExportDto> {
        const seances = await this.exportSeances(filter);
        const records = await this.emargements.findBySeances(seances.map((s) => s._id));
        const byKey = new Map(records.map((r) => [`${r.seance_id}:${r.alternant_id}:${r.half}`, r]));
        const rosters = await this.sessionRosters(seances);
        const includeArchived = filter.includeArchived === true;
        const now = new Date();

        const rows: AttendanceExportRow[] = [];
        for (const seance of seances) {
            const roster = (rosters.get(seance.session_id) ?? []).filter((entry) =>
                this.isOnSeance(entry, seance, includeArchived),
            );
            const validations = validationsOf(seance);
            const validationStatus = this.validationStatus(seance, now);
            const closed = this.closedHalves(seance, now);
            for (const entry of roster) {
                const alternant = entry.alternant;
                for (const half of applicableHalves(seance)) {
                    const record = byKey.get(`${seance._id}:${alternant._id}:${half}`) ?? null;
                    rows.push({
                        seanceId: seance._id,
                        sessionId: seance.session_id,
                        date: seance.date,
                        startTime: seance.start_time,
                        endTime: seance.end_time,
                        sessionNom: seance.session_nom,
                        degreeTitle: seance.degree_title ?? null,
                        module: seance.module ?? null,
                        formateurName: seance.formateur_name,
                        site: seance.site,
                        mode: seance.mode,
                        validationStatus,
                        alternantId: alternant._id,
                        firstName: alternant.first_name,
                        lastName: alternant.last_name,
                        financeur: alternant.financeur ?? null,
                        presence: entry.presence,
                        half,
                        status: record?.status ?? 'na',
                        statusTime: record?.status_time ?? null,
                        signatureMode: record?.signature_mode ?? null,
                        signedAt: record ? toIso(record.signed_at) : null,
                        plannedMinutes: plannedMinutesOf(seance, half),
                        attendedMinutes: attendedMinutesOf(seance, half, record),
                        missing: closed.has(half) && (record?.status ?? 'na') === 'na',
                        validation: validationDto(validations[half]),
                    });
                }
            }
        }

        const halfOrder = (half: EmargementHalf) => (half === 'morning' ? 0 : 1);
        rows.sort(
            (a, b) =>
                a.date.localeCompare(b.date) ||
                a.startTime.localeCompare(b.startTime) ||
                a.lastName.localeCompare(b.lastName, 'fr') ||
                a.firstName.localeCompare(b.firstName, 'fr') ||
                halfOrder(a.half) - halfOrder(b.half),
        );

        const summaries = new Map<string, AttendanceExportSummary & { seanceIds: Set<string> }>();
        for (const row of rows) {
            let summary = summaries.get(row.alternantId);
            if (!summary) {
                summary = {
                    alternantId: row.alternantId,
                    firstName: row.firstName,
                    lastName: row.lastName,
                    financeur: row.financeur,
                    presence: row.presence,
                    sessions: 0,
                    halves: 0,
                    absences: 0,
                    missingHalves: 0,
                    plannedMinutes: 0,
                    attendedMinutes: 0,
                    seanceIds: new Set<string>(),
                };
                summaries.set(row.alternantId, summary);
            }
            // La dernière ligne vue (tri par date croissante) porte la situation la plus récente.
            summary.presence = row.presence;
            summary.seanceIds.add(row.seanceId);
            summary.halves += 1;
            if (row.status === 'absent') summary.absences += 1;
            if (row.missing) summary.missingHalves += 1;
            summary.plannedMinutes += row.plannedMinutes;
            summary.attendedMinutes += row.attendedMinutes;
        }

        return {
            generatedAt: new Date().toISOString(),
            from: filter.from ?? null,
            to: filter.to ?? null,
            sessionId: filter.sessionId ?? null,
            seanceId: filter.seanceId ?? null,
            rows,
            summaries: [...summaries.values()]
                .map(({ seanceIds, ...rest }) => ({ ...rest, sessions: seanceIds.size }))
                .sort(
                    (a, b) =>
                        a.lastName.localeCompare(b.lastName, 'fr') || a.firstName.localeCompare(b.firstName, 'fr'),
                ),
        };
    }

    /** Export du journal append-only (lot 5) : qui a changé quoi, quand et pourquoi. */
    async exportHistory(filter: EmargementExportFilter = {}): Promise<HistoryExportDto> {
        const seances = await this.exportSeances(filter);
        const byId = new Map(seances.map((s) => [s._id, s]));
        const entries = filter.seanceId
            ? await this.history.findBySeance(filter.seanceId, HISTORY_EXPORT_LIMIT)
            : await this.history.findBySeances(seances.map((s) => s._id));

        const rows: HistoryExportRow[] = entries.map((entry) => {
            const seance = byId.get(entry.seance_id);
            return {
                at: toIso(entry.at)!,
                seanceId: entry.seance_id,
                date: seance?.date ?? '',
                sessionNom: seance?.session_nom ?? '',
                action: entry.action,
                alternantName: entry.alternant_name ?? null,
                half: entry.half ?? null,
                fromStatus: entry.from_status ?? null,
                toStatus: entry.to_status ?? null,
                fromStatusTime: entry.from_status_time ?? null,
                toStatusTime: entry.to_status_time ?? null,
                source: entry.source,
                actorName: entry.actor_name ?? null,
                note: entry.note ?? null,
            };
        });

        return {
            generatedAt: new Date().toISOString(),
            from: filter.from ?? null,
            to: filter.to ?? null,
            sessionId: filter.sessionId ?? null,
            seanceId: filter.seanceId ?? null,
            rows,
        };
    }

    /**
     * Synthèse d'un groupe : une ligne par alternant de la session, heures
     * prévues / réalisées sur la période. Sert le PDF « par groupe » (§8.1).
     */
    async groupSummary(sessionId: string, filter: { from?: string; to?: string } = {}): Promise<GroupSummaryDto> {
        const session = await this.sessions.findById(sessionId);
        if (!session) throw httpError(404, 'session', 'Session introuvable');
        const data = await this.exportAttendance({ sessionId, from: filter.from, to: filter.to });
        const dates = data.rows.map((row) => row.date).sort();
        return {
            generatedAt: new Date().toISOString(),
            sessionId,
            sessionNom: data.rows[0]?.sessionNom ?? session.nom,
            degreeTitle: data.rows.find((row) => row.degreeTitle)?.degreeTitle ?? null,
            from: filter.from ?? dates[0] ?? null,
            to: filter.to ?? dates[dates.length - 1] ?? null,
            plannedMinutes: data.summaries.reduce((sum, row) => sum + row.plannedMinutes, 0),
            attendedMinutes: data.summaries.reduce((sum, row) => sum + row.attendedMinutes, 0),
            rows: data.summaries,
        };
    }

    /**
     * Attestation d'assiduité d'un alternant : séances de sa session sur la
     * période, heures prévues / réalisées et statut de validation de chaque
     * demi-journée. Les alternants archivés restent exportables (historique).
     */
    async attestation(alternantId: string, filter: { from?: string; to?: string } = {}): Promise<AttestationDto> {
        const alternant = await this.alternants.findById(alternantId);
        if (!alternant) throw httpError(404, 'alternant', 'Alternant introuvable');
        const sessionId = alternant.session_id ?? alternant.filiz?.class_id ?? null;
        if (!sessionId) {
            throw httpError(400, 'session', 'Cet alternant n’est rattaché à aucune session');
        }

        const seances = await this.seances.findAll({ sessionId, from: filter.from, to: filter.to });
        const records = await this.emargements.findByAlternant(
            alternantId,
            seances.map((s) => s._id),
        );
        const byKey = new Map(records.map((r) => [`${r.seance_id}:${r.half}`, r]));
        const now = new Date();

        const attestationSeances: AttestationSeanceDto[] = seances
            .slice()
            .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))
            .map((seance) => {
                const validations = validationsOf(seance);
                const closed = this.closedHalves(seance, now);
                const halves = applicableHalves(seance).map((half) => {
                    const record = byKey.get(`${seance._id}:${half}`) ?? null;
                    return {
                        half,
                        status: record?.status ?? ('na' as EmargementStatus),
                        statusTime: record?.status_time ?? null,
                        plannedMinutes: plannedMinutesOf(seance, half),
                        attendedMinutes: attendedMinutesOf(seance, half, record),
                        missing: closed.has(half) && (record?.status ?? 'na') === 'na',
                        validation: validationDto(validations[half]),
                    };
                });
                return {
                    seanceId: seance._id,
                    date: seance.date,
                    startTime: seance.start_time,
                    endTime: seance.end_time,
                    module: seance.module ?? null,
                    validationStatus: this.validationStatus(seance, now),
                    plannedMinutes: halves.reduce((sum, half) => sum + half.plannedMinutes, 0),
                    attendedMinutes: halves.reduce((sum, half) => sum + half.attendedMinutes, 0),
                    halves,
                };
            });

        const dates = attestationSeances.map((s) => s.date).sort();
        return {
            generatedAt: new Date().toISOString(),
            alternantId: alternant._id,
            firstName: alternant.first_name,
            lastName: alternant.last_name,
            financeur: alternant.financeur ?? null,
            sessionNom: seances[0]?.session_nom ?? alternant.session ?? '',
            degreeTitle: seances.find((s) => s.degree_title)?.degree_title ?? null,
            from: filter.from ?? dates[0] ?? null,
            to: filter.to ?? dates[dates.length - 1] ?? null,
            plannedMinutes: attestationSeances.reduce((sum, s) => sum + s.plannedMinutes, 0),
            attendedMinutes: attestationSeances.reduce((sum, s) => sum + s.attendedMinutes, 0),
            seances: attestationSeances,
        };
    }

    // ── Assiduité (7.1 / 7.2) ────────────────────────────────────────────────

    /**
     * Tableau de bord d'assiduité : les mêmes lignes que l'export de présences,
     * agrégées par alternant, par session et par site. Le taux est calculé sur
     * les heures prévues des créneaux applicables ; `missingHalves` signale les
     * demi-journées fermées sans statut, qui dégradent artificiellement le taux.
     */
    async assiduite(filter: AssiduiteFilter = {}): Promise<AssiduiteDto> {
        const data = await this.exportAttendance({
            from: filter.from,
            to: filter.to,
            sessionId: filter.sessionId,
        });
        const rows = filter.site ? data.rows.filter((row) => row.site === filter.site) : data.rows;

        const totals = emptyAccumulator();
        const alternants = new Map<string, AssiduiteAccumulator & { row: AttendanceExportRow; lastDate: string }>();
        const sessions = new Map<string, AssiduiteAccumulator & { label: string }>();
        const sites = new Map<string, AssiduiteAccumulator & { label: string }>();

        for (const row of rows) {
            accumulateRow(totals, row);

            const alternant = alternants.get(row.alternantId) ?? {
                ...emptyAccumulator(),
                row,
                lastDate: row.date,
            };
            accumulateRow(alternant, row);
            if (row.date > alternant.lastDate) alternant.lastDate = row.date;
            alternants.set(row.alternantId, alternant);

            const session = sessions.get(row.sessionId) ?? { ...emptyAccumulator(), label: row.sessionNom };
            accumulateRow(session, row);
            sessions.set(row.sessionId, session);

            const site = sites.get(row.site) ?? { ...emptyAccumulator(), label: row.site };
            accumulateRow(site, row);
            sites.set(row.site, site);
        }

        return {
            generatedAt: new Date().toISOString(),
            from: filter.from ?? null,
            to: filter.to ?? null,
            sessionId: filter.sessionId ?? null,
            site: filter.site ?? null,
            totals: totalsFrom(totals),
            alternants: [...alternants.entries()]
                .map(([alternantId, acc]) => ({
                    ...totalsFrom(acc),
                    key: alternantId,
                    label: `${acc.row.lastName} ${acc.row.firstName}`,
                    alternantId,
                    firstName: acc.row.firstName,
                    lastName: acc.row.lastName,
                    financeur: acc.row.financeur,
                    sessions: acc.sessionIds.size,
                    lastSeanceDate: acc.lastDate,
                    presence: acc.row.presence,
                }))
                .sort(
                    (a, b) =>
                        a.lastName.localeCompare(b.lastName, 'fr') || a.firstName.localeCompare(b.firstName, 'fr'),
                ),
            sessions: [...sessions.entries()]
                .map(([key, acc]) => ({ ...totalsFrom(acc), key, label: acc.label }))
                .sort((a, b) => a.label.localeCompare(b.label, 'fr')),
            sites: [...sites.entries()]
                .map(([key, acc]) => ({ ...totalsFrom(acc), key, label: acc.label }))
                .sort((a, b) => a.label.localeCompare(b.label, 'fr')),
        };
    }

    /**
     * Assiduité d'un alternant : synthèse sur la période et détail séance par
     * séance. Repose sur l'attestation pour que la fiche, le PDF et le tableau
     * de bord racontent exactement la même chose.
     */
    async assiduiteAlternant(
        alternantId: string,
        filter: { from?: string; to?: string } = {},
    ): Promise<AssiduiteAlternantDto> {
        const alternant = await this.alternants.findById(alternantId);
        if (!alternant) throw httpError(404, 'alternant', 'Alternant introuvable');
        const [data, ruptures] = await Promise.all([
            this.attestation(alternantId, filter),
            this.ruptures.findByAlternantId(alternantId),
        ]);

        const acc = emptyAccumulator();
        for (const seance of data.seances) {
            acc.seanceIds.add(seance.seanceId);
            acc.plannedMinutes += seance.plannedMinutes;
            acc.attendedMinutes += seance.attendedMinutes;
            for (const half of seance.halves) {
                if (half.status !== 'na') acc.halves += 1;
                if (half.status === 'absent') acc.absences += 1;
                if (half.missing) acc.missingHalves += 1;
            }
        }

        return {
            generatedAt: new Date().toISOString(),
            alternantId: data.alternantId,
            firstName: data.firstName,
            lastName: data.lastName,
            financeur: data.financeur,
            sessionNom: data.sessionNom,
            degreeTitle: data.degreeTitle,
            presence: presenceOf(alternant, ruptures, tenantTimezone()),
            from: data.from,
            to: data.to,
            totals: totalsFrom(acc),
            seances: data.seances,
        };
    }

    async create(input: unknown, userId: number | undefined): Promise<CreatedSeance> {
        const parsed = this.parseSeanceInput(input);
        const session = await this.sessions.findById(parsed.sessionId);
        if (!session) throw httpError(404, 'session', 'Session introuvable');

        const timezone = tenantTimezone();
        const seance = await this.seances.create({
            session_id: parsed.sessionId,
            session_nom: session.nom,
            degree_title: session.filiere ?? null,
            module: parsed.module ?? null,
            location: parsed.location ?? null,
            date: parsed.date,
            start_time: parsed.startTime!,
            end_time: parsed.endTime!,
            morning_class_start: parsed.morningClassStart,
            morning_class_end: parsed.morningClassEnd,
            afternoon_class_start: parsed.afternoonClassStart ?? null,
            afternoon_class_end: parsed.afternoonClassEnd ?? null,
            site: parsed.site as SeanceSite,
            mode: parsed.mode as SeanceMode,
            formateur_name: parsed.formateurName,
            formateur_email: parsed.formateurEmail,
            morning_start: parsed.morningStart,
            morning_end: parsed.morningEnd,
            afternoon_start: parsed.afternoonStart ?? null,
            afternoon_end: parsed.afternoonEnd ?? null,
            timezone,
            token_secret: generateSignature(),
            invite_expires_at: linksExpiry(parsed.date, timezone),
            validations: { morning: null, afternoon: null },
            validated_by: null,
            validation_note: null,
            created_by: userId ?? null,
        });

        const links = this.links(seance);
        const inviteSent = await this.sendInvite(seance, links.formateurUrl, userId);
        await this.logHistory({
            seance_id: seance._id,
            alternant_id: null,
            alternant_name: null,
            half: null,
            action: 'seance_created',
            from_status: null,
            to_status: null,
            from_status_time: null,
            to_status_time: null,
            source: 'peda',
            actor_name: await this.actorName(userId),
            note: null,
            ip: null,
            user_agent: null,
        });
        logger.info(
            { seanceId: seance._id, sessionId: seance.session_id, userId, inviteSent },
            'Emargement séance created',
        );

        return { seance: this.toDto(seance, undefined, links), inviteSent };
    }

    async update(id: string, input: unknown): Promise<SeanceDto> {
        const current = await this.requireSeance(id);
        if (this.hasAnyValidation(current)) {
            throw httpError(409, 'signed', 'Une feuille dont une demi-journée est validée ne peut plus être modifiée');
        }

        const patch = asRecord(input);
        // Une séance antérieure au lot 8 n'a pas d'horaires de cours : on reprend
        // alors son créneau de signature (celui du patch s'il change) pour ne pas
        // changer ses heures.
        const effectiveMorningStart = patch.morningStart ?? current.morning_start;
        const effectiveMorningEnd = patch.morningEnd ?? current.morning_end;
        const effectiveAfternoonStart =
            patch.afternoonStart !== undefined ? patch.afternoonStart : current.afternoon_start;
        const effectiveAfternoonEnd = patch.afternoonEnd !== undefined ? patch.afternoonEnd : current.afternoon_end;
        const merged = this.parseSeanceInput({
            sessionId: patch.sessionId ?? current.session_id,
            date: patch.date ?? current.date,
            site: patch.site ?? current.site,
            mode: patch.mode ?? current.mode,
            formateurName: patch.formateurName ?? current.formateur_name,
            formateurEmail: patch.formateurEmail ?? current.formateur_email,
            morningClassStart: patch.morningClassStart ?? current.morning_class_start ?? effectiveMorningStart,
            morningClassEnd: patch.morningClassEnd ?? current.morning_class_end ?? effectiveMorningEnd,
            afternoonClassStart:
                patch.afternoonClassStart !== undefined
                    ? patch.afternoonClassStart
                    : (current.afternoon_class_start ?? effectiveAfternoonStart),
            afternoonClassEnd:
                patch.afternoonClassEnd !== undefined
                    ? patch.afternoonClassEnd
                    : (current.afternoon_class_end ?? effectiveAfternoonEnd),
            morningStart: effectiveMorningStart,
            morningEnd: effectiveMorningEnd,
            afternoonStart: effectiveAfternoonStart,
            afternoonEnd: effectiveAfternoonEnd,
            module: patch.module !== undefined ? patch.module : current.module,
            location: patch.location !== undefined ? patch.location : current.location,
        });

        let sessionNom = current.session_nom;
        let degreeTitle = current.degree_title ?? null;
        if (merged.sessionId !== current.session_id) {
            const session = await this.sessions.findById(merged.sessionId);
            if (!session) throw httpError(404, 'session', 'Session introuvable');
            sessionNom = session.nom;
            // Le titre pro suit la nouvelle promo : sans ça la feuille garderait
            // l'intitulé de la formation précédente.
            degreeTitle = session.filiere ?? null;
        }

        const updated = await this.seances.update(id, {
            session_id: merged.sessionId,
            session_nom: sessionNom,
            degree_title: degreeTitle,
            module: merged.module ?? null,
            location: merged.location ?? null,
            date: merged.date,
            start_time: merged.startTime!,
            end_time: merged.endTime!,
            morning_class_start: merged.morningClassStart,
            morning_class_end: merged.morningClassEnd,
            afternoon_class_start: merged.afternoonClassStart ?? null,
            afternoon_class_end: merged.afternoonClassEnd ?? null,
            site: merged.site,
            mode: merged.mode,
            formateur_name: merged.formateurName,
            formateur_email: merged.formateurEmail,
            morning_start: merged.morningStart,
            morning_end: merged.morningEnd,
            afternoon_start: merged.afternoonStart ?? null,
            afternoon_end: merged.afternoonEnd ?? null,
            invite_expires_at: linksExpiry(merged.date, current.timezone),
        });
        if (!updated) throw httpError(404, 'not_found', 'Séance introuvable');

        // Une fenêtre retirée (après-midi supprimé) invalide les statuts saisis
        // sur ce demi-journée : on les supprime plutôt que de les laisser orphelins.
        if (!updated.afternoon_start) await this.deleteAfternoonAttendance(updated._id);

        return this.toDto(updated);
    }

    async remove(id: string): Promise<void> {
        const seance = await this.requireSeance(id);
        // Suppression toujours possible, même validée : une feuille créée par
        // erreur doit pouvoir disparaître (la confirmation côté Peda rappelle que
        // statuts, signatures et journal sont perdus avec elle).
        await this.emargements.deleteBySeance(seance._id);
        await this.history.deleteBySeance(seance._id);
        await this.seances.delete(seance._id);
    }

    /** Renvoie (et éventuellement régénère) les liens sans renvoyer la séance entière. */
    async resendInvite(id: string, rotate: boolean, senderId?: number): Promise<InviteResult> {
        const seance = await this.requireSeance(id);
        // Une feuille partiellement signée reste renvoyable : c'est le moyen de
        // donner au formateur un lien valide pour signer la demi-journée manquante.
        if (this.isFullyValidated(seance)) throw httpError(409, 'signed', 'Feuille d’émargement déjà validée');

        // Un renvoi est une action explicite du Peda : il prolonge la validité du
        // lien, sinon on renverrait un lien déjà expiré après le délai de
        // régularisation (J+7). `rotate` révoque en plus les liens précédents.
        const current = await this.seances.update(id, {
            invite_expires_at: linksExpiry(seance.date, seance.timezone),
            ...(rotate ? { token_secret: generateSignature() } : {}),
        });
        if (!current) throw httpError(404, 'not_found', 'Séance introuvable');
        const links = this.links(current);
        const inviteSent = await this.sendInvite(current, links.formateurUrl, senderId);
        return { links, inviteSent };
    }

    // ── Côté formateur (lien public) ─────────────────────────────────────────

    async formateurView(token: string): Promise<FormateurViewDto> {
        const seance = await this.loadByToken(token, 'formateur');
        const [alternants, records] = await Promise.all([
            this.sessions.findAlternants(seance.session_id),
            this.emargements.findBySeance(seance._id),
        ]);
        const now = new Date();
        const expired = this.isExpired(seance);
        const validations = validationsOf(seance);
        const editableHalves = this.editableHalves(seance, now);

        return {
            seance: {
                id: seance._id,
                sessionNom: seance.session_nom,
                degreeTitle: seance.degree_title ?? null,
                module: seance.module ?? null,
                location: seance.location ?? null,
                date: seance.date,
                startTime: seance.start_time,
                endTime: seance.end_time,
                morningClassStart: seance.morning_class_start ?? null,
                morningClassEnd: seance.morning_class_end ?? null,
                afternoonClassStart: seance.afternoon_class_start ?? null,
                afternoonClassEnd: seance.afternoon_class_end ?? null,
                site: seance.site,
                mode: seance.mode,
                formateurName: seance.formateur_name,
                validations: {
                    morning: validationDto(validations.morning),
                    afternoon: validationDto(validations.afternoon),
                },
                validationStatus: this.validationStatus(seance, now),
                qrUrl: this.links(seance).qrUrl,
            },
            alternants: this.alternantsWithAttendance(alternants, records, false),
            serverNow: now.toISOString(),
            openHalf: this.openHalf(seance, now),
            windows: {
                morning: this.windowDto(seance, 'morning', now)!,
                afternoon: this.windowDto(seance, 'afternoon', now),
            },
            expired,
            canEdit: editableHalves.length > 0,
            editableHalves,
            signableHalves: this.signableHalves(seance, now),
        };
    }

    async setAttendance(token: string, input: unknown, meta: ClientMeta): Promise<EmargementRecordDto> {
        const seance = await this.loadByToken(token, 'formateur');

        const body = asRecord(input);
        const alternantId = requiredString(body.alternantId, 'L’alternant');
        const half = enumValue(body.half, EMARGEMENT_HALVES, 'La demi-journée');
        const status = enumValue(body.status, EMARGEMENT_STATUSES, 'Le statut');
        this.assertHalfEditable(seance, half);

        const alternants = await this.sessions.findAlternants(seance.session_id);
        const alternant = alternants.find((a) => a._id === alternantId);
        if (!alternant) throw httpError(404, 'alternant', 'Alternant introuvable dans cette session');
        if (half === 'afternoon' && !seance.afternoon_start) {
            throw httpError(400, 'window', 'Cette séance n’a pas de créneau l’après-midi');
        }

        let statusTime: string | null = null;
        if (status === 'late' || status === 'left_early') {
            statusTime = requiredTime(body.statusTime, 'L’heure');
        }

        const previous = await this.emargements.findOne(seance._id, alternantId, half);
        const record = await this.emargements.upsert(seance._id, {
            alternantId,
            firstName: alternant.first_name,
            lastName: alternant.last_name,
            half,
            status,
            statusTime,
            signatureMode: 'manual',
            signatureImage: null,
            signedAt: new Date(),
            ip: meta.ip,
            userAgent: meta.userAgent,
        });
        // Une réécriture identique (le formateur rouvre la même valeur) n'est pas
        // un changement : on n'encombre pas le journal.
        const fromStatus = previous?.status ?? null;
        const fromStatusTime = previous?.status_time ?? null;
        if (fromStatus !== record.status || fromStatusTime !== record.status_time) {
            await this.logHistory({
                seance_id: seance._id,
                alternant_id: alternantId,
                alternant_name: `${alternant.first_name} ${alternant.last_name}`.trim(),
                half,
                action: 'attendance_set',
                from_status: fromStatus,
                to_status: record.status,
                from_status_time: fromStatusTime,
                to_status_time: record.status_time ?? null,
                source: 'formateur',
                actor_name: seance.formateur_name,
                note: null,
                ip: meta.ip,
                user_agent: meta.userAgent,
            });
        }
        return this.recordDto(record);
    }

    /**
     * Repli quand l'alternant ne peut pas utiliser son téléphone : il trace sa
     * signature sur l'appareil du formateur. La preuve reste la même (horodatage
     * serveur + IP/appareil du formateur + tracé), avec `signature_mode`
     * `handwritten` et l'image conservée sur la feuille.
     */
    async signAttendanceManually(token: string, input: unknown, meta: ClientMeta): Promise<EmargementRecordDto> {
        const seance = await this.loadByToken(token, 'formateur');

        const body = asRecord(input);
        const alternantId = requiredString(body.alternantId, 'L’alternant');
        const half = enumValue(body.half, EMARGEMENT_HALVES, 'La demi-journée');
        this.assertHalfEditable(seance, half);
        const signature = requireSignatureImage(body.signature);
        if (half === 'afternoon' && !seance.afternoon_start) {
            throw httpError(400, 'window', 'Cette séance n’a pas de créneau l’après-midi');
        }

        const alternants = await this.sessions.findAlternants(seance.session_id);
        const alternant = alternants.find((a) => a._id === alternantId);
        if (!alternant) throw httpError(404, 'alternant', 'Alternant introuvable dans cette session');

        const previous = await this.emargements.findOne(seance._id, alternantId, half);
        const record = await this.emargements.upsert(seance._id, {
            alternantId,
            firstName: alternant.first_name,
            lastName: alternant.last_name,
            half,
            status: 'present',
            statusTime: null,
            signatureMode: 'handwritten',
            signatureImage: signature,
            signedAt: new Date(),
            ip: meta.ip,
            userAgent: meta.userAgent,
        });
        await this.logHistory({
            seance_id: seance._id,
            alternant_id: alternantId,
            alternant_name: `${alternant.first_name} ${alternant.last_name}`.trim(),
            half,
            action: 'attendance_signed',
            from_status: previous?.status ?? null,
            to_status: record.status,
            from_status_time: previous?.status_time ?? null,
            to_status_time: record.status_time ?? null,
            source: 'formateur',
            actor_name: seance.formateur_name,
            note: null,
            ip: meta.ip,
            user_agent: meta.userAgent,
        });
        logger.info({ seanceId: seance._id, alternantId, half }, 'Emargement handwritten signature recorded');
        return this.recordDto(record);
    }

    /**
     * Signature d'une demi-journée par le formateur. Elle n'est ouverte qu'après
     * la fermeture du créneau correspondant : signer le matin à 9 h puis saisir
     * une absence à 10 h rendrait la signature mensongère. Chaque demi-journée
     * signée est verrouillée séparément, l'autre reste éditable.
     */
    async signSheet(token: string, input: unknown, meta: ClientMeta): Promise<SignSheetResult> {
        const seance = await this.loadByToken(token, 'formateur');
        if (this.isExpired(seance)) throw httpError(410, 'expired', 'Ce lien a expiré');

        const body = asRecord(input);
        const half = enumValue(body.half, EMARGEMENT_HALVES, 'La demi-journée');
        if (half === 'afternoon' && !seance.afternoon_start) {
            throw httpError(400, 'window', 'Cette séance n’a pas de créneau l’après-midi');
        }
        if (validationsOf(seance)[half]) {
            throw httpError(409, 'signed', 'Cette demi-journée est déjà signée');
        }

        const window = this.halfWindow(seance, half)!;
        if (Date.now() <= window.end.getTime()) {
            const end = half === 'morning' ? seance.morning_end : seance.afternoon_end;
            throw httpError(
                409,
                'window',
                `La signature de la demi-journée sera possible après la fermeture du créneau (${end})`,
            );
        }

        if (body.confirmed !== true) {
            throw httpError(400, 'validation', 'La confirmation du formateur est requise');
        }
        const signature = requireSignatureImage(body.signature);

        const signedAt = new Date();
        const validation: SeanceValidation = {
            signed_at: signedAt,
            signed_by_name: seance.formateur_name,
            source: 'formateur',
            signature_image: signature,
            signed_ip: meta.ip,
            signed_user_agent: meta.userAgent,
        };
        const updated = await this.seances.update(seance._id, { [`validations.${half}`]: validation });
        if (!updated) throw httpError(404, 'not_found', 'Séance introuvable');
        await this.logHistory({
            seance_id: seance._id,
            alternant_id: null,
            alternant_name: null,
            half,
            action: 'half_signed',
            from_status: null,
            to_status: null,
            from_status_time: null,
            to_status_time: null,
            source: 'formateur',
            actor_name: seance.formateur_name,
            note: null,
            ip: meta.ip,
            user_agent: meta.userAgent,
        });
        logger.info({ seanceId: seance._id, half }, 'Emargement half-day signed');

        return { half, signedAt: signedAt.toISOString(), signedByName: seance.formateur_name };
    }

    /**
     * Validation de régularisation par le service pédagogique : quand le lien a
     * expiré (J+7) et qu'une demi-journée n'est pas signée, la feuille serait
     * sinon bloquée pour toujours. Le motif est obligatoire et tracé, les
     * demi-journées manquantes sont marquées `source: 'peda'` (sans tracé).
     */
    async validate(id: string, input: unknown, userId: number | undefined, meta: ClientMeta): Promise<SeanceDetailDto> {
        const seance = await this.requireSeance(id);
        const now = new Date();
        if (this.isFullyValidated(seance)) {
            throw httpError(409, 'signed', 'Cette feuille est déjà validée');
        }
        const notClosed = applicableHalves(seance).filter(
            (half) => this.windowDto(seance, half, now)?.state !== 'closed',
        );
        if (notClosed.length) {
            throw httpError(
                409,
                'window',
                'La feuille ne peut être validée qu’après la fermeture de tous les créneaux',
            );
        }

        const note = requiredString(asRecord(input).note, 'Le motif de la validation', 500);
        const user = userId != null ? await this.users.findById(userId) : null;
        const validatorName = user ? `${user.firstName} ${user.lastName}`.trim() : 'Service pédagogique';

        const patch: Record<string, unknown> = { validated_by: userId ?? null, validation_note: note };
        const validations = validationsOf(seance);
        const validatedHalves: EmargementHalf[] = [];
        for (const half of applicableHalves(seance)) {
            if (validations[half]) continue;
            const validation: SeanceValidation = {
                signed_at: now,
                signed_by_name: validatorName,
                source: 'peda',
                signature_image: null,
                signed_ip: meta.ip,
                signed_user_agent: meta.userAgent,
            };
            patch[`validations.${half}`] = validation;
            validatedHalves.push(half);
        }

        const updated = await this.seances.update(id, patch);
        if (!updated) throw httpError(404, 'not_found', 'Séance introuvable');
        for (const half of validatedHalves) {
            await this.logHistory({
                seance_id: seance._id,
                alternant_id: null,
                alternant_name: null,
                half,
                action: 'half_validated',
                from_status: null,
                to_status: null,
                from_status_time: null,
                to_status_time: null,
                source: 'peda',
                actor_name: validatorName,
                note,
                ip: meta.ip,
                user_agent: meta.userAgent,
            });
        }
        logger.info({ seanceId: id, userId, note }, 'Emargement sheet validated by Peda');

        return this.get(id);
    }

    // ── Côté alternant (QR code) ─────────────────────────────────────────────

    async publicSigning(token: string): Promise<PublicSigningDto> {
        const seance = await this.loadByToken(token, 'qr');
        const now = new Date();
        return {
            sessionNom: seance.session_nom,
            degreeTitle: seance.degree_title ?? null,
            module: seance.module ?? null,
            location: seance.location ?? null,
            date: seance.date,
            startTime: seance.start_time,
            endTime: seance.end_time,
            morningClassStart: seance.morning_class_start ?? null,
            morningClassEnd: seance.morning_class_end ?? null,
            afternoonClassStart: seance.afternoon_class_start ?? null,
            afternoonClassEnd: seance.afternoon_class_end ?? null,
            site: seance.site,
            mode: seance.mode,
            signed: this.isFullyValidated(seance),
            expired: this.isExpired(seance),
            serverNow: now.toISOString(),
            openHalf: this.openHalf(seance, now),
            windows: {
                morning: this.windowDto(seance, 'morning', now)!,
                afternoon: this.windowDto(seance, 'afternoon', now),
            },
        };
    }

    async signByQr(token: string, input: unknown, meta: ClientMeta): Promise<QrSignResult> {
        const seance = await this.loadByToken(token, 'qr');
        if (this.isFullyValidated(seance)) {
            throw httpError(409, 'signed', 'La feuille d’émargement est déjà signée');
        }
        if (this.isExpired(seance)) throw httpError(410, 'expired', 'Ce lien a expiré');

        const body = asRecord(input);
        if (!isEmail(body.email)) {
            throw httpError(400, 'email', 'Une adresse e-mail valide est requise');
        }
        const email = normalizeEmail(body.email);
        // La confirmation de présence vaut signature : le tracé de l'alternant est
        // conservé sur la feuille (et repris par les exports PDF), comme le repli
        // `handwritten` tracé sur l'appareil du formateur.
        const signature = requireSignatureImage(body.signature);

        const now = new Date();
        const half = this.openHalf(seance, now);
        if (!half) {
            throw httpError(409, 'window', 'La fenêtre d’émargement est fermée');
        }
        if (validationsOf(seance)[half]) {
            throw httpError(409, 'signed', 'Cette demi-journée est déjà signée');
        }

        const alternants = await this.sessions.findAlternants(seance.session_id);
        const alternant = alternants.find((a) => a.email && normalizeEmail(a.email) === email);
        if (!alternant) {
            // Message volontairement générique : ne pas révéler si l'e-mail existe ailleurs.
            throw httpError(404, 'alternant', 'Cette adresse ne correspond à aucun alternant de la session');
        }

        const existing = await this.emargements.findOne(seance._id, alternant._id, half);
        if (existing && existing.status === 'present' && existing.signature_mode === 'qr') {
            return {
                fullName: `${alternant.first_name} ${alternant.last_name}`.trim(),
                half,
                signedAt: toIso(existing.signed_at)!,
                alreadySigned: true,
            };
        }

        const record = await this.emargements.upsert(seance._id, {
            alternantId: alternant._id,
            firstName: alternant.first_name,
            lastName: alternant.last_name,
            half,
            status: 'present',
            statusTime: null,
            signatureMode: 'qr',
            signatureImage: signature,
            signedAt: now,
            ip: meta.ip,
            userAgent: meta.userAgent,
        });

        const fullName = `${alternant.first_name} ${alternant.last_name}`.trim();
        await this.logHistory({
            seance_id: seance._id,
            alternant_id: alternant._id,
            alternant_name: fullName,
            half,
            action: 'qr_signed',
            from_status: existing?.status ?? null,
            to_status: record.status,
            from_status_time: existing?.status_time ?? null,
            to_status_time: record.status_time ?? null,
            source: 'alternant',
            actor_name: fullName,
            note: null,
            ip: meta.ip,
            user_agent: meta.userAgent,
        });

        return {
            fullName,
            half,
            signedAt: toIso(record.signed_at)!,
            alreadySigned: false,
        };
    }

    // ── Interne ──────────────────────────────────────────────────────────────

    private parseSeanceInput(input: unknown): CreateSeanceInput & { site: SeanceSite; mode: SeanceMode } {
        const data = asRecord(input);
        const sessionId = requiredString(data.sessionId, 'La session');
        const date = requiredString(data.date, 'La date');
        if (!isIsoDate(date)) throw httpError(400, 'validation', 'La date doit être au format AAAA-MM-JJ');

        // Horaires de cours : ils portent les heures prévues / réalisées, pause
        // déjeuner exclue. Les horaires globaux de la séance en sont dérivés, ils
        // ne sont plus saisis.
        const morningClassStart = requiredTime(data.morningClassStart, 'Le début des cours du matin');
        const morningClassEnd = requiredTime(data.morningClassEnd, 'La fin des cours du matin');
        if (minutesOfDay(morningClassStart) >= minutesOfDay(morningClassEnd)) {
            throw httpError(400, 'validation', 'Les horaires de cours du matin sont invalides');
        }

        const afternoonClassStart = optionalTime(data.afternoonClassStart, 'Le début des cours de l’après-midi');
        const afternoonClassEnd = optionalTime(data.afternoonClassEnd, 'La fin des cours de l’après-midi');
        if ((afternoonClassStart === null) !== (afternoonClassEnd === null)) {
            throw httpError(400, 'validation', 'Les deux horaires de cours de l’après-midi doivent être renseignés');
        }
        if (
            afternoonClassStart &&
            afternoonClassEnd &&
            minutesOfDay(afternoonClassStart) >= minutesOfDay(afternoonClassEnd)
        ) {
            throw httpError(400, 'validation', 'Les horaires de cours de l’après-midi sont invalides');
        }
        if (afternoonClassStart && minutesOfDay(morningClassEnd) > minutesOfDay(afternoonClassStart)) {
            throw httpError(400, 'validation', 'Les horaires de cours du matin et de l’après-midi se chevauchent');
        }

        const startTime = morningClassStart;
        const endTime = afternoonClassEnd ?? morningClassEnd;

        const morningStart = requiredTime(data.morningStart, 'Le début du créneau du matin');
        const morningEnd = requiredTime(data.morningEnd, 'La fin du créneau du matin');
        if (minutesOfDay(morningStart) >= minutesOfDay(morningEnd)) {
            throw httpError(400, 'validation', 'Le créneau du matin est invalide');
        }
        // Les créneaux sont des fenêtres *à l'intérieur* de la demi-journée de
        // cours : sans cette borne, on pouvait ouvrir la signature avant le début
        // du cours et la laisser ouverte après la fin (la fermeture du créneau ne
        // protégeait alors plus rien).
        assertWindowInsideSeance(morningStart, morningEnd, morningClassStart, morningClassEnd, 'du matin');

        const afternoonStart = optionalTime(data.afternoonStart, 'Le début du créneau de l’après-midi');
        const afternoonEnd = optionalTime(data.afternoonEnd, 'La fin du créneau de l’après-midi');
        if ((afternoonStart === null) !== (afternoonEnd === null)) {
            throw httpError(400, 'validation', 'Les deux horaires de l’après-midi doivent être renseignés');
        }
        if (afternoonStart && afternoonEnd && minutesOfDay(afternoonStart) >= minutesOfDay(afternoonEnd)) {
            throw httpError(400, 'validation', 'Le créneau de l’après-midi est invalide');
        }
        if (afternoonStart && afternoonEnd) {
            // Un créneau de signature ne peut pas exister sans cours l'après-midi :
            // les heures n'auraient plus de demi-journée à mesurer.
            if (!afternoonClassStart || !afternoonClassEnd) {
                throw httpError(
                    400,
                    'validation',
                    'Les horaires de cours de l’après-midi sont requis pour un créneau l’après-midi',
                );
            }
            assertWindowInsideSeance(
                afternoonStart,
                afternoonEnd,
                afternoonClassStart,
                afternoonClassEnd,
                'de l’après-midi',
            );
        }
        if (afternoonClassStart && !afternoonStart) {
            // L'inverse : des cours l'après-midi sans créneau ne produiraient jamais
            // d'heures (l'après-midi n'existerait pas pour la feuille).
            throw httpError(
                400,
                'validation',
                'Les horaires de cours de l’après-midi exigent un créneau de signature l’après-midi',
            );
        }

        const site = enumValue(data.site, SEANCE_SITES, 'Le site');
        const mode = enumValue(data.mode, SEANCE_MODES, 'La modalité');
        const formateurName = requiredString(data.formateurName, 'Le nom du formateur');
        const formateurEmail = requiredString(data.formateurEmail, 'L’e-mail du formateur');
        if (!isEmail(formateurEmail)) throw httpError(400, 'validation', 'L’e-mail du formateur est invalide');
        const module = optionalLabel(data.module, 'Le module / la séquence');
        const location = optionalLabel(data.location, 'Le lieu');

        return {
            sessionId,
            date,
            startTime,
            endTime,
            site,
            mode,
            formateurName,
            formateurEmail,
            morningClassStart,
            morningClassEnd,
            afternoonClassStart,
            afternoonClassEnd,
            morningStart,
            morningEnd,
            afternoonStart,
            afternoonEnd,
            module,
            location,
        };
    }

    private async requireSeance(id: string): Promise<Seance> {
        const seance = await this.seances.findById(id);
        if (!seance) throw httpError(404, 'not_found', 'Séance introuvable');
        return seance;
    }

    private async loadByToken(token: string, kind: SeanceTokenKind): Promise<Seance> {
        const parsed = parseSeanceToken(token);
        if (!parsed) throw httpError(404, 'not_found', 'Lien invalide');
        const seance = await this.seances.findById(parsed.seanceId);
        if (!seance || !verifySeanceToken(token, seance, kind)) {
            throw httpError(404, 'not_found', 'Lien invalide');
        }
        return seance;
    }

    /**
     * Écrit une entrée du journal. Le journal ne doit pas faire échouer l'action
     * métier (le statut, lui, est déjà enregistré) : une erreur d'écriture part
     * dans les logs serveur, jamais chez le client.
     */
    private async logHistory(input: RecordHistoryInput): Promise<void> {
        try {
            await this.history.record(input);
        } catch (error) {
            logger.error(
                { err: error, seanceId: input.seance_id, action: input.action },
                'Emargement history write failed',
            );
        }
    }

    /** Nom affichable d'un utilisateur Peda (`null` si l'id est absent ou inconnu). */
    private async actorName(userId: number | undefined): Promise<string | null> {
        if (userId == null) return null;
        const user = await this.users.findById(userId);
        return user ? `${user.firstName} ${user.lastName}`.trim() : null;
    }

    private isExpired(seance: Seance): boolean {
        return new Date(seance.invite_expires_at).getTime() < Date.now();
    }

    /** Une demi-journée validée est verrouillée ; l'autre reste éditable. */
    private assertHalfEditable(seance: Seance, half: EmargementHalf): void {
        if (this.isExpired(seance)) throw httpError(410, 'expired', 'Ce lien a expiré');
        if (validationsOf(seance)[half]) {
            throw httpError(409, 'signed', 'Cette demi-journée est déjà signée');
        }
    }

    private hasAnyValidation(seance: Seance): boolean {
        return applicableHalves(seance).some((half) => validationsOf(seance)[half] != null);
    }

    private isFullyValidated(seance: Seance): boolean {
        return applicableHalves(seance).every((half) => validationsOf(seance)[half] != null);
    }

    /** État affiché dans les listes : en cours, à valider, anomalie, validée. */
    private validationStatus(seance: Seance, now: Date): SeanceValidationStatus {
        const halves = applicableHalves(seance);
        const validations = validationsOf(seance);
        if (halves.every((half) => validations[half])) return 'validated';
        const allClosed = halves.every((half) => this.windowDto(seance, half, now)?.state === 'closed');
        if (!allClosed) return 'in_progress';
        // Tous les créneaux sont fermés mais une demi-journée reste non signée :
        // tant que le lien court (J+7), le formateur peut encore la signer.
        return this.isExpired(seance) ? 'anomaly' : 'to_validate';
    }

    /** Demi-journées encore modifiables (statuts, signature manuscrite). */
    private editableHalves(seance: Seance, _now: Date): EmargementHalf[] {
        if (this.isExpired(seance)) return [];
        const validations = validationsOf(seance);
        return applicableHalves(seance).filter((half) => !validations[half]);
    }

    /** Demi-journées signables : créneau fermé, non validées, lien encore valide. */
    private signableHalves(seance: Seance, now: Date): EmargementHalf[] {
        if (this.isExpired(seance)) return [];
        const validations = validationsOf(seance);
        return applicableHalves(seance).filter(
            (half) => !validations[half] && this.windowDto(seance, half, now)?.state === 'closed',
        );
    }

    private halfWindow(seance: Seance, half: EmargementHalf): { start: Date; end: Date } | null {
        const start = half === 'morning' ? seance.morning_start : seance.afternoon_start;
        const end = half === 'morning' ? seance.morning_end : seance.afternoon_end;
        if (!start || !end) return null;
        return {
            start: zonedDateTimeToUtc(seance.date, start, seance.timezone),
            end: zonedDateTimeToUtc(seance.date, end, seance.timezone),
        };
    }

    private openHalf(seance: Seance, now: Date): EmargementHalf | null {
        for (const half of EMARGEMENT_HALVES) {
            const window = this.halfWindow(seance, half);
            if (!window) continue;
            if (now >= window.start && now <= window.end) return half;
        }
        return null;
    }

    private windowDto(seance: Seance, half: EmargementHalf, now: Date): SeanceWindowDto | null {
        const window = this.halfWindow(seance, half);
        if (!window) return null;
        return {
            start: half === 'morning' ? seance.morning_start : seance.afternoon_start!,
            end: half === 'morning' ? seance.morning_end : seance.afternoon_end!,
            state: windowState(now, window.start, window.end),
        };
    }

    /** Demi-journées dont le créneau de signature est fermé : seules celles-là peuvent manquer. */
    private closedHalves(seance: Seance, now: Date): Set<EmargementHalf> {
        return new Set(
            applicableHalves(seance).filter((half) => this.windowDto(seance, half, now)?.state === 'closed'),
        );
    }

    private links(seance: Seance): SeanceLinks {
        const base = env.FRONTEND_BASE_URL.replace(/\/$/, '');
        return {
            formateurUrl: `${base}/emargement/formateur/${encodeURIComponent(buildSeanceToken(seance, 'formateur'))}`,
            qrUrl: `${base}/emargement/sign/${encodeURIComponent(buildSeanceToken(seance, 'qr'))}`,
        };
    }

    /**
     * Compteurs d'une séance détaillée : même définition que l'agrégat de
     * `EmargementRepository.countsBySeance` (une ligne non `na` = une
     * demi-journée saisie ; présent = présent/retard/parti en avance).
     */
    /**
     * Effectifs d'une session avec leur situation d'archivage, en une passe.
     * Les archivés sont chargés : une feuille passée doit garder ses sortis.
     */
    private async sessionRosters(seances: Seance[]): Promise<Map<string, RosterEntry[]>> {
        const sessionIds = [...new Set(seances.map((seance) => seance.session_id))];
        const entries = await Promise.all(
            sessionIds.map(async (sessionId) => {
                const alternants = await this.alternants.findBySessionOrFilizClassId(sessionId, true);
                const ruptures = await this.ruptures.findByAlternantIds(alternants.map((alternant) => alternant._id));
                const byAlternant = new Map<string, Rupture[]>();
                for (const rupture of ruptures) {
                    const list = byAlternant.get(rupture.alternant_id) ?? [];
                    list.push(rupture);
                    byAlternant.set(rupture.alternant_id, list);
                }
                const timezone =
                    seances.find((seance) => seance.session_id === sessionId)?.timezone ?? tenantTimezone();
                return [
                    sessionId,
                    alternants.map((alternant) => ({
                        alternant,
                        presence: presenceOf(alternant, byAlternant.get(alternant._id) ?? [], timezone),
                    })),
                ] as const;
            }),
        );
        return new Map(entries);
    }

    /**
     * Un alternant figure sur une feuille tant qu'il était dans la formation ce
     * jour-là ; `includeArchived` force la présence des sortis (export historique).
     */
    private isOnSeance(entry: RosterEntry, seance: Seance, includeArchived: boolean): boolean {
        if (!entry.presence.archived) return true;
        if (includeArchived) return true;
        return entry.presence.archiveDate !== null && entry.presence.archiveDate >= seance.date;
    }

    /** Statuts réellement saisis d'une feuille (« non renseigné » ne compte pas). */
    private recordedHalvesFrom(records: EmargementRecord[]): { morning: number; afternoon: number } {
        const counts = { morning: 0, afternoon: 0 };
        for (const record of records) {
            if (record.status !== 'na') counts[record.half] += 1;
        }
        return counts;
    }

    /**
     * Avancement de la saisie : les manques ne comptent que sur les créneaux
     * fermés (une demi-journée ouverte n'a pas encore à être remplie).
     */
    private attendanceProgress(
        seance: Seance,
        roster: RosterEntry[],
        recorded: { morning: number; afternoon: number } | undefined,
        now: Date,
    ): SeanceAttendanceProgressDto {
        const expected = roster.length;
        const progress: SeanceAttendanceProgressDto = {
            expected,
            morning: { expected, recorded: 0 },
            afternoon: { expected, recorded: 0 },
            missing: 0,
            missingHalves: [],
        };
        for (const half of applicableHalves(seance)) {
            const recordedForHalf = Math.min(recorded?.[half] ?? 0, expected);
            progress[half] = { expected, recorded: recordedForHalf };
            if (this.windowDto(seance, half, now)?.state !== 'closed') continue;
            const gap = expected - recordedForHalf;
            if (gap > 0) {
                progress.missing += gap;
                progress.missingHalves.push(half);
            }
        }
        return progress;
    }

    private countsFrom(records: EmargementRecord[]): { marked: number; present: number } {
        let marked = 0;
        let present = 0;
        for (const record of records) {
            if (record.status === 'na') continue;
            marked += 1;
            if (record.status !== 'absent') present += 1;
        }
        return { marked, present };
    }

    private recordDto(record: EmargementRecord): EmargementRecordDto {
        return {
            status: record.status,
            statusTime: record.status_time,
            signatureMode: record.signature_mode,
            signatureImage: record.signature_image ?? null,
            signedAt: toIso(record.signed_at)!,
            firstSignedAt: toIso(record.first_signed_at)!,
            firstSignatureMode: record.first_signature_mode,
        };
    }

    private alternantsWithAttendance(
        alternants: Alternant[],
        records: EmargementRecord[],
        includeEmail: boolean,
        presenceById?: Map<string, AlternantPresenceDto>,
    ): AlternantEmargementDto[] {
        const byKey = new Map(records.map((r) => [`${r.alternant_id}:${r.half}`, r]));
        return alternants.map((alternant) => {
            const morning = byKey.get(`${alternant._id}:morning`);
            const afternoon = byKey.get(`${alternant._id}:afternoon`);
            return {
                id: alternant._id,
                firstName: alternant.first_name,
                lastName: alternant.last_name,
                ...(includeEmail ? { email: alternant.email ?? null } : {}),
                financeur: alternant.financeur ?? null,
                presence: presenceById?.get(alternant._id) ?? {
                    archived: false,
                    archiveReason: null,
                    archiveDate: null,
                    ruptureDate: null,
                    poursuitFormation: false,
                },
                attendance: {
                    morning: morning ? this.recordDto(morning) : null,
                    afternoon: afternoon ? this.recordDto(afternoon) : null,
                },
            };
        });
    }

    private toDto(
        seance: Seance,
        counts?: { marked: number; present: number },
        links?: SeanceLinks,
        progress?: SeanceAttendanceProgressDto,
    ): SeanceDto {
        const resolvedLinks = links ?? this.links(seance);
        const now = new Date();
        const validations = validationsOf(seance);
        const validationStatus = this.validationStatus(seance, now);
        return {
            id: seance._id,
            sessionId: seance.session_id,
            sessionNom: seance.session_nom,
            degreeTitle: seance.degree_title ?? null,
            module: seance.module ?? null,
            location: seance.location ?? null,
            date: seance.date,
            startTime: seance.start_time,
            endTime: seance.end_time,
            morningClassStart: seance.morning_class_start ?? null,
            morningClassEnd: seance.morning_class_end ?? null,
            afternoonClassStart: seance.afternoon_class_start ?? null,
            afternoonClassEnd: seance.afternoon_class_end ?? null,
            site: seance.site,
            mode: seance.mode,
            formateurName: seance.formateur_name,
            formateurEmail: seance.formateur_email,
            morningStart: seance.morning_start,
            morningEnd: seance.morning_end,
            afternoonStart: seance.afternoon_start,
            afternoonEnd: seance.afternoon_end,
            timezone: seance.timezone,
            inviteExpiresAt: toIso(seance.invite_expires_at)!,
            validations: {
                morning: validationDto(validations.morning),
                afternoon: validationDto(validations.afternoon),
            },
            validationStatus,
            validationSource:
                validations.morning?.source === 'peda' || validations.afternoon?.source === 'peda'
                    ? 'peda'
                    : validations.morning || validations.afternoon
                      ? 'formateur'
                      : null,
            validatedBy: seance.validated_by ?? null,
            validationNote: seance.validation_note ?? null,
            canValidateByPeda: validationStatus === 'to_validate' || validationStatus === 'anomaly',
            createdAt: toIso(seance.created_at)!,
            updatedAt: toIso(seance.updated_at)!,
            ...resolvedLinks,
            marked: counts?.marked ?? 0,
            present: counts?.present ?? 0,
            attendanceProgress: progress ?? {
                expected: 0,
                morning: { expected: 0, recorded: 0 },
                afternoon: { expected: 0, recorded: 0 },
                missing: 0,
                missingHalves: [],
            },
        };
    }

    /**
     * Envoie l'invitation depuis la boîte système ; si elle n'est pas connectée,
     * repli sur le compte Google du Peda qui a déclenché l'envoi. Renvoie `false`
     * quand aucun envoi n'a abouti : l'appelant le remonte à l'utilisateur plutôt
     * que de laisser croire que l'e-mail est parti.
     */
    private async sendInvite(seance: Seance, link: string, senderId?: number): Promise<boolean> {
        const html = renderTemplate(EMARGEMENT_INVITE_BODY, {
            formateur: seance.formateur_name,
            session: seance.session_nom,
            date: formatLongDateFr(seance.date, seance.timezone),
            heure: `${seance.start_time} – ${seance.end_time}`,
            site: seance.site,
            mode: seance.mode === 'salle' ? 'en salle' : 'à distance',
            link,
        });
        const text = html.replace(/<[^>]*>/g, '');
        const options = withNoReply({
            to: seance.formateur_email,
            subject: renderTemplate(EMARGEMENT_INVITE_SUBJECT, {
                date: formatLongDateFr(seance.date, seance.timezone),
            }),
            html,
            text,
        });

        const system = await sendSystemEmail(options);
        if (system.delivered) return true;

        if (senderId != null) {
            const sender = await this.users.findById(senderId);
            if (sender?.oauthToken && sender.refreshToken) {
                try {
                    await this.gmailService.sendEmail(
                        { access_token: sender.oauthToken, refresh_token: sender.refreshToken },
                        options,
                        this.users.googleTokenPersister(sender.id),
                    );
                    logger.info({ seanceId: seance._id, senderId }, 'Emargement invite sent from user mailbox');
                    return true;
                } catch (err) {
                    logger.error({ err, seanceId: seance._id, senderId }, 'Emargement invite email failed');
                }
            }
        }

        logger.warn(
            { seanceId: seance._id, senderId, systemReason: system.reason },
            'Emargement invite not delivered — lien à transmettre manuellement',
        );
        return false;
    }

    private async deleteAfternoonAttendance(seanceId: string): Promise<void> {
        await this.emargements.deleteBySeanceAndHalf(seanceId, 'afternoon');
    }
}

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
import { SeanceListFilter, SeanceRepository } from '../repositories/mongo/SeanceRepository';
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

export interface AlternantEmargementDto {
    id: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    /** Financeur de la formation (OPCO, Région…) — figure sur la feuille et les exports. */
    financeur?: string | null;
    attendance: {
        morning: EmargementRecordDto | null;
        afternoon: EmargementRecordDto | null;
    };
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
    startTime: string;
    endTime: string;
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
}

/** Une ligne d'export = un alternant × une demi-journée d'une séance. */
export interface AttendanceExportRow {
    seanceId: string;
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
    half: EmargementHalf;
    status: EmargementStatus;
    statusTime: string | null;
    signatureMode: EmargementSignatureMode | null;
    signedAt: string | null;
    /** Durée du créneau (minutes) : base des heures prévues. */
    plannedMinutes: number;
    /** Heures réellement suivies, selon le statut et l'heure éventuelle. */
    attendedMinutes: number;
    validation: SeanceValidationDto | null;
}

/** Synthèse par alternant, second tableau des exports Excel. */
export interface AttendanceExportSummary {
    alternantId: string;
    firstName: string;
    lastName: string;
    financeur: string | null;
    sessions: number;
    halves: number;
    absences: number;
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

/** Données d'une attestation d'assiduité (un alternant, une période). */ export interface AttestationDto {
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

/** Heures prévues d'une demi-journée : la durée du créneau de signature. */
function plannedMinutesOf(seance: Seance, half: EmargementHalf): number {
    const bounds = halfBounds(seance, half);
    if (!bounds) return 0;
    return Math.max(0, minutesOfDay(bounds.end) - minutesOfDay(bounds.start));
}

/**
 * Heures réalisées d'une demi-journée :
 * - `present` → tout le créneau ;
 * - `late` → de l'heure d'arrivée à la fin du créneau ;
 * - `left_early` → du début du créneau à l'heure de départ ;
 * - `absent` / `na` → 0.
 *
 * Sans heure saisie, une arrivée tardive ou un départ anticipé comptent le
 * créneau entier : mieux vaut surestimer la présence que de la nier.
 */
function attendedMinutesOf(seance: Seance, half: EmargementHalf, record: EmargementRecord | null): number {
    const planned = plannedMinutesOf(seance, half);
    if (!record || planned === 0) return 0;
    const bounds = halfBounds(seance, half)!;
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

export class EmargementService {
    constructor(
        private readonly seances = new SeanceRepository(),
        private readonly emargements = new EmargementRepository(),
        private readonly history = new EmargementHistoryRepository(),
        private readonly alternants = new AlternantRepository(),
        private readonly sessions = new SessionService(),
        private readonly users = new UserService(),
        private readonly gmailService = new GoogleGmailService(),
    ) {}

    // ── Côté Peda ────────────────────────────────────────────────────────────

    async list(filter: SeanceListFilter = {}): Promise<SeanceDto[]> {
        const seances = await this.seances.findAll(filter);
        const counts = await this.emargements.countsBySeance(seances.map((s) => s._id));
        const dtos = seances.map((seance) => this.toDto(seance, counts.get(seance._id)));
        // L'état dépend de l'heure courante et des créneaux : il se calcule après
        // lecture, le filtre ne peut pas être poussé dans la requête Mongo.
        return filter.validation ? dtos.filter((dto) => dto.validationStatus === filter.validation) : dtos;
    }

    async get(id: string): Promise<SeanceDetailDto> {
        const seance = await this.requireSeance(id);
        const [alternants, records, history] = await Promise.all([
            this.sessions.findAlternants(seance.session_id),
            this.emargements.findBySeance(seance._id),
            this.history.findBySeance(seance._id),
        ]);
        return {
            ...this.toDto(seance, this.countsFrom(records)),
            alternants: this.alternantsWithAttendance(alternants, records, true),
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
        const alternantsBySession = new Map<string, Awaited<ReturnType<SessionService['findAlternants']>>>();
        const now = new Date();

        const rows: AttendanceExportRow[] = [];
        for (const seance of seances) {
            let alternants = alternantsBySession.get(seance.session_id);
            if (!alternants) {
                alternants = await this.sessions.findAlternants(seance.session_id);
                alternantsBySession.set(seance.session_id, alternants);
            }
            const validations = validationsOf(seance);
            const validationStatus = this.validationStatus(seance, now);
            for (const alternant of alternants) {
                for (const half of applicableHalves(seance)) {
                    const record = byKey.get(`${seance._id}:${alternant._id}:${half}`) ?? null;
                    rows.push({
                        seanceId: seance._id,
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
                        half,
                        status: record?.status ?? 'na',
                        statusTime: record?.status_time ?? null,
                        signatureMode: record?.signature_mode ?? null,
                        signedAt: record ? toIso(record.signed_at) : null,
                        plannedMinutes: plannedMinutesOf(seance, half),
                        attendedMinutes: attendedMinutesOf(seance, half, record),
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
                    sessions: 0,
                    halves: 0,
                    absences: 0,
                    plannedMinutes: 0,
                    attendedMinutes: 0,
                    seanceIds: new Set<string>(),
                };
                summaries.set(row.alternantId, summary);
            }
            summary.seanceIds.add(row.seanceId);
            summary.halves += 1;
            if (row.status === 'absent') summary.absences += 1;
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
                const halves = applicableHalves(seance).map((half) => {
                    const record = byKey.get(`${seance._id}:${half}`) ?? null;
                    return {
                        half,
                        status: record?.status ?? ('na' as EmargementStatus),
                        statusTime: record?.status_time ?? null,
                        plannedMinutes: plannedMinutesOf(seance, half),
                        attendedMinutes: attendedMinutesOf(seance, half, record),
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
            start_time: parsed.startTime,
            end_time: parsed.endTime,
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
        const merged = this.parseSeanceInput({
            sessionId: patch.sessionId ?? current.session_id,
            date: patch.date ?? current.date,
            startTime: patch.startTime ?? current.start_time,
            endTime: patch.endTime ?? current.end_time,
            site: patch.site ?? current.site,
            mode: patch.mode ?? current.mode,
            formateurName: patch.formateurName ?? current.formateur_name,
            formateurEmail: patch.formateurEmail ?? current.formateur_email,
            morningStart: patch.morningStart ?? current.morning_start,
            morningEnd: patch.morningEnd ?? current.morning_end,
            afternoonStart: patch.afternoonStart !== undefined ? patch.afternoonStart : current.afternoon_start,
            afternoonEnd: patch.afternoonEnd !== undefined ? patch.afternoonEnd : current.afternoon_end,
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
            start_time: merged.startTime,
            end_time: merged.endTime,
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
        if (this.hasAnyValidation(seance)) {
            throw httpError(409, 'signed', 'Une feuille dont une demi-journée est validée ne peut pas être supprimée');
        }
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

        const startTime = requiredTime(data.startTime, 'L’heure de début');
        const endTime = requiredTime(data.endTime, 'L’heure de fin');
        if (minutesOfDay(startTime) >= minutesOfDay(endTime)) {
            throw httpError(400, 'validation', 'L’heure de fin doit suivre l’heure de début');
        }

        const morningStart = requiredTime(data.morningStart, 'Le début du créneau du matin');
        const morningEnd = requiredTime(data.morningEnd, 'La fin du créneau du matin');
        if (minutesOfDay(morningStart) >= minutesOfDay(morningEnd)) {
            throw httpError(400, 'validation', 'Le créneau du matin est invalide');
        }
        // Les créneaux sont des fenêtres *à l'intérieur* de la séance : sans cette
        // borne, on pouvait ouvrir la signature avant le début du cours et la
        // laisser ouverte après la fin (la fermeture du créneau ne protégeait
        // alors plus rien).
        assertWindowInsideSeance(morningStart, morningEnd, startTime, endTime, 'du matin');

        const afternoonStart = optionalTime(data.afternoonStart, 'Le début du créneau de l’après-midi');
        const afternoonEnd = optionalTime(data.afternoonEnd, 'La fin du créneau de l’après-midi');
        if ((afternoonStart === null) !== (afternoonEnd === null)) {
            throw httpError(400, 'validation', 'Les deux horaires de l’après-midi doivent être renseignés');
        }
        if (afternoonStart && afternoonEnd && minutesOfDay(afternoonStart) >= minutesOfDay(afternoonEnd)) {
            throw httpError(400, 'validation', 'Le créneau de l’après-midi est invalide');
        }
        if (afternoonStart && afternoonEnd) {
            assertWindowInsideSeance(afternoonStart, afternoonEnd, startTime, endTime, 'de l’après-midi');
        }
        if (afternoonStart && minutesOfDay(morningEnd) > minutesOfDay(afternoonStart)) {
            throw httpError(400, 'validation', 'Les créneaux du matin et de l’après-midi se chevauchent');
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
        alternants: {
            _id: string;
            first_name: string;
            last_name: string;
            email?: string | null;
            financeur?: string | null;
        }[],
        records: EmargementRecord[],
        includeEmail: boolean,
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
                attendance: {
                    morning: morning ? this.recordDto(morning) : null,
                    afternoon: afternoon ? this.recordDto(afternoon) : null,
                },
            };
        });
    }

    private toDto(seance: Seance, counts?: { marked: number; present: number }, links?: SeanceLinks): SeanceDto {
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

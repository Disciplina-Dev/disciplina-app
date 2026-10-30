import { logger } from '../external/logger';
import { generateSignature } from '../external/crypto';
import { sendSystemEmail } from '../external/google/system-mail';
import { GoogleGmailService } from '../external/google/gmail.service';
import { withNoReply } from '../external/google/no-reply';
import { env } from '../config/env';
import { tenantTimezone } from '../config/tenant';
import { EmargementRepository } from '../repositories/mongo/EmargementRepository';
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
    EmargementRecord,
    EmargementSignatureMode,
    EmargementStatus,
    SEANCE_MODES,
    SEANCE_SITES,
    Seance,
    SeanceMode,
    SeanceSite,
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
    signed: boolean;
    signedAt: string | null;
    signedByName: string | null;
    signatureImage: string | null;
    createdAt: string;
    updatedAt: string;
    formateurUrl: string;
    qrUrl: string;
    marked: number;
    present: number;
}

export interface SeanceDetailDto extends SeanceDto {
    alternants: AlternantEmargementDto[];
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
        signed: boolean;
        signedAt: string | null;
        signedByName: string | null;
        signatureImage: string | null;
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
    canEdit: boolean;
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

export class EmargementService {
    constructor(
        private readonly seances = new SeanceRepository(),
        private readonly emargements = new EmargementRepository(),
        private readonly sessions = new SessionService(),
        private readonly users = new UserService(),
        private readonly gmailService = new GoogleGmailService(),
    ) {}

    // ── Côté Peda ────────────────────────────────────────────────────────────

    async list(filter: SeanceListFilter = {}): Promise<SeanceDto[]> {
        const seances = await this.seances.findAll(filter);
        const counts = await this.emargements.countsBySeance(seances.map((s) => s._id));
        return seances.map((seance) => this.toDto(seance, counts.get(seance._id)));
    }

    async get(id: string): Promise<SeanceDetailDto> {
        const seance = await this.requireSeance(id);
        const [alternants, records] = await Promise.all([
            this.sessions.findAlternants(seance.session_id),
            this.emargements.findBySeance(seance._id),
        ]);
        return {
            ...this.toDto(seance, this.countsFrom(records)),
            alternants: this.alternantsWithAttendance(alternants, records, true),
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
            signed_at: null,
            signed_by_name: null,
            signature_image: null,
            signed_ip: null,
            signed_user_agent: null,
            created_by: userId ?? null,
        });

        const links = this.links(seance);
        const inviteSent = await this.sendInvite(seance, links.formateurUrl, userId);
        logger.info(
            { seanceId: seance._id, sessionId: seance.session_id, userId, inviteSent },
            'Emargement séance created',
        );

        return { seance: this.toDto(seance, undefined, links), inviteSent };
    }

    async update(id: string, input: unknown): Promise<SeanceDto> {
        const current = await this.requireSeance(id);
        if (current.signed_at) throw httpError(409, 'signed', 'Feuille d’émargement déjà signée');

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
        if (seance.signed_at) {
            throw httpError(409, 'signed', 'Une feuille d’émargement signée ne peut pas être supprimée');
        }
        await this.emargements.deleteBySeance(seance._id);
        await this.seances.delete(seance._id);
    }

    /** Renvoie (et éventuellement régénère) les liens sans renvoyer la séance entière. */
    async resendInvite(id: string, rotate: boolean, senderId?: number): Promise<InviteResult> {
        const seance = await this.requireSeance(id);
        if (seance.signed_at) throw httpError(409, 'signed', 'Feuille d’émargement déjà signée');

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
        const signed = seance.signed_at != null;

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
                signed,
                signedAt: toIso(seance.signed_at),
                signedByName: seance.signed_by_name,
                signatureImage: seance.signature_image,
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
            canEdit: !signed && !expired,
        };
    }

    async setAttendance(token: string, input: unknown, meta: ClientMeta): Promise<EmargementRecordDto> {
        const seance = await this.loadByToken(token, 'formateur');
        this.assertEditable(seance);

        const body = asRecord(input);
        const alternantId = requiredString(body.alternantId, 'L’alternant');
        const half = enumValue(body.half, EMARGEMENT_HALVES, 'La demi-journée');
        const status = enumValue(body.status, EMARGEMENT_STATUSES, 'Le statut');

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
        this.assertEditable(seance);

        const body = asRecord(input);
        const alternantId = requiredString(body.alternantId, 'L’alternant');
        const half = enumValue(body.half, EMARGEMENT_HALVES, 'La demi-journée');
        const signature = requireSignatureImage(body.signature);
        if (half === 'afternoon' && !seance.afternoon_start) {
            throw httpError(400, 'window', 'Cette séance n’a pas de créneau l’après-midi');
        }

        const alternants = await this.sessions.findAlternants(seance.session_id);
        const alternant = alternants.find((a) => a._id === alternantId);
        if (!alternant) throw httpError(404, 'alternant', 'Alternant introuvable dans cette session');

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
        logger.info({ seanceId: seance._id, alternantId, half }, 'Emargement handwritten signature recorded');
        return this.recordDto(record);
    }

    async signSheet(token: string, input: unknown, meta: ClientMeta): Promise<SignSheetResult> {
        const seance = await this.loadByToken(token, 'formateur');
        if (seance.signed_at) throw httpError(409, 'signed', 'Feuille d’émargement déjà signée');
        if (this.isExpired(seance)) throw httpError(410, 'expired', 'Ce lien a expiré');

        const body = asRecord(input);
        if (body.confirmed !== true) {
            throw httpError(400, 'validation', 'La confirmation du formateur est requise');
        }
        const signature = requireSignatureImage(body.signature);

        const signedAt = new Date();
        const updated = await this.seances.update(seance._id, {
            signed_at: signedAt,
            signed_by_name: seance.formateur_name,
            signature_image: signature,
            signed_ip: meta.ip,
            signed_user_agent: meta.userAgent,
        });
        if (!updated) throw httpError(404, 'not_found', 'Séance introuvable');
        logger.info({ seanceId: seance._id }, 'Emargement sheet signed');

        return { signedAt: signedAt.toISOString(), signedByName: seance.formateur_name };
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
            signed: seance.signed_at != null,
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
        if (seance.signed_at) throw httpError(409, 'signed', 'La feuille d’émargement est déjà signée');
        if (this.isExpired(seance)) throw httpError(410, 'expired', 'Ce lien a expiré');

        const body = asRecord(input);
        if (!isEmail(body.email)) {
            throw httpError(400, 'email', 'Une adresse e-mail valide est requise');
        }
        const email = normalizeEmail(body.email);

        const now = new Date();
        const half = this.openHalf(seance, now);
        if (!half) {
            throw httpError(409, 'window', 'La fenêtre d’émargement est fermée');
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
            signatureImage: null,
            signedAt: now,
            ip: meta.ip,
            userAgent: meta.userAgent,
        });

        return {
            fullName: `${alternant.first_name} ${alternant.last_name}`.trim(),
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

    private isExpired(seance: Seance): boolean {
        return new Date(seance.invite_expires_at).getTime() < Date.now();
    }

    private assertEditable(seance: Seance): void {
        if (seance.signed_at) throw httpError(409, 'signed', 'Feuille d’émargement déjà signée');
        if (this.isExpired(seance)) throw httpError(410, 'expired', 'Ce lien a expiré');
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
            signed: seance.signed_at != null,
            signedAt: toIso(seance.signed_at),
            signedByName: seance.signed_by_name,
            signatureImage: seance.signature_image ?? null,
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

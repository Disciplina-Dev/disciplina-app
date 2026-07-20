import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { UserService } from '../../services/UserService';
import { GoogleCalendarService, CalendarEventInput, Attendance } from '../../external/google/calendar.service';
import { Role, User } from '../../types/user.types';
import { logger } from '../../external/logger';
import { env } from '../../config/env';
import { BookingService } from '../booking/service';
import { sendRdvConfirmation, sendNoShowRebooking } from './notifications';
import { RhKpiService } from '../../services/RhKpiService';
import { primarySector } from '../../utils/sector';
import { isValidEmail } from '../../services/validation';

const userService = new UserService();
const bookingService = new BookingService();
const rhKpiService = new RhKpiService();

/**
 * Delta KPI « pas venu » pour une transition de présence old→next.
 * Le « venu » n'est plus compté ici : il provient désormais de la création
 * d'un dossier candidat (cf. resolver createCandidate). Seul le no-show est
 * suivi via le clic manuel sur l'entretien.
 */
function noshowDelta(old: Attendance | undefined, next: Attendance): Record<string, number> {
    if (old === next) return {};
    const delta: Record<string, number> = {};
    if (old === 'noshow') delta.interviews_noshow = (delta.interviews_noshow ?? 0) - 1;
    if (next === 'noshow') delta.interviews_noshow = (delta.interviews_noshow ?? 0) + 1;
    return delta;
}

/** Jour calendaire (UTC) d'une date ISO, pour détecter un changement de bucket. */
function dayKey(iso: string): string {
    return new Date(iso).toISOString().slice(0, 10);
}

/** Rôles dont on peut consulter l'agenda en lecture dans l'espace RH. */
const VIEWABLE_ROLES: Role[] = [Role.RH, Role.RESPONSABLE];

/**
 * Détecte une erreur d'authentification Google (token révoqué, expiré sans refresh,
 * compte non lié). Dans ce cas l'agenda doit être traité comme « non connecté »
 * plutôt que comme une panne Google (502).
 */
function isGoogleAuthError(error: unknown): boolean {
    const e = error as { code?: number | string; response?: { status?: number }; message?: string };
    const status = typeof e?.code === 'number' ? e.code : e?.response?.status;
    if (status === 401) return true;
    return /invalid_grant|invalid_credentials|invalid_rapt|unauthorized_client|no access, refresh token/i.test(
        String(e?.message ?? ''),
    );
}

/**
 * Répond à une erreur d'appel Calendar : 409 « non connecté » si le token Google
 * est invalide (et purge les tokens périmés pour que `connected` redevienne fiable),
 * sinon 502 avec le message métier fourni.
 */
async function replyCalendarError(res: Response, error: unknown, ownerId: number, fallback: string): Promise<void> {
    if (isGoogleAuthError(error)) {
        logger.warn({ err: error, ownerId }, 'Google tokens invalid, marking calendar as disconnected');
        await userService.updateGoogleTokens(ownerId, null, null).catch(() => undefined);
        res.status(409).json({ error: 'Compte Google non connecté ou accès expiré. Reconnectez le compte Google.' });
        return;
    }
    logger.error({ err: error, ownerId }, fallback);
    res.status(502).json({ error: fallback });
}

function calendarForUser(user: User): GoogleCalendarService {
    return GoogleCalendarService.fromTokens(
        { access_token: user.oauthToken ?? undefined, refresh_token: user.refreshToken ?? undefined },
        userService.googleTokenPersister(user.id),
    );
}

/** Résout le service Calendar pour l'utilisateur courant, ou renvoie 409 si non connecté. */
async function resolveCalendar(req: AuthRequest, res: Response): Promise<GoogleCalendarService | null> {
    const user = await userService.findById(Number(req.user.id));
    if (!user || !user.oauthToken) {
        res.status(409).json({ error: 'Google Calendar non connecté pour cet utilisateur' });
        return null;
    }
    return calendarForUser(user);
}

/**
 * Résout l'utilisateur propriétaire du calendrier ciblé par une écriture.
 * `userId` (query) absent ou = soi → soi-même. Sinon la cible doit être un
 * RH/responsable connecté : tout RH/responsable/admin (déjà filtré par la route)
 * peut créer/modifier un créneau sur l'agenda d'un autre RH/responsable.
 * Renvoie null après avoir répondu (400/403/409) en cas de cible invalide.
 */
async function resolveOwner(req: AuthRequest, res: Response): Promise<User | null> {
    const selfId = Number(req.user.id);
    const requestedId = typeof req.query.userId === 'string' ? Number(req.query.userId) : selfId;
    if (!Number.isFinite(requestedId)) {
        res.status(400).json({ error: 'userId invalide' });
        return null;
    }
    if (requestedId === selfId) {
        const self = await userService.findById(selfId);
        if (!self || !self.oauthToken) {
            res.status(409).json({ error: 'Google Calendar non connecté pour cet utilisateur' });
            return null;
        }
        return self;
    }
    const target = await userService.findById(requestedId);
    if (!target || !VIEWABLE_ROLES.includes(target.role)) {
        res.status(403).json({ error: 'Agenda non modifiable' });
        return null;
    }
    if (!target.oauthToken) {
        res.status(409).json({ error: 'Agenda non connecté' });
        return null;
    }
    return target;
}

/** GET /api/calendar/users — liste RH + responsables avec état de connexion Google. */
export async function listCalendarUsers(req: AuthRequest, res: Response): Promise<void> {
    const selfId = Number(req.user.id);
    const users = await userService.findByRoles(VIEWABLE_ROLES);
    // L'utilisateur courant doit toujours voir son propre agenda, même s'il n'est ni RH ni responsable (ex : ADMIN).
    if (!users.some((u) => u.id === selfId)) {
        const self = await userService.findById(selfId);
        if (self) users.unshift(self);
    }
    res.json({
        users: users.map((u) => ({
            id: u.id,
            firstName: u.firstName,
            lastName: u.lastName,
            role: u.role,
            sectors: u.sectors ?? [],
            connected: Boolean(u.oauthToken),
            isSelf: u.id === selfId,
        })),
    });
}

/** Valide et normalise le corps d'un créneau. Renvoie null + 400 si invalide. */
function parseEventInput(body: unknown, res: Response): CalendarEventInput | null {
    const b = (body ?? {}) as Record<string, unknown>;
    const summary = typeof b.summary === 'string' ? b.summary.trim() : '';
    const start = typeof b.start === 'string' ? b.start : '';
    const end = typeof b.end === 'string' ? b.end : '';
    if (!summary || !start || !end) {
        res.status(400).json({ error: 'summary, start et end (ISO) requis' });
        return null;
    }
    if (Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end)) || Date.parse(end) <= Date.parse(start)) {
        res.status(400).json({ error: 'Plage horaire invalide (end doit suivre start)' });
        return null;
    }
    let attendeeEmail: string | undefined;
    if (typeof b.attendeeEmail === 'string' && b.attendeeEmail.trim()) {
        const email = b.attendeeEmail.trim();
        if (!isValidEmail(email)) {
            res.status(400).json({ error: 'Email invité invalide' });
            return null;
        }
        attendeeEmail = email;
    }
    let meetingLink: string | undefined;
    if (typeof b.meetingLink === 'string' && b.meetingLink.trim()) {
        const raw = b.meetingLink.trim();
        try {
            const url = new URL(raw);
            if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('bad protocol');
            meetingLink = url.toString();
        } catch {
            res.status(400).json({ error: 'Lien de rendez-vous invalide (http/https requis)' });
            return null;
        }
    }
    return {
        summary,
        start,
        end,
        description: typeof b.description === 'string' ? b.description : undefined,
        location: typeof b.location === 'string' ? b.location : undefined,
        colorId: typeof b.colorId === 'string' ? b.colorId : undefined,
        meetingLink,
        attendeeEmail,
        isInterview: Boolean(b.isInterview),
    };
}

/** GET /api/calendar/events?timeMin=ISO&timeMax=ISO */
export async function getEvents(req: AuthRequest, res: Response): Promise<void> {
    const { timeMin, timeMax } = req.query;
    if (typeof timeMin !== 'string' || typeof timeMax !== 'string') {
        res.status(400).json({ error: 'timeMin et timeMax (ISO) requis' });
        return;
    }
    // Lecture de l'agenda d'un autre RH/responsable si userId fourni, sinon le sien.
    let calendar: GoogleCalendarService | null;
    const requestedId = typeof req.query.userId === 'string' ? Number(req.query.userId) : Number(req.user.id);
    if (requestedId === Number(req.user.id)) {
        calendar = await resolveCalendar(req, res);
    } else {
        const target = await userService.findById(requestedId);
        if (!target || !VIEWABLE_ROLES.includes(target.role)) {
            res.status(403).json({ error: 'Agenda non consultable' });
            return;
        }
        if (!target.oauthToken) {
            res.status(409).json({ error: 'Agenda non connecté' });
            return;
        }
        calendar = calendarForUser(target);
    }
    if (!calendar) return;
    try {
        res.json({ events: await calendar.listEvents(timeMin, timeMax) });
    } catch (error) {
        await replyCalendarError(res, error, requestedId, 'Échec de récupération du calendrier Google');
    }
}

/** POST /api/calendar/events */
export async function createEvent(req: AuthRequest, res: Response): Promise<void> {
    const input = parseEventInput(req.body, res);
    if (!input) return;
    // Le créneau est posé sur l'agenda du propriétaire (soi-même ou un autre RH ciblé).
    const owner = await resolveOwner(req, res);
    if (!owner) return;
    // KPI attribués à l'acteur (celui qui saisit), pas au propriétaire du calendrier.
    const actor = await userService.findById(Number(req.user.id));
    try {
        const event = await calendarForUser(owner).createEvent(input);
        // KPI : un entretien placé compte au bucket de sa date de début, dans le secteur de l'acteur.
        if (input.isInterview && actor) {
            await rhKpiService.bump(actor.id, primarySector(actor.sectors), new Date(input.start), {
                interviews_placed: 1,
            });
        }
        // Email de confirmation automatique si un email invité est fourni (settings du propriétaire).
        if (input.attendeeEmail) {
            const settings = await bookingService.getOrCreate(owner.id);
            await sendRdvConfirmation({
                host: owner,
                to: input.attendeeEmail,
                title: input.summary,
                startIso: input.start,
                location: input.location,
                tz: settings.timezone,
                durationMin: settings.durationMin,
                confirmationSubject: settings.confirmationSubject,
                confirmationBody: settings.confirmationBody,
            });
        }
        res.status(201).json({ event });
    } catch (error) {
        await replyCalendarError(res, error, owner.id, 'Échec de création du créneau');
    }
}

/** PATCH /api/calendar/events/:id/attendance — body { status: 'arrived' | 'noshow' } */
export async function setAttendance(req: AuthRequest, res: Response): Promise<void> {
    const status = (req.body ?? {}).status;
    if (status !== 'arrived' && status !== 'noshow') {
        res.status(400).json({ error: 'status doit être "arrived" ou "noshow"' });
        return;
    }
    const owner = await resolveOwner(req, res);
    if (!owner) return;
    const actor = await userService.findById(Number(req.user.id));
    try {
        const calendar = calendarForUser(owner);
        const before = await calendar.getEvent(req.params.id);
        const event = await calendar.setAttendance(req.params.id, status);
        // KPI : « pas venu » (seulement pour les entretiens), attribué à l'acteur.
        if (event.isInterview && actor) {
            const delta = noshowDelta(before.attendance, status);
            if (Object.keys(delta).length) {
                await rhKpiService.bump(actor.id, primarySector(actor.sectors), new Date(event.start), delta);
            }
        }
        // « Pas venu » : on envoie une relance avec le lien de réservation, si on a l'email.
        if (status === 'noshow' && event.attendeeEmail) {
            const settings = await bookingService.getOrCreate(owner.id);
            await sendNoShowRebooking({
                host: owner,
                to: event.attendeeEmail,
                title: event.summary,
                bookingUrl: `${env.FRONTEND_BASE_URL}/booking/${settings.slug}`,
                propositionSubject: settings.propositionSubject,
                propositionBody: settings.propositionBody,
            });
        }
        res.json({ event });
    } catch (error) {
        await replyCalendarError(res, error, owner.id, 'Échec de mise à jour de la présence');
    }
}

/** PATCH /api/calendar/events/:id */
export async function updateEvent(req: AuthRequest, res: Response): Promise<void> {
    const input = parseEventInput(req.body, res);
    if (!input) return;
    const owner = await resolveOwner(req, res);
    if (!owner) return;
    const actor = await userService.findById(Number(req.user.id));
    const calendar = calendarForUser(owner);
    try {
        const before = await calendar.getEvent(req.params.id);
        const event = await calendar.updateEvent(req.params.id, input);
        // KPI : rééquilibre le compteur « entretiens placés » si le flag ou la date a changé (acteur).
        const movedOrToggled = before.isInterview !== input.isInterview || dayKey(before.start) !== dayKey(input.start);
        if (actor && (before.isInterview || input.isInterview) && movedOrToggled) {
            const sector = primarySector(actor.sectors);
            if (before.isInterview)
                await rhKpiService.bump(actor.id, sector, new Date(before.start), { interviews_placed: -1 });
            if (input.isInterview)
                await rhKpiService.bump(actor.id, sector, new Date(input.start), { interviews_placed: 1 });
        }
        res.json({ event });
    } catch (error) {
        await replyCalendarError(res, error, owner.id, 'Échec de modification du créneau');
    }
}

/** DELETE /api/calendar/events/:id */
export async function deleteEvent(req: AuthRequest, res: Response): Promise<void> {
    const owner = await resolveOwner(req, res);
    if (!owner) return;
    const actor = await userService.findById(Number(req.user.id));
    const calendar = calendarForUser(owner);
    try {
        const before = await calendar.getEvent(req.params.id);
        await calendar.deleteEvent(req.params.id);
        // KPI : on retire les compteurs portés par cet entretien (placé + no-show éventuel), acteur.
        if (actor && before.isInterview) {
            const delta: Record<string, number> = { interviews_placed: -1 };
            if (before.attendance === 'noshow') delta.interviews_noshow = -1;
            await rhKpiService.bump(actor.id, primarySector(actor.sectors), new Date(before.start), delta);
        }
        res.status(204).end();
    } catch (error) {
        await replyCalendarError(res, error, owner.id, 'Échec de suppression du créneau');
    }
}

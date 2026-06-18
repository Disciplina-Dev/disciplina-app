import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { UserService } from '../../services/UserService';
import { GoogleCalendarService, CalendarEventInput, Attendance } from '../../external/google/calendar.service';
import { GoogleTokens } from '../../external/google/types';
import { Role, User } from '../../types/user.types';
import { logger } from '../../external/logger';
import { env } from '../../config/env';
import { BookingService } from '../booking/service';
import { sendRdvConfirmation, sendNoShowRebooking } from './notifications';
import { RhKpiService } from '../../services/RhKpiService';

const userService = new UserService();
const bookingService = new BookingService();
const rhKpiService = new RhKpiService();

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Colonne KPI correspondant à un statut de présence. */
const ATTENDANCE_COLUMN = { arrived: 'interviews_attended', noshow: 'interviews_noshow' } as const;

/** Delta KPI pour une transition de présence old→next (decrémente l'ancien, incrémente le nouveau). */
function attendanceDelta(old: Attendance | undefined, next: Attendance): Record<string, number> {
    if (old === next) return {};
    const delta: Record<string, number> = {};
    if (old) delta[ATTENDANCE_COLUMN[old]] = (delta[ATTENDANCE_COLUMN[old]] ?? 0) - 1;
    delta[ATTENDANCE_COLUMN[next]] = (delta[ATTENDANCE_COLUMN[next]] ?? 0) + 1;
    return delta;
}

/** Jour calendaire (UTC) d'une date ISO, pour détecter un changement de bucket. */
function dayKey(iso: string): string {
    return new Date(iso).toISOString().slice(0, 10);
}

/** Rôles dont on peut consulter l'agenda en lecture dans l'espace RH. */
const VIEWABLE_ROLES: Role[] = [Role.RH, Role.RESPONSABLE];

const persistRefreshedTokens = (userId: number) => (refreshed: GoogleTokens) =>
    userService.updateGoogleTokens(userId, refreshed.access_token ?? null, refreshed.refresh_token ?? null);

function calendarForUser(user: User): GoogleCalendarService {
    return GoogleCalendarService.fromTokens(
        { access_token: user.oauthToken ?? undefined, refresh_token: user.refreshToken ?? undefined },
        persistRefreshedTokens(user.id),
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
            name: u.name,
            role: u.role,
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
        if (!EMAIL_RE.test(email)) {
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
        logger.error({ err: error }, 'Calendar events fetch failed');
        res.status(502).json({ error: 'Échec de récupération du calendrier Google' });
    }
}

/** POST /api/calendar/events */
export async function createEvent(req: AuthRequest, res: Response): Promise<void> {
    const input = parseEventInput(req.body, res);
    if (!input) return;
    const host = await userService.findById(Number(req.user.id));
    if (!host || !host.oauthToken) {
        res.status(409).json({ error: 'Google Calendar non connecté pour cet utilisateur' });
        return;
    }
    try {
        const event = await calendarForUser(host).createEvent(input);
        // KPI : un entretien placé compte au bucket de sa date de début.
        if (input.isInterview) {
            await rhKpiService.bump(host.id, new Date(input.start), { interviews_placed: 1 });
        }
        // Email de confirmation automatique si un email invité est fourni.
        if (input.attendeeEmail) {
            const settings = await bookingService.getOrCreate(host.id);
            await sendRdvConfirmation({
                host, to: input.attendeeEmail, title: input.summary,
                startIso: input.start, location: input.location, tz: settings.timezone,
            });
        }
        res.status(201).json({ event });
    } catch (error) {
        logger.error({ err: error }, 'Calendar event create failed');
        res.status(502).json({ error: 'Échec de création du créneau' });
    }
}

/** PATCH /api/calendar/events/:id/attendance — body { status: 'arrived' | 'noshow' } */
export async function setAttendance(req: AuthRequest, res: Response): Promise<void> {
    const status = (req.body ?? {}).status;
    if (status !== 'arrived' && status !== 'noshow') {
        res.status(400).json({ error: 'status doit être "arrived" ou "noshow"' });
        return;
    }
    const host = await userService.findById(Number(req.user.id));
    if (!host || !host.oauthToken) {
        res.status(409).json({ error: 'Google Calendar non connecté pour cet utilisateur' });
        return;
    }
    try {
        const calendar = calendarForUser(host);
        const before = await calendar.getEvent(req.params.id);
        const event = await calendar.setAttendance(req.params.id, status);
        // KPI : transition de présence (seulement pour les entretiens).
        if (event.isInterview) {
            const delta = attendanceDelta(before.attendance, status);
            if (Object.keys(delta).length) await rhKpiService.bump(host.id, new Date(event.start), delta);
        }
        // « Pas venu » : on envoie une relance avec le lien de réservation, si on a l'email.
        if (status === 'noshow' && event.attendeeEmail) {
            const settings = await bookingService.getOrCreate(host.id);
            await sendNoShowRebooking({
                host, to: event.attendeeEmail, title: event.summary,
                bookingUrl: `${env.FRONTEND_BASE_URL}/booking/${settings.slug}`,
            });
        }
        res.json({ event });
    } catch (error) {
        logger.error({ err: error }, 'Calendar attendance update failed');
        res.status(502).json({ error: 'Échec de mise à jour de la présence' });
    }
}

/** PATCH /api/calendar/events/:id */
export async function updateEvent(req: AuthRequest, res: Response): Promise<void> {
    const input = parseEventInput(req.body, res);
    if (!input) return;
    const host = await userService.findById(Number(req.user.id));
    if (!host || !host.oauthToken) {
        res.status(409).json({ error: 'Google Calendar non connecté pour cet utilisateur' });
        return;
    }
    const calendar = calendarForUser(host);
    try {
        const before = await calendar.getEvent(req.params.id);
        const event = await calendar.updateEvent(req.params.id, input);
        // KPI : rééquilibre le compteur « entretiens placés » si le flag ou la date a changé.
        const movedOrToggled = before.isInterview !== input.isInterview || dayKey(before.start) !== dayKey(input.start);
        if ((before.isInterview || input.isInterview) && movedOrToggled) {
            if (before.isInterview) await rhKpiService.bump(host.id, new Date(before.start), { interviews_placed: -1 });
            if (input.isInterview) await rhKpiService.bump(host.id, new Date(input.start), { interviews_placed: 1 });
        }
        res.json({ event });
    } catch (error) {
        logger.error({ err: error }, 'Calendar event update failed');
        res.status(502).json({ error: 'Échec de modification du créneau' });
    }
}

/** DELETE /api/calendar/events/:id */
export async function deleteEvent(req: AuthRequest, res: Response): Promise<void> {
    const host = await userService.findById(Number(req.user.id));
    if (!host || !host.oauthToken) {
        res.status(409).json({ error: 'Google Calendar non connecté pour cet utilisateur' });
        return;
    }
    const calendar = calendarForUser(host);
    try {
        const before = await calendar.getEvent(req.params.id);
        await calendar.deleteEvent(req.params.id);
        // KPI : on retire les compteurs portés par cet entretien.
        if (before.isInterview) {
            const delta: Record<string, number> = { interviews_placed: -1 };
            if (before.attendance) delta[ATTENDANCE_COLUMN[before.attendance]] = -1;
            await rhKpiService.bump(host.id, new Date(before.start), delta);
        }
        res.status(204).end();
    } catch (error) {
        logger.error({ err: error }, 'Calendar event delete failed');
        res.status(502).json({ error: 'Échec de suppression du créneau' });
    }
}

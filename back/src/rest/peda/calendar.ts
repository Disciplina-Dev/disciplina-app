import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { UserService } from '../../services/UserService';
import { SaCalendarService } from '../../services/SaCalendarService';
import { isGoogleAuthError } from '../calendar/controller';
import { logger } from '../../external/logger';

const userService = new UserService();
const saCalendarService = new SaCalendarService();

function parseRange(query: Record<string, unknown>): { timeMin: string; timeMax: string } | null {
    const { timeMin, timeMax } = query;
    if (typeof timeMin !== 'string' || typeof timeMax !== 'string') return null;
    if (Number.isNaN(Date.parse(timeMin)) || Number.isNaN(Date.parse(timeMax))) return null;
    if (Date.parse(timeMax) <= Date.parse(timeMin)) return null;
    return { timeMin, timeMax };
}

/**
 * Traduit une erreur Google : compte non connecté/expiré → 409, sinon 502.
 * Purge les jetons invalides comme le fait l'agenda RH.
 */
async function replyCalendarError(res: Response, error: unknown, userId: number, fallback: string): Promise<void> {
    if (isGoogleAuthError(error)) {
        logger.warn({ err: error, userId }, 'sa-calendar: jetons Google invalides, agenda marqué non connecté');
        await userService.updateGoogleTokens(userId, null, null).catch(() => undefined);
        res.status(409).json({ error: 'Compte Google non connecté ou accès expiré. Reconnectez le compte Google.' });
        return;
    }
    logger.error({ err: error, userId }, fallback);
    res.status(502).json({ error: fallback });
}

/** GET /api/peda/calendar/events?timeMin=&timeMax= — réconcilie puis renvoie l'agenda. */
export async function getCalendarEvents(req: AuthRequest, res: Response): Promise<void> {
    const range = parseRange(req.query as Record<string, unknown>);
    if (!range) {
        res.status(400).json({ error: 'timeMin et timeMax (ISO) requis et cohérents' });
        return;
    }
    const userId = Number(req.user.id);
    const user = await userService.findById(userId);
    if (!user || !user.oauthToken) {
        res.status(409).json({ error: 'Google Calendar non connecté. Connectez votre compte Google pour synchroniser vos SA.' });
        return;
    }
    try {
        const { events, report } = await saCalendarService.listAndSyncForUser(userId, range.timeMin, range.timeMax);
        res.json({ events, report });
    } catch (error) {
        await replyCalendarError(res, error, userId, 'Échec de synchronisation du calendrier Google');
    }
}

/** POST /api/peda/calendar/sync — force la synchro app → Google (fenêtre optionnelle). */
export async function syncCalendar(req: AuthRequest, res: Response): Promise<void> {
    const userId = Number(req.user.id);
    const user = await userService.findById(userId);
    if (!user || !user.oauthToken) {
        res.status(409).json({ error: 'Google Calendar non connecté. Connectez votre compte Google pour synchroniser vos SA.' });
        return;
    }
    const range = parseRange((req.body ?? {}) as Record<string, unknown>);
    try {
        const report = range
            ? (await saCalendarService.listAndSyncForUser(userId, range.timeMin, range.timeMax)).report
            : await saCalendarService.syncAllForUser(userId);
        res.json({ report });
    } catch (error) {
        await replyCalendarError(res, error, userId, 'Échec de synchronisation du calendrier Google');
    }
}

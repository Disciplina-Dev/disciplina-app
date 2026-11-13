import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { UserService } from '../../services/UserService';
import { isValidEmail, normalizePhone } from '../../services/validation';
import { logger } from '../../external/logger';
import {
    BookingService,
    BookingDisabledError,
    SlotUnavailableError,
    DayBlockNotFoundError,
    DayBlockForbiddenError,
    DayBlockConflictError,
} from './service';
import { WorkingHours, WorkingWindow, BookingSettings } from './repository';

const bookingService = new BookingService();
const userService = new UserService();

const HM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Valide la structure workingHours (jours ISO "1".."7" → plages "HH:MM"). */
function parseWorkingHours(raw: unknown): WorkingHours | null {
    if (raw === null || typeof raw !== 'object') return null;
    const out: WorkingHours = {};
    for (const [day, windows] of Object.entries(raw as Record<string, unknown>)) {
        if (!/^[1-7]$/.test(day) || !Array.isArray(windows)) return null;
        const parsed: WorkingWindow[] = [];
        for (const w of windows) {
            if (!Array.isArray(w) || w.length !== 2 || !HM_RE.test(w[0]) || !HM_RE.test(w[1]) || w[0] >= w[1])
                return null;
            parsed.push([w[0], w[1]]);
        }
        out[day] = parsed;
    }
    return out;
}

function clampInt(v: unknown, min: number, max: number): number | undefined {
    const n = Number(v);
    if (!Number.isInteger(n) || n < min || n > max) return undefined;
    return n;
}

/** GET /api/booking/settings — réglages de l'utilisateur courant (créés au premier accès). */
export async function getMySettings(req: AuthRequest, res: Response): Promise<void> {
    const settings = await bookingService.getOrCreate(Number(req.user.id));
    res.json({ settings });
}

/** PUT /api/booking/settings */
export async function updateMySettings(req: AuthRequest, res: Response): Promise<void> {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const patch: Partial<BookingSettings> = {};

    if (b.enabled !== undefined) patch.enabled = Boolean(b.enabled);
    if (b.durationMin !== undefined) {
        const v = clampInt(b.durationMin, 5, 480);
        if (v === undefined) {
            res.status(400).json({ error: 'durationMin invalide (5–480)' });
            return;
        }
        patch.durationMin = v;
    }
    if (b.bufferMin !== undefined) {
        const v = clampInt(b.bufferMin, 0, 240);
        if (v === undefined) {
            res.status(400).json({ error: 'bufferMin invalide (0–240)' });
            return;
        }
        patch.bufferMin = v;
    }
    if (b.minNoticeHours !== undefined) {
        const v = clampInt(b.minNoticeHours, 0, 720);
        if (v === undefined) {
            res.status(400).json({ error: 'minNoticeHours invalide (0–720)' });
            return;
        }
        patch.minNoticeHours = v;
    }
    if (b.maxDaysAhead !== undefined) {
        const v = clampInt(b.maxDaysAhead, 1, 365);
        if (v === undefined) {
            res.status(400).json({ error: 'maxDaysAhead invalide (1–365)' });
            return;
        }
        patch.maxDaysAhead = v;
    }
    if (b.timezone !== undefined) {
        if (typeof b.timezone !== 'string' || !isValidTimezone(b.timezone)) {
            res.status(400).json({ error: 'timezone invalide' });
            return;
        }
        patch.timezone = b.timezone;
    }
    if (b.workingHours !== undefined) {
        const wh = parseWorkingHours(b.workingHours);
        if (!wh) {
            res.status(400).json({ error: 'workingHours invalide' });
            return;
        }
        patch.workingHours = wh;
    }
    if (b.title !== undefined) {
        const t = String(b.title).trim();
        if (!t || t.length > 255) {
            res.status(400).json({ error: 'title invalide' });
            return;
        }
        patch.title = t;
    }
    if (b.location !== undefined) {
        patch.location = b.location ? String(b.location).trim().slice(0, 255) : null;
    }
    if (b.confirmationSubject !== undefined) {
        patch.confirmationSubject = b.confirmationSubject ? String(b.confirmationSubject).slice(0, 255) : null;
    }
    if (b.confirmationBody !== undefined) {
        // TEXT MySQL ≈ 64 Ko ; on borne large pour éviter les abus.
        patch.confirmationBody = b.confirmationBody ? String(b.confirmationBody).slice(0, 60000) : null;
    }
    if (b.propositionSubject !== undefined) {
        patch.propositionSubject = b.propositionSubject ? String(b.propositionSubject).slice(0, 255) : null;
    }
    if (b.propositionBody !== undefined) {
        patch.propositionBody = b.propositionBody ? String(b.propositionBody).slice(0, 60000) : null;
    }

    const settings = await bookingService.update(Number(req.user.id), patch);
    res.json({ settings });
}

function isValidTimezone(tz: string): boolean {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        return true;
    } catch {
        return false;
    }
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Valide une date locale `YYYY-MM-DD` (rejette 2026-02-31, format libre, etc.). */
function parseDay(raw: unknown): string | undefined {
    if (typeof raw !== 'string' || !DAY_RE.test(raw)) return undefined;
    const date = new Date(`${raw}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) return undefined;
    return raw;
}

/** Mappe les erreurs métier de blocage vers un statut HTTP (true = géré). */
function handleBlockError(err: unknown, res: Response): boolean {
    if (err instanceof DayBlockNotFoundError) {
        res.status(404).json({ error: err.message });
        return true;
    }
    if (err instanceof DayBlockForbiddenError) {
        res.status(403).json({ error: err.message });
        return true;
    }
    if (err instanceof DayBlockConflictError) {
        res.status(409).json({ error: err.message });
        return true;
    }
    return false;
}

function parseBlockId(raw: unknown): number | undefined {
    const id = Number(raw);
    return Number.isInteger(id) && id > 0 ? id : undefined;
}

/** GET /api/booking/blocks?from=YYYY-MM-DD&to=YYYY-MM-DD — blocages visibles par l'utilisateur. */
export async function getDayBlocks(req: AuthRequest, res: Response): Promise<void> {
    const from = req.query.from === undefined ? undefined : parseDay(req.query.from);
    const to = req.query.to === undefined ? undefined : parseDay(req.query.to);
    if ((req.query.from !== undefined && !from) || (req.query.to !== undefined && !to)) {
        res.status(400).json({ error: 'from et to doivent être des dates YYYY-MM-DD' });
        return;
    }
    if (from && to && from > to) {
        res.status(400).json({ error: 'from doit précéder to' });
        return;
    }
    const blocks = await bookingService.listDayBlocks(Number(req.user.id), from, to);
    res.json({ blocks });
}

/**
 * POST /api/booking/blocks — body { day, scope: 'SELF' | 'ALL', reason }.
 * 'SELF' bloque le jour pour soi, 'ALL' pour tout le monde.
 */
export async function createDayBlock(req: AuthRequest, res: Response): Promise<void> {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const day = parseDay(b.day);
    if (!day) {
        res.status(400).json({ error: 'day invalide (YYYY-MM-DD)' });
        return;
    }
    if (b.scope !== 'SELF' && b.scope !== 'ALL') {
        res.status(400).json({ error: "scope invalide ('SELF' ou 'ALL')" });
        return;
    }
    const reason = typeof b.reason === 'string' ? b.reason.trim() : '';
    if (!reason || reason.length > 255) {
        res.status(400).json({ error: 'Motif requis (255 caractères max)' });
        return;
    }
    const userId = Number(req.user.id);
    await bookingService.blockDay(userId, { day, scope: b.scope, reason });
    res.status(201).json({ blocks: await bookingService.listDayBlocks(userId) });
}

/** POST /api/booking/blocks/:id/release — « me rendre disponible » (bascule pour un blocage global). */
export async function releaseDayBlock(req: AuthRequest, res: Response): Promise<void> {
    const id = parseBlockId(req.params.id);
    if (!id) {
        res.status(400).json({ error: 'id invalide' });
        return;
    }
    const userId = Number(req.user.id);
    try {
        await bookingService.releaseDayBlock(userId, id);
    } catch (err) {
        if (handleBlockError(err, res)) return;
        throw err;
    }
    res.json({ blocks: await bookingService.listDayBlocks(userId) });
}

/** DELETE /api/booking/blocks/:id — annule un blocage (le sien, ou un blocage global pour tout le monde). */
export async function deleteDayBlock(req: AuthRequest, res: Response): Promise<void> {
    const id = parseBlockId(req.params.id);
    if (!id) {
        res.status(400).json({ error: 'id invalide' });
        return;
    }
    const userId = Number(req.user.id);
    try {
        await bookingService.deleteDayBlock(userId, id);
    } catch (err) {
        if (handleBlockError(err, res)) return;
        throw err;
    }
    res.json({ blocks: await bookingService.listDayBlocks(userId) });
}

/** Vue publique (champs non sensibles) d'un slug. */
async function publicView(slug: string) {
    const settings = await bookingService.findBySlug(slug);
    if (!settings || !settings.enabled) return null;
    const host = await userService.findById(settings.userId);
    if (!host) return null;
    return { settings, hostName: `${host.firstName} ${host.lastName}`.trim() };
}

/** GET /api/booking/public/:slug — infos publiques de la page de réservation. */
export async function getPublicBooking(req: Request, res: Response): Promise<void> {
    const view = await publicView(req.params.slug as string);
    if (!view) {
        res.status(404).json({ error: 'Page de réservation introuvable ou désactivée' });
        return;
    }
    res.json({
        hostName: view.hostName,
        title: view.settings.title,
        durationMin: view.settings.durationMin,
        timezone: view.settings.timezone,
        location: view.settings.location,
    });
}

/** GET /api/booking/public/:slug/slots?from=YYYY-MM-DD&to=YYYY-MM-DD */
export async function getPublicSlots(req: Request, res: Response): Promise<void> {
    const { from, to } = req.query;
    if (
        typeof from !== 'string' ||
        typeof to !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(to)
    ) {
        res.status(400).json({ error: 'from et to (YYYY-MM-DD) requis' });
        return;
    }
    const settings = await bookingService.findBySlug(req.params.slug as string);
    if (!settings || !settings.enabled) {
        res.status(404).json({ error: 'Réservation indisponible' });
        return;
    }
    try {
        res.json({
            slots: await bookingService.computeSlots(settings, from, to),
            durationMin: settings.durationMin,
            timezone: settings.timezone,
        });
    } catch (err) {
        if (err instanceof BookingDisabledError) {
            res.status(409).json({ error: err.message });
            return;
        }
        logger.error({ err }, 'Booking slots compute failed');
        res.status(502).json({ error: 'Échec du calcul des créneaux' });
    }
}

/** POST /api/booking/public/:slug/book — body { start, firstName, lastName, phone, email, note? } */
export async function postBooking(req: Request, res: Response): Promise<void> {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const start = typeof b.start === 'string' ? b.start : '';
    const firstName = typeof b.firstName === 'string' ? b.firstName.trim().slice(0, 100) : '';
    const lastName = typeof b.lastName === 'string' ? b.lastName.trim().slice(0, 100) : '';
    const phone = normalizePhone(b.phone);
    const email = typeof b.email === 'string' ? b.email.trim() : '';
    const note = typeof b.note === 'string' ? b.note.trim().slice(0, 1000) : undefined;
    if (!start || !firstName || !lastName || !phone || !isValidEmail(email)) {
        res.status(400).json({ error: 'start, firstName, lastName, phone et email valides requis' });
        return;
    }
    const settings = await bookingService.findBySlug(req.params.slug as string);
    if (!settings || !settings.enabled) {
        res.status(404).json({ error: 'Réservation indisponible' });
        return;
    }
    try {
        const booked = await bookingService.book(settings, start, { firstName, lastName, phone, email, note });
        res.status(201).json({ booked });
    } catch (err) {
        if (err instanceof SlotUnavailableError) {
            res.status(409).json({ error: err.message });
            return;
        }
        if (err instanceof BookingDisabledError) {
            res.status(409).json({ error: err.message });
            return;
        }
        logger.error({ err }, 'Booking creation failed');
        res.status(502).json({ error: 'Échec de la réservation' });
    }
}

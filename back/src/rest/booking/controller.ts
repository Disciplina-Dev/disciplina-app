import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { UserService } from '../../services/UserService';
import { isValidEmail } from '../../services/validation';
import { logger } from '../../external/logger';
import { BookingService, BookingDisabledError, SlotUnavailableError } from './service';
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
    const view = await publicView(req.params.slug);
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
    const settings = await bookingService.findBySlug(req.params.slug);
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

/** POST /api/booking/public/:slug/book — body { start, name, email, note? } */
export async function postBooking(req: Request, res: Response): Promise<void> {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const start = typeof b.start === 'string' ? b.start : '';
    const name = typeof b.name === 'string' ? b.name.trim() : '';
    const email = typeof b.email === 'string' ? b.email.trim() : '';
    const note = typeof b.note === 'string' ? b.note.trim().slice(0, 1000) : undefined;
    if (!start || !name || !isValidEmail(email)) {
        res.status(400).json({ error: 'start, name et email valides requis' });
        return;
    }
    const settings = await bookingService.findBySlug(req.params.slug);
    if (!settings || !settings.enabled) {
        res.status(404).json({ error: 'Réservation indisponible' });
        return;
    }
    try {
        const booked = await bookingService.book(settings, start, { name, email, note });
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

import { randomBytes } from 'crypto';
import { BookingRepository, BookingSettings } from './repository';
import { UserService } from '../../services/UserService';
import { MailTemplateService } from '../../services/MailTemplateService';
import { GoogleCalendarService, BusyInterval } from '../../external/google/calendar.service';
import { GoogleGmailService } from '../../external/google/gmail.service';
import { withNoReply } from '../../external/google/no-reply';
import { GoogleTokens } from '../../external/google/types';
import { User } from '../../types/user.types';
import { logger } from '../../external/logger';

export interface Slot {
    /** ISO datetime UTC du début. */
    start: string;
    end: string;
}

export interface GuestInfo {
    name: string;
    email: string;
    note?: string;
}

export class BookingDisabledError extends Error {}
export class SlotUnavailableError extends Error {}

const userService = new UserService();
const gmailService = new GoogleGmailService();
const mailTemplateService = new MailTemplateService();

/** Formate un instant pour affichage dans le fuseau donné (ex "lundi 16 juin 2026 à 09:00"). */
function formatInTz(iso: string, tz: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
        timeZone: tz,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(iso));
}

/** Variables de date détaillées pour les modèles de mail. */
function dateVars(iso: string, tz: string): { jour: string; date_longue: string; date_courte: string; heure: string } {
    const d = new Date(iso);
    return {
        // Jour de la semaine seul : « lundi »
        jour: new Intl.DateTimeFormat('fr-FR', { timeZone: tz, weekday: 'long' }).format(d),
        // Date en toutes lettres sans l'heure : « lundi 22 juin 2026 »
        date_longue: new Intl.DateTimeFormat('fr-FR', {
            timeZone: tz,
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        }).format(d),
        // Date numérique : « 22/06/2026 »
        date_courte: new Intl.DateTimeFormat('fr-FR', {
            timeZone: tz,
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        }).format(d),
        // Heure seule : « 14:30 »
        heure: new Intl.DateTimeFormat('fr-FR', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(d),
    };
}

/** Remplace les variables {{cle}} d'un modèle par leurs valeurs (clés inconnues → ""). */
function renderTemplate(tpl: string, vars: Record<string, string>): string {
    return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key.toLowerCase()] ?? '');
}

/** Décalage (ms) du fuseau `tz` à l'instant `date`. Exact pour les fuseaux à offset fixe (ex Réunion). */
function tzOffsetMs(date: Date, tz: string): number {
    const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
    const map: Record<string, number> = {};
    for (const p of dtf.formatToParts(date)) if (p.type !== 'literal') map[p.type] = Number(p.value);
    const asUtc = Date.UTC(map.year, map.month - 1, map.day, map.hour === 24 ? 0 : map.hour, map.minute, map.second);
    return asUtc - date.getTime();
}

/** Convertit une date/heure locale (dans `tz`) en instant UTC. */
function zonedToUtc(year: number, month1: number, day: number, hh: number, mm: number, tz: string): Date {
    const guess = Date.UTC(year, month1 - 1, day, hh, mm);
    return new Date(guess - tzOffsetMs(new Date(guess), tz));
}

/** Jour ISO (1=lun … 7=dim) de la date calendaire {year,month,day}. */
function isoWeekday(year: number, month1: number, day: number): number {
    const d = new Date(Date.UTC(year, month1 - 1, day)).getUTCDay(); // 0=dim
    return d === 0 ? 7 : d;
}

function parseHM(hm: string): [number, number] {
    const [h, m] = hm.split(':').map(Number);
    return [h, m];
}

function overlapsBusy(startMs: number, endMs: number, busy: BusyInterval[]): boolean {
    return busy.some((b) => {
        const bs = Date.parse(b.start);
        const be = Date.parse(b.end);
        return startMs < be && endMs > bs;
    });
}

function calendarForUser(user: User): GoogleCalendarService {
    return GoogleCalendarService.fromTokens(
        { access_token: user.oauthToken ?? undefined, refresh_token: user.refreshToken ?? undefined },
        (refreshed: GoogleTokens) =>
            userService.updateGoogleTokens(user.id, refreshed.access_token ?? null, refreshed.refresh_token ?? null),
    );
}

export class BookingService {
    private repo = new BookingRepository();

    /** Renvoie les réglages de l'utilisateur, en les créant (slug aléatoire) au premier accès. */
    async getOrCreate(userId: number): Promise<BookingSettings> {
        const existing = await this.repo.findByUserId(userId);
        if (existing) return existing;
        return this.repo.create(userId, randomBytes(8).toString('hex'));
    }

    async update(userId: number, patch: Partial<BookingSettings>): Promise<BookingSettings> {
        await this.getOrCreate(userId);
        return this.repo.update(userId, patch);
    }

    async findBySlug(slug: string): Promise<BookingSettings | null> {
        return this.repo.findBySlug(slug);
    }

    /** Hôte (avec tokens Google) d'un slug, ou null si introuvable / non connecté. */
    private async hostFor(settings: BookingSettings): Promise<User | null> {
        const host = await userService.findById(settings.userId);
        return host?.oauthToken ? host : null;
    }

    /**
     * Créneaux libres entre `fromDate` et `toDate` (dates locales YYYY-MM-DD incluses),
     * bornés par le préavis minimum et l'horizon max, en retirant les périodes occupées.
     */
    async computeSlots(settings: BookingSettings, fromDate: string, toDate: string): Promise<Slot[]> {
        if (!settings.enabled) throw new BookingDisabledError('Réservation désactivée');
        const host = await this.hostFor(settings);
        if (!host) throw new BookingDisabledError('Agenda de l’hôte non connecté');

        const now = Date.now();
        const earliest = now + settings.minNoticeHours * 3600_000;
        const horizon = now + settings.maxDaysAhead * 86_400_000;

        const tz = settings.timezone;
        const stepMs = (settings.durationMin + settings.bufferMin) * 60_000;
        const durMs = settings.durationMin * 60_000;

        // Bornes de la requête freebusy : du début du 1er jour à la fin du dernier (en UTC).
        const [fy, fm, fd] = fromDate.split('-').map(Number);
        const [ty, tm, td] = toDate.split('-').map(Number);
        const rangeStart = zonedToUtc(fy, fm, fd, 0, 0, tz);
        const rangeEnd = zonedToUtc(ty, tm, td, 23, 59, tz);
        const busy = await calendarForUser(host).freeBusy(rangeStart.toISOString(), rangeEnd.toISOString());

        const slots: Slot[] = [];
        for (let cur = new Date(rangeStart); cur <= rangeEnd; cur.setUTCDate(cur.getUTCDate() + 1)) {
            // Composantes calendaires locales du jour courant.
            const local = new Intl.DateTimeFormat('en-CA', {
                timeZone: tz,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            }).format(cur);
            const [y, mo, d] = local.split('-').map(Number);
            const windows = settings.workingHours[String(isoWeekday(y, mo, d))] ?? [];
            for (const [startHM, endHM] of windows) {
                const [sh, sm] = parseHM(startHM);
                const [eh, em] = parseHM(endHM);
                const winEnd = zonedToUtc(y, mo, d, eh, em, tz).getTime();
                let slotStart = zonedToUtc(y, mo, d, sh, sm, tz).getTime();
                while (slotStart + durMs <= winEnd) {
                    const slotEnd = slotStart + durMs;
                    if (slotStart >= earliest && slotStart <= horizon && !overlapsBusy(slotStart, slotEnd, busy)) {
                        slots.push({ start: new Date(slotStart).toISOString(), end: new Date(slotEnd).toISOString() });
                    }
                    slotStart += stepMs;
                }
            }
        }
        return slots;
    }

    /** Réserve un créneau : revérifie la disponibilité puis crée l'event Google avec l'invité. */
    async book(settings: BookingSettings, startIso: string, guest: GuestInfo): Promise<{ start: string; end: string }> {
        if (!settings.enabled) throw new BookingDisabledError('Réservation désactivée');
        const host = await this.hostFor(settings);
        if (!host) throw new BookingDisabledError('Agenda de l’hôte non connecté');

        const startMs = Date.parse(startIso);
        if (Number.isNaN(startMs)) throw new SlotUnavailableError('Créneau invalide');
        const endMs = startMs + settings.durationMin * 60_000;

        // Revérifie côté serveur que le créneau est toujours libre (anti double-réservation).
        const day = new Intl.DateTimeFormat('en-CA', {
            timeZone: settings.timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(new Date(startMs));
        const available = await this.computeSlots(settings, day, day);
        if (!available.some((s) => Date.parse(s.start) === startMs)) {
            throw new SlotUnavailableError('Créneau plus disponible');
        }

        const startIsoFinal = new Date(startMs).toISOString();
        const endIsoFinal = new Date(endMs).toISOString();
        const calendar = calendarForUser(host);
        const description = [
            `Réservation par ${guest.name} (${guest.email}).`,
            guest.note ? `\nMessage : ${guest.note}` : '',
        ].join('');

        await calendar.createEvent(
            {
                summary: `${settings.title} — ${guest.name}`,
                description,
                location: settings.location ?? undefined,
                start: startIsoFinal,
                end: endIsoFinal,
                attendees: [{ email: guest.email, displayName: guest.name }],
            },
            'none', // Pas d'email d'invitation Google : on envoie notre propre confirmation.
        );

        await this.sendConfirmation(host, settings, startIsoFinal, guest);

        return { start: startIsoFinal, end: endIsoFinal };
    }

    /** Envoie un email de confirmation personnalisé à l'invité, via le compte Gmail de l'hôte. */
    private async sendConfirmation(
        host: User,
        settings: BookingSettings,
        startIso: string,
        guest: GuestInfo,
    ): Promise<void> {
        const when = formatInTz(startIso, settings.timezone);

        let subject: string;
        let html: string;
        let text: string;

        if (settings.confirmationBody && settings.confirmationBody.trim()) {
            // Modèle personnalisé : on remplace les variables {{…}}.
            const vars: Record<string, string> = {
                nom: guest.name,
                date: `${when} (${settings.timezone})`,
                ...dateVars(startIso, settings.timezone),
                lieu: settings.location ?? '',
                titre: settings.title,
                duree: `${settings.durationMin} minutes`,
                hote: `${host.firstName} ${host.lastName}`.trim(),
            };
            subject = renderTemplate(
                settings.confirmationSubject || `Confirmation de votre rendez-vous — ${settings.title}`,
                vars,
            );
            html = renderTemplate(settings.confirmationBody, vars);
            text = html.replace(/<[^>]+>/g, ''); // version texte basique
        } else {
            // Mail par défaut.
            subject = `Confirmation de votre rendez-vous — ${settings.title}`;
            const lieu = settings.location ? `<p><strong>Lieu :</strong> ${settings.location}</p>` : '';
            html = `
            <p>Bonjour ${guest.name},</p>
            <p>Votre rendez-vous « <strong>${
                settings.title
            }</strong> » avec ${`${host.firstName} ${host.lastName}`.trim()} est confirmé.</p>
            <p><strong>Date :</strong> ${when} (${settings.timezone})</p>
            <p><strong>Durée :</strong> ${settings.durationMin} minutes</p>
            ${lieu}
            <p>À bientôt,<br/>${`${host.firstName} ${host.lastName}`.trim()}</p>`;
            text =
                `Bonjour ${guest.name},\n\nVotre rendez-vous « ${
                    settings.title
                } » avec ${`${host.firstName} ${host.lastName}`.trim()} est confirmé.\n` +
                `Date : ${when} (${settings.timezone})\nDurée : ${settings.durationMin} minutes\n` +
                `${
                    settings.location ? `Lieu : ${settings.location}\n` : ''
                }\nÀ bientôt,\n${`${host.firstName} ${host.lastName}`.trim()}`;
        }

        // Signature de l'hôte ajoutée à tous les mails (best-effort).
        const signatureHtml = await mailTemplateService.getSignatureHtml(host.id, 'rh').catch(() => '');
        if (signatureHtml) html += signatureHtml;

        try {
            await gmailService.sendEmail(
                { access_token: host.oauthToken ?? undefined, refresh_token: host.refreshToken ?? undefined },
                withNoReply({ to: guest.email, subject, html, text }),
                (refreshed) =>
                    userService.updateGoogleTokens(
                        host.id,
                        refreshed.access_token ?? null,
                        refreshed.refresh_token ?? null,
                    ),
            );
        } catch (err) {
            // L'event est déjà créé : on n'échoue pas la réservation si l'email échoue.
            logger.error({ err }, 'Booking confirmation email failed');
        }
    }
}

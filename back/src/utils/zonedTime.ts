/**
 * Conversions date/heure locale ↔ instant UTC pour les fuseaux IANA des tenants.
 *
 * Les créneaux d'émargement sont saisis en heure locale (Réunion, Paris) mais
 * comparés à l'horloge serveur : c'est l'instant UTC qui fait foi. On évite
 * d'ajouter une dépendance de fuseau pour trois fonctions.
 */

interface ZonedParts {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
}

function zonedParts(date: Date, timeZone: string): ZonedParts {
    const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
    const parts: Record<string, number> = {};
    for (const part of dtf.formatToParts(date)) {
        if (part.type !== 'literal') parts[part.type] = Number(part.value);
    }
    return {
        year: parts.year,
        month: parts.month,
        day: parts.day,
        // `hour12: false` peut rendre 24 pour minuit selon les moteurs.
        hour: parts.hour === 24 ? 0 : parts.hour,
        minute: parts.minute,
        second: parts.second,
    };
}

function offsetMs(date: Date, timeZone: string): number {
    const p = zonedParts(date, timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return asUtc - date.getTime();
}

export function isIsoDate(value: unknown): value is string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function isHhMm(value: unknown): value is string {
    return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** Minutes depuis minuit pour une heure `HH:mm`. */
export function minutesOfDay(value: string): number {
    const [h, m] = value.split(':').map(Number);
    return h * 60 + m;
}

/** Jour local `YYYY-MM-DD` d'un instant dans un fuseau. */
export function localDate(date: Date, timeZone: string): string {
    const p = zonedParts(date, timeZone);
    return `${String(p.year).padStart(4, '0')}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Heure locale `HH:mm` d'un instant dans un fuseau. */
export function localTime(date: Date, timeZone: string): string {
    const p = zonedParts(date, timeZone);
    return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

/** Instant UTC correspondant à une date et une heure locales dans un fuseau. */
export function zonedDateTimeToUtc(date: string, time: string, timeZone: string): Date {
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    const guess = Date.UTC(year, month - 1, day, hour, minute);
    // Deux passes : la première approxime l'instant, la seconde corrige le
    // décalage autour d'un changement d'heure (le fuseau peut avoir bougé).
    const first = guess - offsetMs(new Date(guess), timeZone);
    const second = guess - offsetMs(new Date(first), timeZone);
    return new Date(second);
}

function addDays(date: string, days: number): string {
    const [year, month, day] = date.split('-').map(Number);
    const next = new Date(Date.UTC(year, month - 1, day + days));
    return next.toISOString().slice(0, 10);
}

/** Dernière milliseconde de la journée locale (lien formateur valable jusqu'au soir). */
export function endOfLocalDay(date: string, timeZone: string): Date {
    const nextMidnight = zonedDateTimeToUtc(addDays(date, 1), '00:00', timeZone);
    return new Date(nextMidnight.getTime() - 1);
}

/** Date longue française (ex. « lundi 3 novembre 2026 ») pour les e-mails. */
export function formatLongDateFr(date: string, timeZone: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
        timeZone,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(zonedDateTimeToUtc(date, '12:00', timeZone));
}

export type WindowState = 'upcoming' | 'open' | 'closed';

export function windowState(now: Date, start: Date, end: Date): WindowState {
    if (now.getTime() < start.getTime()) return 'upcoming';
    if (now.getTime() > end.getTime()) return 'closed';
    return 'open';
}

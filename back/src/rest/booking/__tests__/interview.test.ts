import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { env } from '../../../config/env';
import { getPool } from '../../../db/mysql/connection';
import { UserRepository } from '../../../repositories/mysql/UserRepository';
import { GoogleCalendarService, type CalendarEvent } from '../../../external/google/calendar.service';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { dropMongo, truncateMysql } from '../../../../test/helpers/db';
import { spyOnGoogleMail } from '../../../../test/helpers/googleMail';

const BASE = `http://localhost:${env.API_PORT}/api/booking`;
const REPORT = `http://localhost:${env.API_PORT}/api/rh-kpi/report`;
const suffix = Date.now();
const REUNION = 'Indian/Reunion';
const GUEST_EMAIL = 'invite.booking@test.local';

const CREATED: number[] = [];

interface Host {
    id: number;
    slug: string;
    headers: Record<string, string>;
}

interface BookInput {
    summary: string;
    attendeeEmail?: string;
    attendeeFirstName?: string;
    attendeeLastName?: string;
    isInterview?: boolean;
}

/**
 * Faux agenda Google en mémoire (seule frontière mockable, cf. HOWTOTEST) : suffisant
 * pour vérifier ce que la réservation écrit et pour le dédoublonnage KPI par email.
 */
function mockCalendar(): { events: Map<string, CalendarEvent>; created: BookInput[] } {
    const events = new Map<string, CalendarEvent>();
    const created: BookInput[] = [];
    const proto = GoogleCalendarService.prototype;

    vi.spyOn(proto, 'freeBusy').mockResolvedValue([]);
    vi.spyOn(proto, 'createEvent').mockImplementation(async (input) => {
        created.push(input);
        const event: CalendarEvent = {
            id: `evt-${events.size + 1}`,
            summary: input.summary,
            start: input.start,
            end: input.end,
            allDay: false,
            attendeeEmail: input.attendeeEmail,
            attendeeFirstName: input.attendeeFirstName,
            attendeeLastName: input.attendeeLastName,
            isInterview: Boolean(input.isInterview),
        };
        events.set(event.id, event);
        return { ...event };
    });
    vi.spyOn(proto, 'listEventsByAttendeeEmail').mockImplementation(async (email, timeMin, timeMax) => {
        const min = Date.parse(timeMin);
        const max = Date.parse(timeMax);
        return [...events.values()]
            .filter((e) => e.attendeeEmail === email && Date.parse(e.start) >= min && Date.parse(e.start) < max)
            .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    });

    return { events, created };
}

async function seedHost(label: string): Promise<Host> {
    const email = `booking-interview-${label}-${suffix}@test.local`;
    const id = await new UserRepository().create({
        email,
        first_name: 'RH',
        last_name: `Entretien ${label}`,
        password: 'hashed',
        role_id: 2,
        permission_id: 1,
        oauth_token: 'oauth-access-token',
        refresh_token: 'oauth-refresh-token',
    });
    CREATED.push(id);

    const { cookieHeader, csrfHeader } = mintAuthCookies({ id, email, role: 'RH', permission: 'EMPLOYEE' });
    const headers = {
        Cookie: cookieHeader,
        'x-csrf-token': csrfHeader,
        'Content-Type': 'application/json',
    };

    // Tous les jours 9h–12h, 30 min : la page publique propose donc de nombreux créneaux.
    const res = await fetch(`${BASE}/settings`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
            timezone: REUNION,
            durationMin: 30,
            bufferMin: 0,
            minNoticeHours: 0,
            maxDaysAhead: 30,
            workingHours: Object.fromEntries(
                ['1', '2', '3', '4', '5', '6', '7'].map((day) => [day, [['09:00', '12:00']]]),
            ),
        }),
    });
    expect(res.status).toBe(200);
    const { settings } = (await res.json()) as { settings: { slug: string } };
    return { id, slug: settings.slug, headers };
}

/** Créneaux proposés par la page publique sur une fenêtre de quelques jours. */
async function slots(slug: string, from: string, to: string): Promise<string[]> {
    const res = await fetch(`${BASE}/public/${slug}/slots?from=${from}&to=${to}`);
    expect(res.status).toBe(200);
    return ((await res.json()) as { slots: { start: string }[] }).slots.map((s) => s.start);
}

function book(slug: string, start: string, email = GUEST_EMAIL): Promise<Response> {
    return fetch(`${BASE}/public/${slug}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start, firstName: 'Marie', lastName: 'Dupont', phone: '0692000000', email }),
    });
}

/** Total d'une colonne KPI RH pour une année, lu via l'API comme le front. */
async function kpiTotal(host: Host, year: number, column: string): Promise<number> {
    const res = await fetch(`${REPORT}?year=${year}`, { headers: host.headers });
    expect(res.status).toBe(200);
    const report = (await res.json()) as { weeks: { totals: Record<string, number> }[] };
    return report.weeks.reduce((sum, week) => sum + Number(week.totals[column] ?? 0), 0);
}

/** Deux jours locaux (Réunion) à venir, dans l'horizon de réservation. */
function upcomingDays(): [string, string] {
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: REUNION,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    const first = new Date(Date.now() + 2 * 86_400_000);
    const second = new Date(Date.now() + 3 * 86_400_000);
    return [fmt.format(first), fmt.format(second)];
}

beforeEach(async () => {
    await truncateMysql();
    await dropMongo();
    vi.restoreAllMocks();
});

afterEach(() => {
    vi.restoreAllMocks();
});

afterAll(async () => {
    // booking_settings n'est pas dans CLEARED_TABLES : on retire les lignes de ce fichier.
    const conn = await getPool('reunion').getConnection();
    try {
        await conn.query('SET FOREIGN_KEY_CHECKS = 0');
        for (const id of CREATED) await conn.execute('DELETE FROM booking_settings WHERE user_id = ?', [id]);
        await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    } finally {
        conn.release();
    }
});

describe('Réservation publique — le rendez-vous est un entretien', () => {
    it('marque le créneau comme entretien et y stocke l’identité de l’invité', async () => {
        spyOnGoogleMail();
        const { created } = mockCalendar();
        const host = await seedHost('create');
        const [day] = upcomingDays();

        const [start] = await slots(host.slug, day, day);
        expect(start).toBeTruthy();
        const res = await book(host.slug, start);
        expect(res.status).toBe(201);

        expect(created).toHaveLength(1);
        expect(created[0]).toMatchObject({
            attendeeEmail: GUEST_EMAIL,
            attendeeFirstName: 'Marie',
            attendeeLastName: 'Dupont',
            isInterview: true,
        });
        expect(created[0].summary).toContain('Marie Dupont');

        // Le RH dont le lien a été utilisé crédite « entretien placé » à la date du rendez-vous.
        expect(await kpiTotal(host, new Date(start).getFullYear(), 'interviews_placed')).toBe(1);
    });

    it('ne crédite « entretien placé » qu’une fois pour un même email', async () => {
        spyOnGoogleMail();
        const { created } = mockCalendar();
        const host = await seedHost('dedupe');
        const [firstDay, secondDay] = upcomingDays();

        const [firstStart] = await slots(host.slug, firstDay, firstDay);
        const [secondStart] = await slots(host.slug, secondDay, secondDay);
        expect(firstStart).toBeTruthy();
        expect(secondStart).toBeTruthy();

        expect((await book(host.slug, firstStart)).status).toBe(201);
        expect((await book(host.slug, secondStart)).status).toBe(201);
        expect(created).toHaveLength(2);

        expect(await kpiTotal(host, new Date(firstStart).getFullYear(), 'interviews_placed')).toBe(1);
    });
});

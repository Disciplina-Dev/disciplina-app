import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { dropMongo, truncateMysql } from '../../../../test/helpers/db';
import { spyOnGoogleMail } from '../../../../test/helpers/googleMail';
import { env } from '../../../config/env';
import { getConnection, query } from '../../../db/mysql/connection';
import { GoogleCalendarService, type CalendarEvent } from '../../../external/google/calendar.service';

const EVENTS_ENDPOINT = `http://localhost:${env.API_PORT}/api/calendar/events`;
const EMAIL = 'candidat.kpi@test.local';

/**
 * Faux agenda Google : les événements vivent en mémoire et se comportent comme
 * l'API réelle (filtre `privateExtendedProperty=attendeeEmail=…` + fenêtre de dates).
 * Le service est dans `external/*`, seule frontière que les tests ont le droit de mocker.
 */
function mockCalendar(): Map<string, CalendarEvent> {
    const events = new Map<string, CalendarEvent>();
    const proto = GoogleCalendarService.prototype;

    vi.spyOn(proto, 'createEvent').mockImplementation(async (input) => {
        const event: CalendarEvent = {
            id: `evt-${events.size + 1}`,
            summary: input.summary,
            description: input.description,
            location: input.location,
            start: input.start,
            end: input.end,
            allDay: Boolean(input.allDay),
            colorId: input.colorId,
            meetingLink: input.meetingLink,
            attendeeEmail: input.attendeeEmail,
            attendeeFirstName: input.attendeeFirstName,
            attendeeLastName: input.attendeeLastName,
            isInterview: Boolean(input.isInterview),
        };
        events.set(event.id, event);
        return { ...event };
    });
    vi.spyOn(proto, 'getEvent').mockImplementation(async (id) => {
        const found = events.get(id);
        if (!found) throw new Error(`event ${id} not found`);
        return { ...found };
    });
    vi.spyOn(proto, 'updateEvent').mockImplementation(async (id, input) => {
        const next = { ...events.get(id)!, start: input.start, end: input.end };
        // Le report écrit la présence dans le même PATCH (cf. `CalendarEventInput.attendance`).
        if (input.attendance) next.attendance = input.attendance;
        events.set(id, next);
        return { ...next };
    });
    vi.spyOn(proto, 'setAttendance').mockImplementation(async (id, attendance) => {
        const next = { ...events.get(id)!, attendance };
        events.set(id, next);
        return { ...next };
    });
    vi.spyOn(proto, 'listEventsByAttendeeEmail').mockImplementation(async (email, timeMin, timeMax) => {
        const min = Date.parse(timeMin);
        const max = Date.parse(timeMax);
        return [...events.values()]
            .filter((e) => e.attendeeEmail === email && Date.parse(e.start) >= min && Date.parse(e.start) < max)
            .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    });

    return events;
}

/** Totaux KPI RH d'une année (et éventuellement d'un mois), lus via l'API comme le front. */
async function kpiTotals(
    auth: ReturnType<typeof mintAuthCookies>,
    year: number,
    month?: number,
): Promise<Record<string, number>> {
    const res = await fetch(`http://localhost:${env.API_PORT}/api/rh-kpi/report?year=${year}`, {
        headers: { Cookie: auth.cookieHeader },
    });
    expect(res.status).toBe(200);
    const report = (await res.json()) as {
        weeks: { month: number; totals: Record<string, number> }[];
    };
    const totals: Record<string, number> = {};
    for (const week of report.weeks) {
        if (month != null && week.month !== month) continue;
        for (const [key, value] of Object.entries(week.totals)) {
            totals[key] = (totals[key] ?? 0) + Number(value);
        }
    }
    return totals;
}

describe('/api/calendar — KPI entretiens (un seul rendez-vous compté par email)', () => {
    const suffix = `cal-kpi-${Date.now()}`;

    async function seedRh(): Promise<ReturnType<typeof mintAuthCookies>> {
        const conn = await getConnection();
        let id: number;
        try {
            const [result] = await conn.execute(
                'INSERT INTO users (email, first_name, last_name, password, role_id, permission_id, oauth_token, refresh_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    `${suffix}-${Math.random().toString(36).slice(2)}@test.local`,
                    'Kpi',
                    'Owner',
                    `pwd-${suffix}`,
                    2, // RH
                    1, // EMPLOYEE
                    'access-token',
                    'refresh-token',
                ],
            );
            id = (result as { insertId: number }).insertId;
        } finally {
            conn.release();
        }
        return mintAuthCookies({ id, email: `${suffix}-${id}@test.local`, role: 'RH', permission: 'EMPLOYEE' });
    }

    function headers(auth: ReturnType<typeof mintAuthCookies>): Record<string, string> {
        return { Cookie: auth.cookieHeader, 'x-csrf-token': auth.csrfHeader, 'Content-Type': 'application/json' };
    }

    async function postEvent(auth: ReturnType<typeof mintAuthCookies>, body: unknown): Promise<Response> {
        return fetch(EVENTS_ENDPOINT, { method: 'POST', headers: headers(auth), body: JSON.stringify(body) });
    }

    async function patchEvent(
        auth: ReturnType<typeof mintAuthCookies>,
        path: string,
        body: unknown,
    ): Promise<Response> {
        return fetch(`${EVENTS_ENDPOINT}${path}`, {
            method: 'PATCH',
            headers: headers(auth),
            body: JSON.stringify(body),
        });
    }

    function interview(start: string, end: string, email = EMAIL) {
        return { summary: 'Entretien', start, end, attendeeEmail: email, isInterview: true };
    }

    beforeEach(async () => {
        await truncateMysql();
        await dropMongo();
        await query('DELETE FROM booking_settings');
        spyOnGoogleMail();
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        // La création d'un créneau avec email appelle `bookingService.getOrCreate` : on
        // nettoie la ligne pour ne pas polluer les fichiers de test suivants (ids remis à 1).
        await query('DELETE FROM booking_settings');
    });

    it('credits « placé » once when the same email is placed twice', async () => {
        const auth = await seedRh();
        mockCalendar();

        const first = await postEvent(auth, interview('2024-06-03T09:00:00.000Z', '2024-06-03T10:00:00.000Z'));
        const second = await postEvent(auth, interview('2024-06-10T09:00:00.000Z', '2024-06-10T10:00:00.000Z'));

        expect(first.status).toBe(201);
        expect(second.status).toBe(201);
        expect((await kpiTotals(auth, 2024)).interviews_placed).toBe(1);
    });

    it('still credits « placé » for a different attendee email', async () => {
        const auth = await seedRh();
        mockCalendar();

        await postEvent(auth, interview('2024-06-03T09:00:00.000Z', '2024-06-03T10:00:00.000Z'));
        await postEvent(auth, interview('2024-06-10T09:00:00.000Z', '2024-06-10T10:00:00.000Z', 'autre@test.local'));

        expect((await kpiTotals(auth, 2024)).interviews_placed).toBe(2);
    });

    it('credits the attendance category only on the first meeting of the email', async () => {
        const auth = await seedRh();
        mockCalendar();
        await postEvent(auth, interview('2024-06-03T09:00:00.000Z', '2024-06-03T10:00:00.000Z'));
        await postEvent(auth, interview('2024-06-10T09:00:00.000Z', '2024-06-10T10:00:00.000Z'));

        // Le 2ᵉ créneau du même candidat ne doit pas ajouter « venu ».
        const second = await patchEvent(auth, '/evt-2/attendance', { status: 'arrived' });
        expect(second.status).toBe(200);
        expect((await kpiTotals(auth, 2024)).interviews_attended ?? 0).toBe(0);

        // Le premier créneau, lui, compte normalement.
        const first = await patchEvent(auth, '/evt-1/attendance', { status: 'arrived' });
        expect(first.status).toBe(200);
        expect((await kpiTotals(auth, 2024)).interviews_attended).toBe(1);
    });

    it('moves the interview to the requested slot and credits « reporté » on the new date', async () => {
        const auth = await seedRh();
        mockCalendar();
        await postEvent(auth, interview('2024-06-03T09:00:00.000Z', '2024-06-03T10:00:00.000Z'));

        const res = await patchEvent(auth, '/evt-1/report', {
            start: '2024-07-01T09:00:00.000Z',
            end: '2024-07-01T10:00:00.000Z',
        });

        expect(res.status).toBe(200);
        const { event } = (await res.json()) as { event: CalendarEvent };
        expect(event.start).toBe('2024-07-01T09:00:00.000Z');
        expect(event.attendance).toBe('postponed');

        const june = await kpiTotals(auth, 2024, 6);
        const july = await kpiTotals(auth, 2024, 7);
        expect(june.interviews_placed ?? 0).toBe(0);
        expect(july.interviews_placed).toBe(1);
        expect(july.interviews_postponed).toBe(1);
    });

    it('rejects a report when the slot is not an interview', async () => {
        const auth = await seedRh();
        mockCalendar();
        await postEvent(auth, {
            summary: 'Réunion',
            start: '2024-06-03T09:00:00.000Z',
            end: '2024-06-03T10:00:00.000Z',
        });

        const res = await patchEvent(auth, '/evt-1/report', {
            start: '2024-07-01T09:00:00.000Z',
            end: '2024-07-01T10:00:00.000Z',
        });

        expect(res.status).toBe(400);
    });

    it('rejects a report with an invalid time range', async () => {
        const auth = await seedRh();
        mockCalendar();
        await postEvent(auth, interview('2024-06-03T09:00:00.000Z', '2024-06-03T10:00:00.000Z'));

        const res = await patchEvent(auth, '/evt-1/report', {
            start: '2024-07-01T10:00:00.000Z',
            end: '2024-07-01T09:00:00.000Z',
        });

        expect(res.status).toBe(400);
    });
});

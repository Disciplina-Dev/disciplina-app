import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { env } from '../../../config/env';
import { UserRepository } from '../../../repositories/mysql/UserRepository';
import {
    GoogleCalendarService,
    type CalendarEvent,
    type CalendarEventInput,
} from '../../../external/google/calendar.service';
import type { CalendarEventView } from '../../calendar/controller';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { truncateMysql } from '../../../../test/helpers/db';
import { spyOnGoogleMail } from '../../../../test/helpers/googleMail';

const BOOKING = `http://localhost:${env.API_PORT}/api/booking`;
const CALENDAR = `http://localhost:${env.API_PORT}/api/calendar`;
const suffix = Date.now();
const REUNION = 'Indian/Reunion';
const SAME_SECTOR = 'Ouest';
const OTHER_SECTOR = 'Sud';

/** Jour local Réunion (YYYY-MM-DD) à J+2, dans l'horizon de réservation. */
const DAY = new Intl.DateTimeFormat('en-CA', {
    timeZone: REUNION,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
}).format(new Date(Date.now() + 2 * 86_400_000));

interface Host {
    id: number;
    email: string;
    slug: string;
    headers: Record<string, string>;
}

/** RH avec un agenda Google factice et une page de réservation ouverte 9h–12h tous les jours. */
async function seedHost(label: string, sectors: string[]): Promise<Host> {
    const email = `booking-cross-${label}-${suffix}@test.local`;
    const id = await new UserRepository().create({
        email,
        first_name: 'RH',
        last_name: `Secteur ${label}`,
        password: 'hashed',
        role_id: 2,
        permission_id: 1,
        sectors,
        oauth_token: 'oauth-access-token',
        refresh_token: 'oauth-refresh-token',
    });

    const { cookieHeader, csrfHeader } = mintAuthCookies({
        id,
        email,
        role: 'RH',
        permission: 'EMPLOYEE',
        region: 'reunion',
    });
    const headers = {
        Cookie: cookieHeader,
        'x-csrf-token': csrfHeader,
        'Content-Type': 'application/json',
    };

    const res = await fetch(`${BOOKING}/settings`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
            timezone: REUNION,
            durationMin: 30,
            bufferMin: 0,
            minNoticeHours: 0,
            maxDaysAhead: 365,
            workingHours: Object.fromEntries(
                ['1', '2', '3', '4', '5', '6', '7'].map((day) => [day, [['09:00', '12:00']]]),
            ),
        }),
    });
    expect(res.status).toBe(200);
    const { settings } = (await res.json()) as { settings: { slug: string } };
    return { id, email, slug: settings.slug, headers };
}

/** Créneaux proposés par la page publique d'un RH sur le jour de test. */
async function slotsFor(host: Host, day = DAY): Promise<string[]> {
    const res = await fetch(`${BOOKING}/public/${host.slug}/slots?from=${day}&to=${day}`);
    expect(res.status).toBe(200);
    return ((await res.json()) as { slots: { start: string }[] }).slots.map((s) => s.start);
}

function book(host: Host, start: string): Promise<Response> {
    return fetch(`${BOOKING}/public/${host.slug}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            start,
            firstName: 'Marie',
            lastName: 'Dupont',
            phone: '0692000000',
            email: `invite-${start}@test.local`,
        }),
    });
}

function createInterview(host: Host, start: string, end: string): Promise<Response> {
    return fetch(`${CALENDAR}/events`, {
        method: 'POST',
        headers: host.headers,
        body: JSON.stringify({ summary: 'Entretien — Jean Test', start, end, isInterview: true }),
    });
}

/** Événements exposés par l'agenda d'un RH (dont les créneaux occupés par ses collègues). */
async function eventsFor(viewer: Host, ownerId: number): Promise<CalendarEventView[]> {
    const timeMin = new Date(`${DAY}T00:00:00Z`).toISOString();
    const timeMax = new Date(`${DAY}T23:59:59Z`).toISOString();
    const res = await fetch(`${CALENDAR}/events?timeMin=${timeMin}&timeMax=${timeMax}&userId=${ownerId}`, {
        headers: viewer.headers,
    });
    expect(res.status).toBe(200);
    return ((await res.json()) as { events: CalendarEventView[] }).events;
}

/**
 * Faux agenda Google en mémoire (seule frontière mockable, cf. HOWTOTEST) :
 * les créneaux sont rendus disponibles par `freeBusy` = [] et la liste
 * d'événements reste vide, seules les occupations (#1241) sont observables.
 */
function mockCalendar(): { created: CalendarEvent[] } {
    const created: CalendarEvent[] = [];
    const proto = GoogleCalendarService.prototype;

    vi.spyOn(proto, 'freeBusy').mockResolvedValue([]);
    vi.spyOn(proto, 'listEvents').mockResolvedValue([]);
    vi.spyOn(proto, 'listEventsByAttendeeEmail').mockResolvedValue([]);
    vi.spyOn(proto, 'createEvent').mockImplementation(async (input: CalendarEventInput) => {
        const event: CalendarEvent = {
            id: `evt-${created.length + 1}`,
            summary: input.summary,
            start: input.start,
            end: input.end,
            allDay: false,
            isInterview: Boolean(input.isInterview),
        };
        created.push(event);
        return { ...event };
    });
    vi.spyOn(proto, 'getEvent').mockImplementation(async (id: string) => {
        const event = created.find((e) => e.id === id);
        if (!event) throw new Error(`Événement ${id} introuvable`);
        return { ...event };
    });
    vi.spyOn(proto, 'deleteEvent').mockResolvedValue(undefined);

    return { created };
}

beforeEach(async () => {
    await truncateMysql();
    vi.restoreAllMocks();
    spyOnGoogleMail();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('Créneau d’entretien occupé — blocage des RH du même secteur (#1241)', () => {
    it('une réservation publique retire le créneau des RH du même secteur, pas des autres', async () => {
        const { created } = mockCalendar();
        const alice = await seedHost('public-a', [SAME_SECTOR]);
        const bob = await seedHost('public-b', [SAME_SECTOR]);
        const carol = await seedHost('public-c', [OTHER_SECTOR]);

        const [start] = await slotsFor(alice);
        expect(start).toBeTruthy();
        expect((await book(alice, start)).status).toBe(201);
        expect(created).toHaveLength(1);

        // Même secteur : le créneau n'est plus proposé.
        expect(await slotsFor(bob)).not.toContain(start);
        // Autre secteur : il reste disponible.
        expect(await slotsFor(carol)).toContain(start);
    });

    it('un entretien posé depuis l’agenda bloque le même créneau dans le secteur', async () => {
        mockCalendar();
        const alice = await seedHost('calendar-a', [SAME_SECTOR]);
        const bob = await seedHost('calendar-b', [SAME_SECTOR]);
        const carol = await seedHost('calendar-c', [OTHER_SECTOR]);

        const [start] = await slotsFor(alice);
        const end = new Date(Date.parse(start) + 30 * 60_000).toISOString();
        expect((await createInterview(alice, start, end)).status).toBe(201);

        expect(await slotsFor(bob)).not.toContain(start);
        expect(await slotsFor(carol)).toContain(start);
    });

    it('refuse (409) un entretien sur le créneau déjà pris par un collègue du secteur', async () => {
        mockCalendar();
        const alice = await seedHost('conflict-a', [SAME_SECTOR]);
        const bob = await seedHost('conflict-b', [SAME_SECTOR]);
        const carol = await seedHost('conflict-c', [OTHER_SECTOR]);

        const [start] = await slotsFor(alice);
        const end = new Date(Date.parse(start) + 30 * 60_000).toISOString();
        expect((await createInterview(alice, start, end)).status).toBe(201);

        // Même secteur : le créneau est bloqué.
        const conflict = await createInterview(bob, start, end);
        expect(conflict.status).toBe(409);
        expect(((await conflict.json()) as { error: string }).error).toContain('déjà réservé');

        // Autre secteur : aucun conflit.
        expect((await createInterview(carol, start, end)).status).toBe(201);
    });

    it('affiche le créneau occupé dans l’agenda des collègues du secteur', async () => {
        mockCalendar();
        const alice = await seedHost('display-a', [SAME_SECTOR]);
        const bob = await seedHost('display-b', [SAME_SECTOR]);

        const [start] = await slotsFor(alice);
        const end = new Date(Date.parse(start) + 30 * 60_000).toISOString();
        expect((await createInterview(alice, start, end)).status).toBe(201);

        const events = await eventsFor(alice, bob.id);
        const occupation = events.find((e) => e.isOccupation);
        expect(occupation).toMatchObject({
            summary: 'Entretien — Jean Test',
            start,
            end,
            isOccupation: true,
        });
        expect(occupation?.occupationOwnerName).toContain('Secteur display-a');

        // L'agenda d'Alice n'expose pas ses propres créneaux « calendrier » en
        // doublon : ils y sont déjà comme événements Google.
        const own = await eventsFor(alice, alice.id);
        expect(own.filter((e) => e.isOccupation)).toHaveLength(0);
    });

    it('supprimer l’entretien libère le créneau pour le secteur', async () => {
        mockCalendar();
        const alice = await seedHost('delete-a', [SAME_SECTOR]);
        const bob = await seedHost('delete-b', [SAME_SECTOR]);

        const [start] = await slotsFor(alice);
        const end = new Date(Date.parse(start) + 30 * 60_000).toISOString();
        const res = await createInterview(alice, start, end);
        expect(res.status).toBe(201);
        const { event } = (await res.json()) as { event: CalendarEvent };
        expect(await slotsFor(bob)).not.toContain(start);

        const del = await fetch(`${CALENDAR}/events/${event.id}`, { method: 'DELETE', headers: alice.headers });
        expect(del.status).toBe(204);
        expect(await slotsFor(bob)).toContain(start);
    });
});

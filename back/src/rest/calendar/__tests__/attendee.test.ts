import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { truncateMysql } from '../../../../test/helpers/db';
import { env } from '../../../config/env';
import pool from '../../../db/mysql/connection';
import { GoogleCalendarService } from '../../../external/google/calendar.service';

const EVENTS_ENDPOINT = `http://localhost:${env.API_PORT}/api/calendar/events`;
const START = '2024-06-03T09:00:00.000Z';
const END = '2024-06-03T10:00:00.000Z';

/**
 * Service Calendar branché sur un faux client Google : vérifie le mapping
 * `CalendarEventInput` ↔ `extendedProperties.private` sans appel réseau.
 */
function serviceWithFakeClient(client: object): GoogleCalendarService {
    const service = Object.create(GoogleCalendarService.prototype) as GoogleCalendarService;
    Object.assign(service, { calendar: client });
    return service;
}

describe('Calendar attendee name — extended properties mapping', () => {
    it('writes the attendee nom/prénom into private extended properties', async () => {
        let sent: any;
        const service = serviceWithFakeClient({
            events: {
                insert: async (params: any) => {
                    sent = params.requestBody;
                    return { data: { ...params.requestBody, id: 'evt-1' } };
                },
            },
        });

        const event = await service.createEvent({
            summary: 'Entretien',
            start: START,
            end: END,
            attendeeEmail: 'jean.dupont@test.local',
            attendeeFirstName: 'Jean',
            attendeeLastName: 'Dupont',
        });

        expect(sent.extendedProperties.private).toMatchObject({
            attendeeEmail: 'jean.dupont@test.local',
            attendeeFirstName: 'Jean',
            attendeeLastName: 'Dupont',
        });
        // Aller-retour : les champs relus depuis l'événement Google sont bien exposés.
        expect(event.attendeeFirstName).toBe('Jean');
        expect(event.attendeeLastName).toBe('Dupont');
    });

    it('reads a legacy event (no name keys) without breaking anything', async () => {
        const service = serviceWithFakeClient({
            events: {
                list: async () => ({
                    data: {
                        items: [
                            {
                                id: 'legacy-1',
                                summary: 'Entretien historique',
                                start: { dateTime: START },
                                end: { dateTime: END },
                                extendedProperties: { private: { attendeeEmail: 'old@test.local', meetingLink: '' } },
                            },
                        ],
                    },
                }),
            },
        });

        const [event] = await service.listEvents(START, END);

        expect(event.attendeeEmail).toBe('old@test.local');
        expect(event.attendeeFirstName).toBeUndefined();
        expect(event.attendeeLastName).toBeUndefined();
    });
});

/** Espionne la création Google et expose l'input transmis par le contrôleur. */
function spyCreateEvent(): { captured: () => any } {
    let captured: any;
    vi.spyOn(GoogleCalendarService.prototype, 'createEvent').mockImplementation(async (input) => {
        captured = input;
        return {
            id: 'evt-1',
            summary: input.summary,
            start: input.start,
            end: input.end,
            allDay: false,
            attendeeEmail: input.attendeeEmail,
            attendeeFirstName: input.attendeeFirstName,
            attendeeLastName: input.attendeeLastName,
        };
    });
    return { captured: () => captured };
}

describe('POST /api/calendar/events — attendee name fields', () => {
    const suffix = `cal-att-${Date.now()}`;

    async function seedRh(): Promise<{ id: number; auth: ReturnType<typeof mintAuthCookies> }> {
        const conn = await pool.getConnection();
        let id: number;
        try {
            const [result] = await conn.execute(
                'INSERT INTO users (email, first_name, last_name, password, role_id, permission_id, oauth_token, refresh_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    `${suffix}-${Math.random().toString(36).slice(2)}@test.local`,
                    'Cal',
                    'Owner',
                    `pwd-${suffix}`,
                    2, // RH
                    1,
                    'access-token',
                    'refresh-token',
                ],
            );
            id = (result as { insertId: number }).insertId;
        } finally {
            conn.release();
        }
        const auth = mintAuthCookies({ id, email: `${suffix}-${id}@test.local`, role: 'RH', permission: 'EMPLOYEE' });
        return { id, auth };
    }

    async function postEvent(auth: ReturnType<typeof mintAuthCookies>, body: unknown): Promise<Response> {
        return fetch(EVENTS_ENDPOINT, {
            method: 'POST',
            headers: {
                Cookie: auth.cookieHeader,
                'x-csrf-token': auth.csrfHeader,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
    }

    beforeEach(async () => {
        await truncateMysql();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('accepts optional nom/prénom and forwards them trimmed', async () => {
        const { auth } = await seedRh();
        const spy = spyCreateEvent();

        const res = await postEvent(auth, {
            summary: 'Entretien',
            start: START,
            end: END,
            attendeeFirstName: '  Jean ',
            attendeeLastName: ' Dupont ',
        });

        expect(res.status).toBe(201);
        expect(spy.captured().attendeeFirstName).toBe('Jean');
        expect(spy.captured().attendeeLastName).toBe('Dupont');
    });

    it('still creates a slot when the name fields are omitted (rétro-compatibilité)', async () => {
        const { auth } = await seedRh();
        const spy = spyCreateEvent();

        const res = await postEvent(auth, { summary: 'Créneau historique', start: START, end: END });

        expect(res.status).toBe(201);
        expect(spy.captured().attendeeFirstName).toBeUndefined();
        expect(spy.captured().attendeeLastName).toBeUndefined();
    });

    it('ignores non-string nom/prénom values instead of failing', async () => {
        const { auth } = await seedRh();
        const spy = spyCreateEvent();

        const res = await postEvent(auth, {
            summary: 'Entretien',
            start: START,
            end: END,
            attendeeFirstName: 42,
            attendeeLastName: ['x'],
        });

        expect(res.status).toBe(201);
        expect(spy.captured().attendeeFirstName).toBeUndefined();
        expect(spy.captured().attendeeLastName).toBeUndefined();
    });
});

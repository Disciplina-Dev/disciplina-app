import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { truncateMysql } from '../../../../test/helpers/db';
import { env } from '../../../config/env';
import pool from '../../../db/mysql/connection';
import { GoogleCalendarService, type CalendarEvent } from '../../../external/google/calendar.service';
import { AlternantService } from '../../../services/AlternantService';
import { UserService } from '../../../services/UserService';

const EventsUrl = `http://localhost:${env.API_PORT}/api/peda/calendar/events`;
const SyncUrl = `http://localhost:${env.API_PORT}/api/peda/calendar/sync`;
const RANGE = '?timeMin=2000-01-01T00:00:00Z&timeMax=2100-01-01T00:00:00Z';

const userService = new UserService();

describe('Peda SA calendar REST API', () => {
    const suffix = `sa-cal-${Date.now()}`;

    async function seedPedaUser(connected: boolean): Promise<{ id: number; auth: ReturnType<typeof mintAuthCookies> }> {
        const conn = await pool.getConnection();
        let id: number;
        try {
            const [result] = await conn.execute(
                'INSERT INTO users (email, first_name, last_name, password, role_id, permission_id, oauth_token, refresh_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    `${suffix}-${Math.random().toString(36).slice(2)}@test.local`,
                    'Peda',
                    'Calendar',
                    `pwd-${suffix}`,
                    3,
                    1,
                    connected ? 'access-token' : null,
                    connected ? 'refresh-token' : null,
                ],
            );
            id = (result as { insertId: number }).insertId;
        } finally {
            conn.release();
        }
        const auth = mintAuthCookies({
            id,
            email: `${suffix}-${id}@test.local`,
            role: 'PEDA',
            permission: 'EMPLOYEE',
        });
        return { id, auth };
    }

    async function createAlternantWithSequences(): Promise<{ alternantId: string }> {
        const service = new AlternantService();
        const alternant = await service.create({
            firstName: 'Léa',
            lastName: `Calendar${suffix}`,
            session: `SESSION-${suffix}`,
            company: {
                name: 'Acme',
                address: '12 rue des Palmiers, Saint-Denis',
                mentorName: 'Jean Dupont',
                startDate: '2026-01-05',
            },
        });
        return { alternantId: alternant._id };
    }

    function get(url: string, auth: ReturnType<typeof mintAuthCookies>): Promise<Response> {
        return fetch(url, { headers: { Cookie: auth.cookieHeader } });
    }

    beforeEach(async () => {
        await truncateMysql();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('rejects a request without a valid time range', async () => {
        const { auth } = await seedPedaUser(true);

        const res = await get(EventsUrl, auth);

        expect(res.status).toBe(400);
    });

    it('blocks roles outside AD / GESTION / PEDA', async () => {
        const auth = mintAuthCookies({
            id: 42,
            email: `commercial-${suffix}@test.local`,
            role: 'COMMERCIAL',
            permission: 'EMPLOYEE',
        });

        const res = await get(`${EventsUrl}${RANGE}`, auth);

        expect(res.status).toBe(403);
    });

    it('answers 409 when the Peda has no Google account connected', async () => {
        const { auth } = await seedPedaUser(false);

        const res = await get(`${EventsUrl}${RANGE}`, auth);

        expect(res.status).toBe(409);
    });

    it('creates an all-day SA event carrying the sequence and alternant ids', async () => {
        const { auth } = await seedPedaUser(true);
        const { alternantId } = await createAlternantWithSequences();
        const sequences = await new AlternantService().findSequences(alternantId);
        expect(sequences.length).toBeGreaterThan(0);

        vi.spyOn(GoogleCalendarService.prototype, 'listEvents').mockResolvedValue([]);
        let counter = 0;
        const createEvent = vi
            .spyOn(GoogleCalendarService.prototype, 'createEvent')
            .mockImplementation(async (input) => ({ id: `evt-${++counter}`, allDay: input.allDay ?? false, ...input } as CalendarEvent));

        const res = await get(`${EventsUrl}${RANGE}`, auth);

        expect(res.status).toBe(200);
        const body = (await res.json()) as { events: CalendarEvent[]; report: { connected: boolean; created: number } };
        expect(body.report.connected).toBe(true);
        expect(body.report.created).toBe(sequences.length);
        expect(createEvent).toHaveBeenCalledTimes(sequences.length);

        const [firstInput] = createEvent.mock.calls[0];
        const firstSequence = sequences.find((s) => s._id === firstInput.saSequenceId);
        expect(firstSequence).toBeDefined();
        expect(firstInput.allDay).toBe(true);
        expect(firstInput.saAlternantId).toBe(alternantId);
        expect(firstInput.summary).toContain(`SA n°${firstSequence?.numero}`);
    });

    it('reschedules the SA when its event was moved in Google Calendar', async () => {
        const { auth, id } = await seedPedaUser(true);
        const { alternantId } = await createAlternantWithSequences();
        const service = new AlternantService();
        const sequence = (await service.findSequences(alternantId))[0];

        const moved: CalendarEvent = {
            id: 'evt-moved',
            summary: `SA n°${sequence.numero} — Léa Calendar${suffix}`,
            start: '2026-03-10',
            end: '2026-03-11',
            allDay: true,
            saSequenceId: sequence._id,
            saAlternantId: alternantId,
        };
        // 1re lecture : l'événement déplacé ; 2e lecture (post-synchro) : idem.
        vi.spyOn(GoogleCalendarService.prototype, 'listEvents').mockResolvedValue([moved]);
        vi.spyOn(GoogleCalendarService.prototype, 'createEvent').mockResolvedValue(moved);
        vi.spyOn(GoogleCalendarService.prototype, 'updateEvent').mockResolvedValue(moved);

        const res = await get(`${EventsUrl}${RANGE}`, auth);

        expect(res.status).toBe(200);
        const body = (await res.json()) as { report: { rescheduled: number } };
        expect(body.report.rescheduled).toBe(1);
        const updated = await service.findSequenceById(sequence._id);
        expect(updated?.prevue_le.toISOString().slice(0, 10)).toBe('2026-03-10');
        const user = await userService.findById(id);
        expect(user?.oauthToken).toBe('access-token');
    });

    it('deletes an event whose SA no longer exists', async () => {
        const { auth } = await seedPedaUser(true);
        const orphan: CalendarEvent = {
            id: 'evt-orphan',
            summary: 'SA n°1 — Disparu',
            start: '2026-03-10',
            end: '2026-03-11',
            allDay: true,
            saSequenceId: 'sequence-deleted',
        };
        vi.spyOn(GoogleCalendarService.prototype, 'listEvents')
            .mockResolvedValueOnce([orphan])
            .mockResolvedValue([]);
        const deleteEvent = vi.spyOn(GoogleCalendarService.prototype, 'deleteEvent').mockResolvedValue(undefined);

        const res = await get(`${EventsUrl}${RANGE}`, auth);

        expect(res.status).toBe(200);
        expect(deleteEvent).toHaveBeenCalledWith('evt-orphan');
    });

    it('answers 409 and purges tokens when Google rejects the credentials', async () => {
        const { auth, id } = await seedPedaUser(true);
        vi.spyOn(GoogleCalendarService.prototype, 'listEvents').mockRejectedValue(new Error('invalid_grant'));

        const res = await get(`${EventsUrl}${RANGE}`, auth);

        expect(res.status).toBe(409);
        const user = await userService.findById(id);
        expect(user?.oauthToken).toBeNull();
    });

    it('answers 502 on a non-auth Google failure', async () => {
        const { auth } = await seedPedaUser(true);
        vi.spyOn(GoogleCalendarService.prototype, 'listEvents').mockRejectedValue(new Error('backend error 500'));

        const res = await get(`${EventsUrl}${RANGE}`, auth);

        expect(res.status).toBe(502);
    });

    it('forces a full sync through POST /sync', async () => {
        const { auth } = await seedPedaUser(true);
        await createAlternantWithSequences();
        vi.spyOn(GoogleCalendarService.prototype, 'listEvents').mockResolvedValue([]);
        const createEvent = vi
            .spyOn(GoogleCalendarService.prototype, 'createEvent')
            .mockImplementation(async (input) => ({ id: `evt-${Math.random()}`, allDay: true, ...input } as CalendarEvent));

        const res = await fetch(SyncUrl, {
            method: 'POST',
            headers: { Cookie: auth.cookieHeader, 'x-csrf-token': auth.csrfHeader, 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });

        expect(res.status).toBe(200);
        const body = (await res.json()) as { report: { created: number } };
        expect(body.report.created).toBeGreaterThan(0);
        expect(createEvent).toHaveBeenCalled();
    });
});

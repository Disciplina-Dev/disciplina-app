import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { env } from '../../../config/env';
import { getPool } from '../../../db/mysql/connection';
import { UserRepository } from '../../../repositories/mysql/UserRepository';
import { GoogleCalendarService } from '../../../external/google/calendar.service';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { truncateMysql } from '../../../../test/helpers/db';

const BASE = `http://localhost:${env.API_PORT}/api/booking`;
const suffix = Date.now();

const REUNION = 'Indian/Reunion';

const CREATED: number[] = [];

/** Jour ISO (1=lundi … 7=dimanche) porté par `day` (YYYY-MM-DD). */
function isoWeekday(day: string): number {
    const wd = new Date(`${day}T12:00:00Z`).getUTCDay();
    return wd === 0 ? 7 : wd;
}

/**
 * Prochaine occurrence d'un jour ISO, exprimée en date locale Réunion et située
 * dans l'horizon de réservation (maxDaysAhead = 365).
 */
function nextWeekday(targetIso: number): string {
    const [y, m, d] = new Intl.DateTimeFormat('en-CA', {
        timeZone: REUNION,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    })
        .format(new Date())
        .split('-')
        .map(Number);
    for (let i = 7; i < 60; i++) {
        const cand = new Date(Date.UTC(y, m - 1, d + i, 12));
        if (isoWeekday(cand.toISOString().slice(0, 10)) === targetIso) {
            return cand.toISOString().slice(0, 10);
        }
    }
    throw new Error(`Impossible de trouver un jour ISO ${targetIso}`);
}

/** Jour d'ouverture dédié à ce fichier : lundi de la semaine prochaine. */
const DAY = nextWeekday(1);

interface Host {
    id: number;
    email: string;
    slug: string;
    headers: Record<string, string>;
}

async function seedHost(label: string): Promise<Host> {
    const email = `booking-block-${label}-${suffix}@test.local`;
    const id = await new UserRepository().create({
        email,
        first_name: 'RH',
        last_name: `Blocage ${label}`,
        password: 'hashed',
        role_id: 2,
        permission_id: 1,
        sectors: null,
        oauth_token: 'oauth-access-token',
        refresh_token: 'oauth-refresh-token',
    });
    CREATED.push(id);

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

    // Une seule plage ouverte : le lundi, 9h–12h (30 min → 6 créneaux).
    const res = await fetch(`${BASE}/settings`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
            timezone: REUNION,
            durationMin: 30,
            bufferMin: 0,
            minNoticeHours: 0,
            maxDaysAhead: 365,
            workingHours: { [String(isoWeekday(DAY))]: [['09:00', '12:00']] },
        }),
    });
    expect(res.status).toBe(200);
    const { settings } = (await res.json()) as { settings: { slug: string } };
    return { id, email, slug: settings.slug, headers };
}

async function slotsFor(slug: string, day = DAY): Promise<string[]> {
    const res = await fetch(`${BASE}/public/${slug}/slots?from=${day}&to=${day}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { slots: { start: string }[] };
    return body.slots.map((s) => s.start);
}

async function listBlocks(host: Host) {
    const res = await fetch(`${BASE}/blocks`, { headers: host.headers });
    expect(res.status).toBe(200);
    return (await res.json()) as { blocks: { id: number; day: string; scope: string; releasedForMe?: boolean }[] };
}

async function block(host: Host, scope: 'SELF' | 'ALL', day = DAY, reason = 'Congés') {
    return fetch(`${BASE}/blocks`, {
        method: 'POST',
        headers: host.headers,
        body: JSON.stringify({ day, scope, reason }),
    });
}

beforeEach(async () => {
    await truncateMysql();
});

afterAll(async () => {
    // booking_settings n'est pas dans CLEARED_TABLES : sans ce nettoyage, une
    // ligne orpheline pourrait être héritée par un test réutilisant l'id.
    const conn = await getPool('reunion').getConnection();
    try {
        await conn.query('SET FOREIGN_KEY_CHECKS = 0');
        for (const id of CREATED) {
            await conn.execute('DELETE FROM booking_settings WHERE user_id = ?', [id]);
            await conn.execute('DELETE FROM calendar_day_blocks WHERE user_id = ? OR created_by = ?', [id, id]);
        }
        await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    } finally {
        conn.release();
    }
});

describe('Blocage de dates — disponibilités publiques', () => {
    let freeBusySpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        freeBusySpy = vi.spyOn(GoogleCalendarService.prototype, 'freeBusy').mockResolvedValue([]);
    });

    afterAll(() => {
        freeBusySpy?.mockRestore();
    });

    it('« pour moi » : retire le jour des créneaux uniquement pour son auteur', async () => {
        const alice = await seedHost('self-a');
        const bob = await seedHost('self-b');

        expect((await slotsFor(alice.slug)).length).toBeGreaterThan(0);
        expect((await slotsFor(bob.slug)).length).toBeGreaterThan(0);

        const created = await block(alice, 'SELF', DAY, 'Formation interne');
        expect(created.status).toBe(201);

        expect(await slotsFor(alice.slug)).toEqual([]);
        // Le blocage personnel ne fuite pas vers les autres agendas.
        expect((await slotsFor(bob.slug)).length).toBeGreaterThan(0);
    });

    it('« pour tout le monde » : retire le jour pour tous les RH', async () => {
        const alice = await seedHost('all-a');
        const bob = await seedHost('all-b');

        expect((await block(alice, 'ALL', DAY, 'Jour férié')).status).toBe(201);

        expect(await slotsFor(alice.slug)).toEqual([]);
        expect(await slotsFor(bob.slug)).toEqual([]);

        // Bob voit le blocage global (et son motif), pas les blocages personnels d'Alice.
        const { blocks } = await listBlocks(bob);
        expect(blocks).toHaveLength(1);
        expect(blocks[0]).toMatchObject({ day: DAY, scope: 'ALL', releasedForMe: false });
    });

    it('« me rendre disponible » : débloque le jour pour soi seul, et se re-bloque ensuite', async () => {
        const alice = await seedHost('release-a');
        const bob = await seedHost('release-b');

        expect((await block(alice, 'ALL', DAY, 'Séminaire')).status).toBe(201);
        const { blocks } = await listBlocks(bob);
        const globalId = blocks[0].id;

        const released = await fetch(`${BASE}/blocks/${globalId}/release`, { method: 'POST', headers: bob.headers });
        expect(released.status).toBe(200);
        const afterRelease = (await released.json()) as { blocks: { releasedForMe?: boolean }[] };
        expect(afterRelease.blocks[0]?.releasedForMe).toBe(true);

        // Bob retrouve ses créneaux, Alice reste bloquée.
        expect((await slotsFor(bob.slug)).length).toBeGreaterThan(0);
        expect(await slotsFor(alice.slug)).toEqual([]);

        // Second appel = bascule : Bob re-bloque le jour pour lui.
        const reBlocked = await fetch(`${BASE}/blocks/${globalId}/release`, { method: 'POST', headers: bob.headers });
        const afterReBlock = (await reBlocked.json()) as { blocks: { releasedForMe?: boolean }[] };
        expect(afterReBlock.blocks[0]?.releasedForMe).toBe(false);
        expect(await slotsFor(bob.slug)).toEqual([]);
    });

    it('annuler un blocage global le rouvre pour tout le monde (dérogations comprises)', async () => {
        const alice = await seedHost('cancel-a');
        const bob = await seedHost('cancel-b');

        expect((await block(alice, 'ALL', DAY, 'Fermeture')).status).toBe(201);
        const { blocks } = await listBlocks(alice);
        await fetch(`${BASE}/blocks/${blocks[0].id}/release`, { method: 'POST', headers: bob.headers });

        const del = await fetch(`${BASE}/blocks/${blocks[0].id}`, { method: 'DELETE', headers: alice.headers });
        expect(del.status).toBe(200);

        expect((await slotsFor(alice.slug)).length).toBeGreaterThan(0);
        expect((await slotsFor(bob.slug)).length).toBeGreaterThan(0);
        expect((await listBlocks(alice)).blocks).toEqual([]);
    });

    it('refuse de réserver un créneau sur un jour bloqué (409)', async () => {
        const alice = await seedHost('book-a');
        const [firstSlot] = await slotsFor(alice.slug);

        expect((await block(alice, 'SELF', DAY, 'Absent')).status).toBe(201);

        const res = await fetch(`${BASE}/public/${alice.slug}/book`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ start: firstSlot, name: 'Invité', email: 'guest@test.local' }),
        });
        expect(res.status).toBe(409);
    });

    it('valide la date, la portée et le motif', async () => {
        const alice = await seedHost('valid');

        const badDay = await fetch(`${BASE}/blocks`, {
            method: 'POST',
            headers: alice.headers,
            body: JSON.stringify({ day: '2026-02-31', scope: 'SELF', reason: 'x' }),
        });
        expect(badDay.status).toBe(400);

        const badScope = await block(alice, 'SELF');
        expect(badScope.status).toBe(201); // sanity : SELF valide
        const badScopeRes = await fetch(`${BASE}/blocks`, {
            method: 'POST',
            headers: alice.headers,
            body: JSON.stringify({ day: '2030-01-07', scope: 'EVERYONE', reason: 'x' }),
        });
        expect(badScopeRes.status).toBe(400);

        const noReason = await fetch(`${BASE}/blocks`, {
            method: 'POST',
            headers: alice.headers,
            body: JSON.stringify({ day: '2030-01-07', scope: 'SELF', reason: '   ' }),
        });
        expect(noReason.status).toBe(400);
    });

    it("n'autorise pas à annuler le blocage personnel d'un autre RH", async () => {
        const alice = await seedHost('own-a');
        const bob = await seedHost('own-b');

        expect((await block(alice, 'SELF')).status).toBe(201);
        const aliceBlocks = (await listBlocks(alice)).blocks;
        expect(aliceBlocks).toHaveLength(1);
        expect((await listBlocks(bob)).blocks).toEqual([]);

        const del = await fetch(`${BASE}/blocks/${aliceBlocks[0].id}`, { method: 'DELETE', headers: bob.headers });
        expect(del.status).toBe(403);
        expect((await listBlocks(alice)).blocks).toHaveLength(1);
    });
});

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

/** Décale une date locale `YYYY-MM-DD` de `n` jours. */
function addDays(day: string, n: number): string {
    const date = new Date(`${day}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + n);
    return date.toISOString().slice(0, 10);
}

/** Jour d'ouverture dédié à ce fichier : lundi de la semaine prochaine. */
const DAY = nextWeekday(1);

interface Host {
    id: number;
    email: string;
    slug: string;
    headers: Record<string, string>;
}

async function seedHost(
    label: string,
    options: { sectors?: string[]; permission?: 'EMPLOYEE' | 'RESPONSABLE' } = {},
): Promise<Host> {
    const email = `booking-block-${label}-${suffix}@test.local`;
    const permission = options.permission ?? 'EMPLOYEE';
    const id = await new UserRepository().create({
        email,
        first_name: 'RH',
        last_name: `Blocage ${label}`,
        password: 'hashed',
        role_id: 2,
        permission_id: permission === 'RESPONSABLE' ? 2 : 1,
        sectors: options.sectors ?? null,
        oauth_token: 'oauth-access-token',
        refresh_token: 'oauth-refresh-token',
    });
    CREATED.push(id);

    const { cookieHeader, csrfHeader } = mintAuthCookies({
        id,
        email,
        role: 'RH',
        permission,
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

interface BlockEntry {
    id: number;
    day: string;
    scope: string;
    groupKey: string;
    targetLabels: string[];
    targetCount: number;
    releasedForMe?: boolean;
}

async function listBlocks(host: Host): Promise<BlockEntry[]> {
    const res = await fetch(`${BASE}/blocks`, { headers: host.headers });
    expect(res.status).toBe(200);
    return ((await res.json()) as { blocks: BlockEntry[] }).blocks;
}

interface BlockInput {
    from?: string;
    to?: string;
    scope: 'SELF' | 'ALL' | 'SECTOR' | 'USERS';
    reason?: string;
    sectors?: string[];
    userIds?: number[];
}

async function block(host: Host, input: BlockInput) {
    return fetch(`${BASE}/blocks`, {
        method: 'POST',
        headers: host.headers,
        body: JSON.stringify({ from: DAY, reason: 'Congés', ...input }),
    });
}

/** Bloque une période et renvoie les entrées créées (filtrées sur la période). */
async function blockPeriod(host: Host, from: string, to: string, input: BlockInput): Promise<BlockEntry[]> {
    const res = await block(host, { from, to, ...input });
    expect(res.status).toBe(201);
    const days: string[] = [];
    for (let cur = Date.parse(`${from}T12:00:00Z`); cur <= Date.parse(`${to}T12:00:00Z`); cur += 86_400_000) {
        days.push(new Date(cur).toISOString().slice(0, 10));
    }
    return (await listBlocks(host)).filter((b) => days.includes(b.day));
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

        const created = await block(alice, { scope: 'SELF', reason: 'Formation interne' });
        expect(created.status).toBe(201);

        expect(await slotsFor(alice.slug)).toEqual([]);
        // Le blocage personnel ne fuite pas vers les autres agendas.
        expect((await slotsFor(bob.slug)).length).toBeGreaterThan(0);
    });

    it('« pour tout le monde » : retire le jour pour tous les RH', async () => {
        const alice = await seedHost('all-a');
        const bob = await seedHost('all-b');

        expect((await block(alice, { scope: 'ALL', reason: 'Jour férié' })).status).toBe(201);

        expect(await slotsFor(alice.slug)).toEqual([]);
        expect(await slotsFor(bob.slug)).toEqual([]);

        // Bob voit le blocage collectif (et son motif), pas les blocages personnels d'Alice.
        const blocks = await listBlocks(bob);
        expect(blocks).toHaveLength(1);
        expect(blocks[0]).toMatchObject({ day: DAY, scope: 'ALL', releasedForMe: false });
    });

    it('une période bloque chaque jour et se liste comme une seule entrée', async () => {
        const alice = await seedHost('range-a');

        expect((await block(alice, { to: addDays(DAY, 2), scope: 'SELF', reason: 'Congés' })).status).toBe(201);

        const blocks = await listBlocks(alice);
        expect(blocks.map((b) => b.day)).toEqual([DAY, addDays(DAY, 1), addDays(DAY, 2)]);
        expect(new Set(blocks.map((b) => b.groupKey)).size).toBe(1);
        expect(await slotsFor(alice.slug)).toEqual([]);

        // Le filtre de plage (paramètres positionnels de findVisible) reste correct.
        const ranged = await fetch(`${BASE}/blocks?from=${addDays(DAY, 1)}&to=${addDays(DAY, 2)}`, {
            headers: alice.headers,
        });
        const { blocks: rangedBlocks } = (await ranged.json()) as { blocks: BlockEntry[] };
        expect(rangedBlocks.map((b) => b.day)).toEqual([addDays(DAY, 1), addDays(DAY, 2)]);
    });

    it('annuler une période rouvre tous ses jours', async () => {
        const alice = await seedHost('range-del');
        const [first] = await blockPeriod(alice, DAY, addDays(DAY, 2), { scope: 'ALL' });

        const del = await fetch(`${BASE}/blocks/groups/${first.groupKey}`, {
            method: 'DELETE',
            headers: alice.headers,
        });
        expect(del.status).toBe(200);

        expect(await listBlocks(alice)).toEqual([]);
        expect((await slotsFor(alice.slug)).length).toBeGreaterThan(0);
    });

    it('« mon secteur » : ne bloque que les membres du secteur', async () => {
        const alice = await seedHost('sector-a', { sectors: ['Sud'] });
        const bob = await seedHost('sector-b', { sectors: ['Sud'] });
        const carol = await seedHost('sector-c', { sectors: ['Ouest'] });

        const res = await block(alice, { scope: 'SECTOR', sectors: ['Sud'], reason: 'Séminaire' });
        expect(res.status).toBe(201);

        expect(await slotsFor(alice.slug)).toEqual([]);
        expect(await slotsFor(bob.slug)).toEqual([]);
        expect((await slotsFor(carol.slug)).length).toBeGreaterThan(0);

        // Carol (autre secteur) ne voit pas le blocage ; Bob le voit et connaît sa cible.
        expect(await listBlocks(carol)).toEqual([]);
        const bobBlocks = await listBlocks(bob);
        expect(bobBlocks).toHaveLength(1);
        expect(bobBlocks[0]).toMatchObject({ scope: 'SECTOR', targetLabels: ['Sud'] });
    });

    it('« personnes » : ne bloque que la sélection', async () => {
        const alice = await seedHost('users-a', { sectors: ['Sud'] });
        const bob = await seedHost('users-b', { sectors: ['Sud'] });
        const carol = await seedHost('users-c', { sectors: ['Sud'] });

        const res = await block(alice, { scope: 'USERS', userIds: [bob.id], reason: 'Rendez-vous' });
        expect(res.status).toBe(201);

        expect((await slotsFor(alice.slug)).length).toBeGreaterThan(0);
        expect(await slotsFor(bob.slug)).toEqual([]);
        expect((await slotsFor(carol.slug)).length).toBeGreaterThan(0);

        expect(await listBlocks(carol)).toEqual([]);
        const bobBlocks = await listBlocks(bob);
        expect(bobBlocks).toHaveLength(1);
        // Ciblé mais pas auteur : Bob voit qu'il est bloqué, pas l'identité des autres cibles.
        expect(bobBlocks[0]).toMatchObject({ scope: 'USERS', targetLabels: [], targetCount: 1 });

        // L'auteur, lui, retrouve les noms.
        const aliceBlocks = await listBlocks(alice);
        expect(aliceBlocks[0]).toMatchObject({ scope: 'USERS', targetLabels: ['RH Blocage users-b'] });
    });

    it("« me rendre disponible » refuse un blocage qui ne me concerne pas", async () => {
        const alice = await seedHost('release-scope-a', { sectors: ['Sud'] });
        const carol = await seedHost('release-scope-c', { sectors: ['Ouest'] });

        expect((await block(alice, { scope: 'SECTOR', sectors: ['Sud'], reason: 'Séminaire' })).status).toBe(201);
        const [sudBlock] = await listBlocks(alice);
        expect(await listBlocks(carol)).toEqual([]);

        // Carol (autre secteur) connaît l'id mais n'est pas concernée : refus.
        const byId = await fetch(`${BASE}/blocks/${sudBlock.id}/release`, {
            method: 'POST',
            headers: carol.headers,
        });
        expect(byId.status).toBe(403);

        const byGroup = await fetch(`${BASE}/blocks/groups/${sudBlock.groupKey}/release`, {
            method: 'POST',
            headers: carol.headers,
        });
        expect(byGroup.status).toBe(403);
    });

    it("refuse de réécrire le blocage collectif d'un autre RH", async () => {
        const alice = await seedHost('takeover-a');
        const bob = await seedHost('takeover-b');

        expect((await block(alice, { scope: 'ALL', reason: 'Fermeture décidée par Alice' })).status).toBe(201);

        // Bob ne peut pas prendre la main sur le blocage pour s'en donner l'annulation.
        const takeover = await block(bob, { scope: 'ALL', reason: 'Reprise' });
        expect(takeover.status).toBe(409);

        const [existing] = await listBlocks(bob);
        expect(existing).toMatchObject({ scope: 'ALL', reason: 'Fermeture décidée par Alice' });
        const stillBlocked = await listBlocks(alice);
        expect(stillBlocked).toHaveLength(1);
    });

    it("annuler un jour collectif n'efface pas les autres blocages du même jour", async () => {
        const alice = await seedHost('multi-a', { sectors: ['Sud'] });
        const bob = await seedHost('multi-b', { sectors: ['Sud'] });

        expect((await block(alice, { scope: 'ALL', reason: 'Fermeture' })).status).toBe(201);
        expect((await block(bob, { scope: 'SECTOR', sectors: ['Sud'], reason: 'Séminaire' })).status).toBe(201);

        const allBlock = (await listBlocks(alice)).find((b) => b.scope === 'ALL');
        expect(allBlock).toBeDefined();
        const del = await fetch(`${BASE}/blocks/${allBlock!.id}`, { method: 'DELETE', headers: alice.headers });
        expect(del.status).toBe(200);

        // Le blocage sectoriel de Bob survit : seul le blocage visé disparaît.
        const bobBlocks = await listBlocks(bob);
        expect(bobBlocks).toHaveLength(1);
        expect(bobBlocks[0]).toMatchObject({ scope: 'SECTOR', targetLabels: ['Sud'] });
        expect(await slotsFor(bob.slug)).toEqual([]);
    });

    it('refuse une cible hors de ses secteurs (EMPLOYEE)', async () => {
        const alice = await seedHost('guard-a', { sectors: ['Sud'] });
        const carol = await seedHost('guard-c', { sectors: ['Ouest'] });

        const res = await block(alice, { scope: 'USERS', userIds: [carol.id], reason: 'Test' });
        expect(res.status).toBe(400);
    });

    it('refuse un secteur dont on n’est pas membre', async () => {
        const alice = await seedHost('guard-sector', { sectors: ['Sud'] });

        const res = await block(alice, { scope: 'SECTOR', sectors: ['Ouest'], reason: 'Test' });
        expect(res.status).toBe(400);
    });

    it('« me rendre disponible » : débloque le jour pour soi seul, et se re-bloque ensuite', async () => {
        const alice = await seedHost('release-a');
        const bob = await seedHost('release-b');

        expect((await block(alice, { scope: 'ALL', reason: 'Séminaire' })).status).toBe(201);
        const globalId = (await listBlocks(bob))[0].id;

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

    it('« me rendre disponible » sur une période : bascule pour tous ses jours', async () => {
        const alice = await seedHost('release-range-a');
        const bob = await seedHost('release-range-b');
        const [first] = await blockPeriod(alice, DAY, addDays(DAY, 2), { scope: 'ALL', reason: 'Séminaire' });

        const release = () =>
            fetch(`${BASE}/blocks/groups/${first.groupKey}/release`, { method: 'POST', headers: bob.headers });

        expect((await release()).status).toBe(200);
        const released = await listBlocks(bob);
        expect(released).toHaveLength(3);
        expect(released.every((b) => b.releasedForMe === true)).toBe(true);
        expect((await slotsFor(bob.slug)).length).toBeGreaterThan(0);
        expect(await slotsFor(alice.slug)).toEqual([]);

        // Bascule : Bob re-bloque les trois jours.
        expect((await release()).status).toBe(200);
        expect((await listBlocks(bob)).every((b) => b.releasedForMe === false)).toBe(true);
        expect(await slotsFor(bob.slug)).toEqual([]);
    });

    it('annuler un blocage collectif le rouvre pour tout le monde (dérogations comprises)', async () => {
        const alice = await seedHost('cancel-a');
        const bob = await seedHost('cancel-b');

        expect((await block(alice, { scope: 'ALL', reason: 'Fermeture' })).status).toBe(201);
        const blocks = await listBlocks(alice);
        await fetch(`${BASE}/blocks/${blocks[0].id}/release`, { method: 'POST', headers: bob.headers });

        const del = await fetch(`${BASE}/blocks/${blocks[0].id}`, { method: 'DELETE', headers: alice.headers });
        expect(del.status).toBe(200);

        expect((await slotsFor(alice.slug)).length).toBeGreaterThan(0);
        expect((await slotsFor(bob.slug)).length).toBeGreaterThan(0);
        expect(await listBlocks(alice)).toEqual([]);
    });

    it('refuse de réserver un créneau sur un jour bloqué (409)', async () => {
        const alice = await seedHost('book-a');
        const [firstSlot] = await slotsFor(alice.slug);

        expect((await block(alice, { scope: 'SELF', reason: 'Absent' })).status).toBe(201);

        const res = await fetch(`${BASE}/public/${alice.slug}/book`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                start: firstSlot,
                firstName: 'Invité',
                lastName: 'Test',
                phone: '0692000000',
                email: 'guest@test.local',
            }),
        });
        expect(res.status).toBe(409);
    });

    it('valide les dates, la portée, la période et le motif', async () => {
        const alice = await seedHost('valid');

        const badDay = await fetch(`${BASE}/blocks`, {
            method: 'POST',
            headers: alice.headers,
            body: JSON.stringify({ from: '2026-02-31', scope: 'SELF', reason: 'x' }),
        });
        expect(badDay.status).toBe(400);

        const backwards = await block(alice, { from: '2030-01-07', to: '2030-01-01', scope: 'SELF' });
        expect(backwards.status).toBe(400);

        const tooLong = await block(alice, { from: '2030-01-01', to: '2031-06-01', scope: 'SELF' });
        expect(tooLong.status).toBe(400);

        const badScope = await block(alice, {
            scope: 'EVERYONE' as unknown as BlockInput['scope'],
        });
        expect(badScope.status).toBe(400);

        const noReason = await block(alice, { from: '2030-01-07', scope: 'SELF', reason: '   ' });
        expect(noReason.status).toBe(400);

        const noTarget = await block(alice, { from: '2030-01-07', scope: 'USERS' });
        expect(noTarget.status).toBe(400);
    });

    it("n'autorise pas à annuler le blocage personnel d'un autre RH", async () => {
        const alice = await seedHost('own-a');
        const bob = await seedHost('own-b');

        expect((await block(alice, { scope: 'SELF' })).status).toBe(201);
        const aliceBlocks = await listBlocks(alice);
        expect(aliceBlocks).toHaveLength(1);
        expect(await listBlocks(bob)).toEqual([]);

        const del = await fetch(`${BASE}/blocks/${aliceBlocks[0].id}`, { method: 'DELETE', headers: bob.headers });
        expect(del.status).toBe(403);
        expect(await listBlocks(alice)).toHaveLength(1);
    });

    it("n'autorise qu'un responsable à annuler le blocage collectif d'un autre", async () => {
        const alice = await seedHost('authz-a');
        const bob = await seedHost('authz-b');
        const manager = await seedHost('authz-m', { permission: 'RESPONSABLE' });

        expect((await block(alice, { scope: 'ALL', reason: 'Fermeture' })).status).toBe(201);
        const groupKey = (await listBlocks(alice))[0].groupKey;

        const byPeer = await fetch(`${BASE}/blocks/groups/${groupKey}`, { method: 'DELETE', headers: bob.headers });
        expect(byPeer.status).toBe(403);

        // La route mono-jour applique la même règle (le front ne l'utilise plus).
        const dayId = (await listBlocks(alice))[0].id;
        const dayByPeer = await fetch(`${BASE}/blocks/${dayId}`, { method: 'DELETE', headers: bob.headers });
        expect(dayByPeer.status).toBe(403);
        expect(await listBlocks(alice)).toHaveLength(1);

        const byManager = await fetch(`${BASE}/blocks/groups/${groupKey}`, {
            method: 'DELETE',
            headers: manager.headers,
        });
        expect(byManager.status).toBe(200);
        expect(await listBlocks(alice)).toEqual([]);
    });
});

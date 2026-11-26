import { describe, it, expect, beforeEach } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { truncateMysql } from '../../../../test/helpers/db';
import { env } from '../../../config/env';
import pool from '../../../db/mysql/connection';

const BASE = `http://localhost:${env.API_PORT}/api/kpi`;

function adminAuth(suffix: string): { cookieHeader: string; csrfHeader: string } {
    return mintAuthCookies({ id: 1, email: `admin-${suffix}@test.local`, role: 'AD', permission: 'RESPONSABLE' });
}

async function seedUser(email: string): Promise<number> {
    const conn = await pool.getConnection();
    try {
        const [result] = await conn.execute(
            'INSERT INTO users (email, first_name, last_name, password, role_id, permission_id) VALUES (?, ?, ?, ?, ?, ?)',
            [email, 'Alice', 'Martin', 'pwd', 3, 1],
        );
        return (result as any).insertId;
    } finally {
        conn.release();
    }
}

describe('/api/kpi buckets (MongoDB)', () => {
    const suffix = `kpis-${Date.now()}`;
    const auth = adminAuth(suffix);

    beforeEach(async () => {
        await truncateMysql();
    });

    it('rejects an unauthenticated call', async () => {
        const res = await fetch(`${BASE}/years`);
        expect(res.status).toBe(401);
    });

    it('upserts a bucket then serves summary and user detail from MongoDB', async () => {
        const userId = await seedUser(`alice-${suffix}@test.local`);

        const post = await fetch(BASE, {
            method: 'POST',
            headers: { Cookie: auth.cookieHeader, 'x-csrf-token': auth.csrfHeader, 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, year: 2026, month: 8, site: 'NORD', count_oui: 3, total_appels: 10 }),
        });
        expect(post.status).toBe(200);

        const summaryRes = await fetch(`${BASE}/summary?year=2026&site=NORD`, { headers: { Cookie: auth.cookieHeader } });
        const summary = await summaryRes.json();
        expect(summaryRes.status).toBe(200);
        const user = summary.users?.find((u: any) => u.userId === userId);
        expect(user).toBeDefined();
        expect(user.userName).toBe('Alice Martin');
        expect(user.totals.count_oui).toBe(3);

        const detailRes = await fetch(`${BASE}/user/${userId}?year=2026`, { headers: { Cookie: auth.cookieHeader } });
        const detail = await detailRes.json();
        expect(detailRes.status).toBe(200);
        // { userId, userName, totals, sites: [{ site, months, weeks }] }
        expect(detail.userId).toBe(userId);
        expect(detail.sites?.[0]?.months).toEqual([{ month: 8, metrics: expect.objectContaining({ count_oui: 3 }) }]);
    });

    it('replaces counters on re-upsert of the same bucket (no accumulation)', async () => {
        const userId = await seedUser(`bob-${suffix}@test.local`);
        const body = (countOui: number) =>
            JSON.stringify({ user_id: userId, year: 2026, month: 8, site: 'NORD', count_oui: countOui, total_appels: 10 });

        await fetch(BASE, {
            method: 'POST',
            headers: { Cookie: auth.cookieHeader, 'x-csrf-token': auth.csrfHeader, 'Content-Type': 'application/json' },
            body: body(5),
        });
        await fetch(BASE, {
            method: 'POST',
            headers: { Cookie: auth.cookieHeader, 'x-csrf-token': auth.csrfHeader, 'Content-Type': 'application/json' },
            body: body(2),
        });

        const res = await fetch(`${BASE}/summary?year=2026&site=NORD`, { headers: { Cookie: auth.cookieHeader } });
        const summary = await res.json();
        const user = summary.users.find((u: any) => u.userId === userId);
        // Sémantique ON DUPLICATE KEY UPDATE : remplacement, pas d'addition.
        expect(user.totals.count_oui).toBe(2);
        expect(user.totals.total_appels).toBe(10);
    });

    it('separates weekly rows from the monthly aggregate', async () => {
        const userId = await seedUser(`cara-${suffix}@test.local`);
        for (const week of [0, 34]) {
            const post = await fetch(BASE, {
                method: 'POST',
                headers: { Cookie: auth.cookieHeader, 'x-csrf-token': auth.csrfHeader, 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, year: 2026, month: 8, week, site: 'NORD', total_appels: week === 0 ? 1 : 9 }),
            });
            expect(post.status).toBe(200);
        }

        const weeklyRes = await fetch(`${BASE}/weekly?year=2026&site=NORD`, { headers: { Cookie: auth.cookieHeader } });
        const weekly = await weeklyRes.json();
        expect(weeklyRes.status).toBe(200);
        // La ligne mensuelle (week = 0) ne doit pas fuiter dans la vue hebdo.
        expect(weekly.weeks.map((w: any) => w.week)).toEqual([34]);
    });

    it('validates the payload', async () => {
        const post = await fetch(BASE, {
            method: 'POST',
            headers: { Cookie: auth.cookieHeader, 'x-csrf-token': auth.csrfHeader, 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: 1, year: 2026, month: 13, site: 'NORD' }),
        });
        expect(post.status).toBe(400);
        const json = await post.json();
        expect(json.error).toMatch(/month/i);
    });
});

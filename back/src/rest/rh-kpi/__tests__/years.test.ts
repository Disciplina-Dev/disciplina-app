import { describe, it, expect, beforeEach } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { truncateMysql } from '../../../../test/helpers/db';
import { env } from '../../../config/env';
import { RhKpiService } from '../../../services/RhKpiService';
import pool from '../../../db/mysql/connection';

const YEARS_ENDPOINT = `http://localhost:${env.API_PORT}/api/rh-kpi/years`;

describe('GET /api/rh-kpi/years', () => {
    const suffix = `rhyears-${Date.now()}`;

    async function seedUser(): Promise<number> {
        const conn = await pool.getConnection();
        try {
            const [result] = await conn.execute(
                'INSERT INTO users (email, first_name, last_name, password, role_id, permission_id) VALUES (?, ?, ?, ?, ?, ?)',
                [
                    `${suffix}-${Math.random().toString(36).slice(2)}@test.local`,
                    'Years',
                    'User',
                    `pwd-${suffix}`,
                    2,
                    1,
                ],
            );
            return (result as any).insertId;
        } finally {
            conn.release();
        }
    }

    beforeEach(async () => {
        await truncateMysql();
    });

    it('lists distinct bucket years, most recent first', async () => {
        const userId = await seedUser();
        const kpi = new RhKpiService();
        // Deux bumps la même année : une seule entrée (DISTINCT).
        await kpi.bump(userId, 'Nord-Est', new Date('2024-06-03T08:00:00Z'), { interviews_placed: 2 });
        await kpi.bump(userId, 'Nord-Est', new Date('2024-09-09T08:00:00Z'), { contracts: 1 });
        await kpi.bump(userId, 'Ouest', new Date('2025-01-06T08:00:00Z'), { immersions: 3 });

        const auth = mintAuthCookies({ id: userId, email: `y-${suffix}@test.local`, role: 'RH', permission: 'EMPLOYEE' });
        const res = await fetch(YEARS_ENDPOINT, { headers: { Cookie: auth.cookieHeader } });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.years).toEqual([2025, 2024]);
    });

    it('returns an empty list when nothing was recorded', async () => {
        const auth = mintAuthCookies({ id: 1, email: `empty-${suffix}@test.local`, role: 'RH', permission: 'ADMIN' });
        const res = await fetch(YEARS_ENDPOINT, { headers: { Cookie: auth.cookieHeader } });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.years).toEqual([]);
    });
});

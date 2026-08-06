import { describe, it, expect, beforeEach } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { truncateMysql } from '../../../../test/helpers/db';
import { env } from '../../../config/env';
import { RhKpiService } from '../../../services/RhKpiService';
import pool from '../../../db/mysql/connection';

const REPORT_ENDPOINT = `http://localhost:${env.API_PORT}/api/rh-kpi/report`;

describe('GET /api/rh-kpi/report sector scoping', () => {
    const suffix = `rhkpi-${Date.now()}`;

    async function seedUser(sectors: string[]): Promise<number> {
        const conn = await pool.getConnection();
        try {
            const [result] = await conn.execute(
                'INSERT INTO users (email, first_name, last_name, password, role_id, permission_id, sectors) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    `${suffix}-${Math.random().toString(36).slice(2)}@test.local`,
                    'Kpi',
                    'User',
                    `pwd-${suffix}`,
                    2,
                    1,
                    sectors.length > 0 ? JSON.stringify(sectors) : null,
                ],
            );
            return (result as any).insertId;
        } finally {
            conn.release();
        }
    }

    beforeEach(async () => {
        await truncateMysql();
        await pool.query('TRUNCATE TABLE rh_kpi');
    });

    it('restricts a plain RH to their own rows', async () => {
        const alice = await seedUser(['Nord-Est']);
        const bob = await seedUser(['Ouest']);
        const kpi = new RhKpiService();
        await kpi.bump(alice, 'Nord-Est', new Date('2024-06-03T08:00:00Z'), { interviews_placed: 5 });
        await kpi.bump(bob, 'Ouest', new Date('2024-06-03T08:00:00Z'), { interviews_placed: 9 });

        const auth = mintAuthCookies({
            id: alice,
            email: `alice-${suffix}@test.local`,
            role: 'RH',
            permission: 'EMPLOYEE',
        });
        const res = await fetch(`${REPORT_ENDPOINT}?year=2024`, { headers: { Cookie: auth.cookieHeader } });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.scope).toBe('self');
        const userIds = new Set<number>(json.weeks.flatMap((w: any) => w.users).map((u: any) => u.userId));
        expect(userIds).toEqual(new Set([alice]));
    });

    it('lets ADMIN/RESPONSABLE see every RH row', async () => {
        const alice = await seedUser(['Nord-Est']);
        const bob = await seedUser(['Ouest']);
        const kpi = new RhKpiService();
        await kpi.bump(alice, 'Nord-Est', new Date('2024-06-03T08:00:00Z'), { interviews_placed: 5 });
        await kpi.bump(bob, 'Ouest', new Date('2024-06-03T08:00:00Z'), { interviews_placed: 9 });

        const auth = mintAuthCookies({ id: 999, email: `admin-${suffix}@test.local`, role: 'RH', permission: 'ADMIN' });
        const res = await fetch(`${REPORT_ENDPOINT}?year=2024`, { headers: { Cookie: auth.cookieHeader } });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.scope).toBe('all');
        const userIds = new Set<number>(json.weeks.flatMap((w: any) => w.users).map((u: any) => u.userId));
        expect(userIds).toEqual(new Set([alice, bob]));
    });
});

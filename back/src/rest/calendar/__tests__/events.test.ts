import { describe, it, expect, beforeEach } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { truncateMysql } from '../../../../test/helpers/db';
import { env } from '../../../config/env';
import pool from '../../../db/mysql/connection';

const EVENTS_ENDPOINT = `http://localhost:${env.API_PORT}/api/calendar/events`;

describe('GET /api/calendar/events sector access', () => {
    const suffix = `cal-${Date.now()}`;
    const timeMin = '2024-06-01T00:00:00Z';
    const timeMax = '2024-06-30T00:00:00Z';

    async function seedUser(sectors: string[], oauth?: boolean): Promise<number> {
        const conn = await pool.getConnection();
        try {
            const [result] = await conn.execute(
                'INSERT INTO users (email, first_name, last_name, password, role_id, permission_id, sectors, oauth_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    `${suffix}-${Math.random().toString(36).slice(2)}@test.local`,
                    'Cal',
                    'User',
                    `pwd-${suffix}`,
                    2,
                    1,
                    sectors.length > 0 ? JSON.stringify(sectors) : null,
                    oauth ? 'some-token' : null,
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

    it('blocks an EMPLOYEE from reading a cross-sector RH agenda', async () => {
        const self = await seedUser(['Nord-Est']);
        const other = await seedUser(['Ouest'], true);
        const auth = mintAuthCookies({ id: self, email: `a-${suffix}@test.local`, role: 'RH', permission: 'EMPLOYEE' });

        const res = await fetch(`${EVENTS_ENDPOINT}?timeMin=${timeMin}&timeMax=${timeMax}&userId=${other}`, {
            headers: { Cookie: auth.cookieHeader },
        });

        expect(res.status).toBe(403);
    });

    it('lets an EMPLOYEE read a same-sector RH agenda (fails later on the missing Google token)', async () => {
        const self = await seedUser(['Nord-Est']);
        const same = await seedUser(['Nord-Est']);
        const auth = mintAuthCookies({ id: self, email: `a-${suffix}@test.local`, role: 'RH', permission: 'EMPLOYEE' });

        const res = await fetch(`${EVENTS_ENDPOINT}?timeMin=${timeMin}&timeMax=${timeMax}&userId=${same}`, {
            headers: { Cookie: auth.cookieHeader },
        });

        // Le garde secteur passe → on tombe sur le contrôle du token Google → 409.
        expect(res.status).toBe(409);
    });

    it('lets ADMIN read any RH agenda regardless of sector (fails later on the missing Google token)', async () => {
        const other = await seedUser(['Ouest']);
        const auth = mintAuthCookies({ id: 999, email: `admin-${suffix}@test.local`, role: 'RH', permission: 'ADMIN' });

        const res = await fetch(`${EVENTS_ENDPOINT}?timeMin=${timeMin}&timeMax=${timeMax}&userId=${other}`, {
            headers: { Cookie: auth.cookieHeader },
        });

        expect(res.status).toBe(409);
    });

    it('keeps self-read working (409 when own calendar is not connected)', async () => {
        const self = await seedUser(['Nord-Est']);
        const auth = mintAuthCookies({ id: self, email: `a-${suffix}@test.local`, role: 'RH', permission: 'EMPLOYEE' });

        const res = await fetch(`${EVENTS_ENDPOINT}?timeMin=${timeMin}&timeMax=${timeMax}`, {
            headers: { Cookie: auth.cookieHeader },
        });

        expect(res.status).toBe(409);
    });
});

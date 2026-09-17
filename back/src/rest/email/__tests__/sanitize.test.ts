import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { truncateMysql, dropMongo } from '../../../../test/helpers/db';
import { spyOnGoogleMail } from '../../../../test/helpers/googleMail';
import { env } from '../../../config/env';
import pool from '../../../db/mysql/connection';

describe('POST /api/email/send — sanitisation à l’envoi (HTML ad-hoc jamais stocké)', () => {
    let userId: number;
    let authCookies: { cookieHeader: string; csrfHeader: string };
    let sendEmail: ReturnType<typeof vi.spyOn>;
    const suffix = Date.now();

    beforeEach(async () => {
        ({ sendEmail } = spyOnGoogleMail());
        await truncateMysql();
        await dropMongo();

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.execute(
                'INSERT INTO users (email, first_name, last_name, password, role_id, permission_id, oauth_token, refresh_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    `email-sanitize-${suffix}@test.local`,
                    'RH',
                    `${suffix}`,
                    `pwd-${suffix}`,
                    1,
                    1,
                    'oauth-tok',
                    'refresh-tok',
                ],
            );
            userId = (result as any).insertId;
        } finally {
            conn.release();
        }

        authCookies = mintAuthCookies({
            id: userId,
            email: `email-sanitize-${suffix}@test.local`,
            role: 'RH',
            permission: 'EMPLOYEE',
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('retire le HTML actif avant l’appel à Gmail', async () => {
        const res = await fetch(`http://localhost:${env.API_PORT}/api/email/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: authCookies.cookieHeader,
                'x-csrf-token': authCookies.csrfHeader,
            },
            body: JSON.stringify({
                to: 'destinataire@test.local',
                subject: 'Objet',
                body: '<script>alert(1)</script><p onclick="steal()">Bonjour</p>',
            }),
        });
        expect(res.status).toBe(200);

        expect(sendEmail).toHaveBeenCalledTimes(1);
        const [, options] = sendEmail.mock.calls[0] as [unknown, { html: string; text: string }];
        expect(options.html).not.toContain('<script>');
        expect(options.html).not.toContain('onclick');
        expect(options.html).toContain('Bonjour');
    });
});

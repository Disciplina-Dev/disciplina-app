import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { truncateMysql } from '../../../../test/helpers/db';
import { env } from '../../../config/env';
import { GoogleGmailService } from '../gmail.service';
import { sendSystemEmail } from '../system-mail';
import pool from '../../../db/mysql/connection';

// Boîte système par défaut (env.SYSTEM_MAIL_SENDER) dans les tests.
const SYSTEM_EMAIL = env.SYSTEM_MAIL_SENDER;

async function createUser(
    email: string,
    roleId: number,
    tokens: { access: string | null; refresh: string | null } = { access: null, refresh: null },
): Promise<number> {
    const conn = await pool.getConnection();
    try {
        const [result] = await conn.execute(
            'INSERT INTO users (email, first_name, last_name, password, role_id, permission_id, oauth_token, refresh_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [email, 'User', 'Test', 'pwd', roleId, 1, tokens.access, tokens.refresh],
        );
        return (result as any).insertId;
    } finally {
        conn.release();
    }
}

describe('sendSystemEmail', () => {
    let sendEmail: any;

    beforeEach(async () => {
        await truncateMysql();
        sendEmail = vi.spyOn(GoogleGmailService.prototype, 'sendEmail').mockResolvedValue(undefined as any);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('sends from the configured system mailbox when it is connected', async () => {
        await createUser(SYSTEM_EMAIL, 1, { access: 'access', refresh: 'refresh' });
        const commercialId = await createUser('commercial@test.local', 1, { access: 'a2', refresh: 'r2' });

        await sendSystemEmail({ to: 'rh@test.local', subject: 'AB', html: '<p>AB</p>' });

        expect(sendEmail).toHaveBeenCalledTimes(1);
        expect(sendEmail.mock.calls[0][0]).toEqual({ access_token: 'access', refresh_token: 'refresh' });
        expect(sendEmail.mock.calls[0][1].to).toBe('rh@test.local');
        expect(commercialId).toBeGreaterThan(0);
    });

    // Garde de non-régression : boîte système absente (compte supprimé, autre
    // tenant non configuré) → le mail doit encore partir, depuis le staff.
    it('falls back to a connected staff account when the system mailbox is missing', async () => {
        await createUser('rh@test.local', 2, { access: 'rh-access', refresh: 'rh-refresh' });

        await sendSystemEmail({ to: 'hr@test.local', subject: 'AB', html: '<p>AB</p>' });

        expect(sendEmail).toHaveBeenCalledTimes(1);
        expect(sendEmail.mock.calls[0][0]).toEqual({ access_token: 'rh-access', refresh_token: 'rh-refresh' });
    });

    it('falls back when the system mailbox has no Google token', async () => {
        await createUser(SYSTEM_EMAIL, 1);
        await createUser('commercial@test.local', 1, { access: 'c-access', refresh: null });

        await sendSystemEmail({ to: 'hr@test.local', subject: 'AB', html: '<p>AB</p>' });

        expect(sendEmail).toHaveBeenCalledTimes(1);
        expect(sendEmail.mock.calls[0][0]).toEqual({ access_token: 'c-access', refresh_token: undefined });
    });

    it('retries with another connected account when the system mailbox token is revoked', async () => {
        await createUser(SYSTEM_EMAIL, 1, { access: 'dead-access', refresh: 'dead-refresh' });
        await createUser('rh@test.local', 2, { access: 'live-access', refresh: 'live-refresh' });

        sendEmail.mockRejectedValueOnce(Object.assign(new Error('invalid_grant'), { code: 'invalid_grant' }));

        await sendSystemEmail({ to: 'hr@test.local', subject: 'AB', html: '<p>AB</p>' });

        expect(sendEmail).toHaveBeenCalledTimes(2);
        expect(sendEmail.mock.calls[1][0]).toEqual({ access_token: 'live-access', refresh_token: 'live-refresh' });
    });

    it('never throws when no account can send', async () => {
        await expect(
            sendSystemEmail({ to: 'hr@test.local', subject: 'AB', html: '<p>AB</p>' }),
        ).resolves.toBeUndefined();
        expect(sendEmail).not.toHaveBeenCalled();
    });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { truncateMysql, dropMongo } from '../../../../test/helpers/db';
import { spyOnGoogleMail } from '../../../../test/helpers/googleMail';
import { env } from '../../../config/env';
import { CompanyRepository } from '../../../repositories/mysql/CompanyRepository';
import { MailSignatureModel } from '../../../db/mongo/schemas/mailTemplate.schema';
import pool from '../../../db/mysql/connection';

describe('POST /api/relance/company/:id/mail — signature auto-injection', () => {
    let companyId: number;
    let userId: number;
    let authCookies: { cookieHeader: string; csrfHeader: string };
    let sendEmail: ReturnType<typeof vi.spyOn>;

    const suffix = Date.now();

    beforeEach(async () => {
        ({ sendEmail } = spyOnGoogleMail());
        await truncateMysql();
        await dropMongo();
        await MailSignatureModel.deleteMany({});

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.execute(
                'INSERT INTO users (email, first_name, last_name, password, role_id, permission_id, oauth_token, refresh_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    `relance-sig-${suffix}@test.local`,
                    'Commercial',
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

        const companyRepo = new CompanyRepository();
        const siret = `${suffix}00000001`.slice(0, 14);
        companyId = await companyRepo.create({
            name: `Relance Sig Corp ${suffix}`,
            siret,
            address: '1 rue des Tests',
            sector: 'IT',
            conclusion: 'À Réfléchir',
            user_id: userId,
        });

        authCookies = mintAuthCookies({
            id: userId,
            email: `relance-sig-${suffix}@test.local`,
            role: 'COMMERCIAL',
            permission: 'EMPLOYEE',
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    async function postRelance(body: Record<string, unknown>) {
        return fetch(`http://localhost:${env.API_PORT}/api/relance/company/${companyId}/mail`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: authCookies.cookieHeader,
                'x-csrf-token': authCookies.csrfHeader,
            },
            body: JSON.stringify(body),
        });
    }

    it('appends the commercial signature when one is configured', async () => {
        await MailSignatureModel.create({
            _id: `${userId}:commercial`,
            user_id: userId,
            scope: 'commercial',
            driveFileId: 'drive-file-id',
            contentType: 'image/png',
        });

        const res = await postRelance({ to: 'company@test.local', subject: 'Relance', html: '<p>Bonjour</p>' });
        expect(res.status).toBe(200);

        expect(sendEmail).toHaveBeenCalledTimes(1);
        const [, options] = sendEmail.mock.calls[0];
        expect(options.html).toBe(
            '<p>Bonjour</p><br/><img src="data:image/png;base64,ZmFrZS1zaWduYXR1cmUtYnl0ZXM=" alt="signature" style="width:100%;max-width:480px;height:auto"/>',
        );
    });

    it('sends without a signature block when the user has none configured', async () => {
        const res = await postRelance({ to: 'company@test.local', subject: 'Relance', html: '<p>Bonjour</p>' });
        expect(res.status).toBe(200);

        expect(sendEmail).toHaveBeenCalledTimes(1);
        const [, options] = sendEmail.mock.calls[0];
        expect(options.html).toBe('<p>Bonjour</p>');
    });
});

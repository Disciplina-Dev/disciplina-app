import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { truncateMysql, dropMongo } from '../../../../test/helpers/db';
import { spyOnGoogleMail } from '../../../../test/helpers/googleMail';
import { env } from '../../../config/env';
import { CompanyRepository } from '../../../repositories/mysql/CompanyRepository';
import { MailSignatureModel } from '../../../db/mongo/schemas/mailTemplate.schema';
import { NeedsAnalysisRepository } from '../../../repositories/mongo/NeedsAnalysisRepository';
import pool from '../../../db/mysql/connection';
import { NeedsAnalysisStatus } from '../../../types/needsAnalysisNoSql.types';

describe('POST /api/webhooks/yousign — signature auto-injection', () => {
    let companyId: number;
    let userId: number;
    let sendEmail: ReturnType<typeof vi.spyOn>;
    const suffix = Date.now();
    const yousignId = `mock-yousign-req-${suffix}`;

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
                    `yousign-sig-${suffix}@test.local`,
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
        const siret = `${suffix}00000002`.slice(0, 14);
        companyId = await companyRepo.create({
            name: `Yousign Sig Corp ${suffix}`,
            siret,
            address: '1 rue des Tests',
            sector: 'IT',
            conclusion: 'À Réfléchir',
            user_id: userId,
        });

        const needsAnalysisRepo = new NeedsAnalysisRepository();
        await needsAnalysisRepo.create({
            _id: `ab-yousign-sig-${suffix}`,
            company_infos: { id: companyId, activities: [] },
            saler_info: { id: userId },
            positions: [{ title: 'Développeur' }],
            status: NeedsAnalysisStatus.EN_ATTENTE_SIGNATURE,
            signature_request_id: yousignId,
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    async function postWebhook() {
        return fetch(`http://localhost:${env.API_PORT}/api/webhooks/yousign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventName: 'procedure.signed', data: { id: yousignId } }),
        });
    }

    it('appends the commercial signature to the signed-AB notification email', async () => {
        await MailSignatureModel.create({
            _id: `${userId}:commercial`,
            user_id: userId,
            scope: 'commercial',
            driveFileId: 'drive-file-id',
            contentType: 'image/png',
        });

        const res = await postWebhook();
        expect(res.status).toBe(200);

        expect(sendEmail).toHaveBeenCalledTimes(1);
        const [, options] = sendEmail.mock.calls[0];
        expect(options.html).toContain(
            '<img src="data:image/png;base64,ZmFrZS1zaWduYXR1cmUtYnl0ZXM=" alt="signature" style="width:100%;max-width:480px;height:auto"/>',
        );
    });

    it('sends without a signature block when the commercial has none configured', async () => {
        const res = await postWebhook();
        expect(res.status).toBe(200);

        expect(sendEmail).toHaveBeenCalledTimes(1);
        const [, options] = sendEmail.mock.calls[0];
        expect(options.html).not.toContain('<img');
    });
});

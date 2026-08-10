import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { truncateMysql, dropMongo } from '../../../test/helpers/db';
import { spyOnGoogleMail } from '../../../test/helpers/googleMail';
import { env } from '../../config/env';
import { CompanyRepository } from '../../repositories/mysql/CompanyRepository';
import { UserRepository } from '../../repositories/mysql/UserRepository';
import { NotificationRepository } from '../../repositories/mongo/NotificationRepository';
import { MailSignatureModel } from '../../db/mongo/schemas/mailTemplate.schema';
import { NeedsAnalysisRepository } from '../../repositories/mongo/NeedsAnalysisRepository';
import pool from '../../db/mysql/connection';
import { NeedsAnalysisStatus, CompanyRegion } from '../../types/needsAnalysisNoSql.types';

describe('POST /api/webhooks/docuseal — signature auto-injection', () => {
    let companyId: number;
    let userId: number;
    let sendEmail: ReturnType<typeof vi.spyOn>;
    const suffix = Date.now();
    const submissionId = `mock-docuseal-sub-${suffix}`;

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
                    `docuseal-sig-${suffix}@test.local`,
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
        const siret = `${suffix}00000003`.slice(0, 14);
        companyId = await companyRepo.create({
            name: `Docuseal Sig Corp ${suffix}`,
            siret,
            address: '1 rue des Tests',
            sector: 'IT',
            conclusion: 'À Réfléchir',
            user_id: userId,
        });

        const needsAnalysisRepo = new NeedsAnalysisRepository();
        await needsAnalysisRepo.create({
            _id: `ab-docuseal-sig-${suffix}`,
            company_infos: { id: companyId, sector: CompanyRegion.SUD, activities: [] },
            saler_info: { id: userId },
            positions: [{ title: 'Développeur' }],
            status: NeedsAnalysisStatus.EN_ATTENTE_SIGNATURE,
            signature_request_id: submissionId,
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    async function createCommercial(label: string, sectors: string[] | null): Promise<number> {
        return new UserRepository().create({
            email: `commercial-${label}-${Date.now()}@test.local`,
            first_name: 'Commercial',
            last_name: label,
            password: 'hashed',
            role_id: 1,
            permission_id: 1,
            sectors,
            oauth_token: null,
            refresh_token: null,
        });
    }

    async function postWebhook() {
        return fetch(`http://localhost:${env.API_PORT}/api/webhooks/docuseal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event_type: 'submission.completed', data: { id: submissionId } }),
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

    it('notifies every commercial in the AB sector with an ab_signed notification', async () => {
        const sudCommercialId = await createCommercial('sud', ['Sud']);
        const nordCommercialId = await createCommercial('nord', ['Nord-Est']);
        const unassignedCommercialId = await createCommercial('unassigned', null);

        const res = await postWebhook();
        expect(res.status).toBe(200);

        const notificationRepo = new NotificationRepository();

        const sudNotifs = await notificationRepo.findForUser(sudCommercialId);
        const sudNotif = sudNotifs.find((n) => n.type === 'ab_signed');
        expect(sudNotif).toBeDefined();
        expect(sudNotif?.category).toBe('company');
        expect(sudNotif?.message).toContain('Docuseal Sig Corp');
        expect(sudNotif?.link).toMatch(/^\/commercial\/portefeuille\/docuseal-sig-corp-\d+$/);

        const nordNotifs = await notificationRepo.findForUser(nordCommercialId);
        expect(nordNotifs.some((n) => n.type === 'ab_signed')).toBe(false);

        const unassignedNotifs = await notificationRepo.findForUser(unassignedCommercialId);
        expect(unassignedNotifs.some((n) => n.type === 'ab_signed')).toBe(true);
    });
});

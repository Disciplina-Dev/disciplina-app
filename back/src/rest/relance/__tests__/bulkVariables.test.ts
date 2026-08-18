import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { truncateMysql, dropMongo } from '../../../../test/helpers/db';
import { spyOnGoogleMail } from '../../../../test/helpers/googleMail';
import { env } from '../../../config/env';
import { CandidateModel } from '../../../db/mongo/schemas/candidate.schema';
import { MailTemplateModel } from '../../../db/mongo/schemas/mailTemplate.schema';
import { CandidateStatus } from '../../../types/candidate.types';
import pool from '../../../db/mysql/connection';

const SHARED_RH_USER_ID = 0;

describe('POST /api/relance/bulk — variables du modèle remplacées par candidat', () => {
    let userId: number;
    let authCookies: { cookieHeader: string; csrfHeader: string };
    let sendEmail: ReturnType<typeof vi.spyOn>;

    const suffix = Date.now();

    beforeEach(async () => {
        ({ sendEmail } = spyOnGoogleMail());
        await truncateMysql();
        await dropMongo();
        await MailTemplateModel.deleteMany({});

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.execute(
                'INSERT INTO users (email, first_name, last_name, password, role_id, permission_id, oauth_token, refresh_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    `relance-var-${suffix}@test.local`,
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
            email: `relance-var-${suffix}@test.local`,
            role: 'RH',
            permission: 'EMPLOYEE',
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    async function createCandidate(fullName: string, email: string): Promise<string> {
        const doc = await CandidateModel.create({
            _id: randomUUID(),
            candidate_id: randomUUID(),
            identity: { full_name: fullName, email, phone: '0000000000' },
            status: CandidateStatus.SEEKING,
        });
        return doc._id as string;
    }

    async function createTemplate(subject: string, body: string): Promise<string> {
        const doc = await MailTemplateModel.create({
            _id: randomUUID(),
            user_id: SHARED_RH_USER_ID,
            scope: 'rh',
            name: 'Test relance variables',
            subject,
            body,
            peda_level: null,
            attachment: null,
            created_at: new Date(),
            updated_at: new Date(),
        });
        return doc._id as string;
    }

    async function postBulk(ids: string[], templateId: string) {
        return fetch(`http://localhost:${env.API_PORT}/api/relance/bulk`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: authCookies.cookieHeader,
                'x-csrf-token': authCookies.csrfHeader,
            },
            body: JSON.stringify({ ids, templateId }),
        });
    }

    it('remplace {{prenom}}/{{nom}} et retire les clés inconnues', async () => {
        const candidateId = await createCandidate('Marie Dupont', 'candidate@test.local');
        const templateId = await createTemplate(
            'Bonjour {{prenom}}',
            '<p>Bonjour {{prenom}} {{nom}},</p><p>{{inconnu}}</p>',
        );

        const res = await postBulk([candidateId], templateId);
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ sent: 1, errors: 0, total: 1 });

        expect(sendEmail).toHaveBeenCalledTimes(1);
        const [, options] = sendEmail.mock.calls[0] as [unknown, { subject: string; html: string; text: string }];
        expect(options.subject).toBe('Bonjour Marie');
        expect(options.html).toBe('<p>Bonjour Marie Dupont,</p><p></p>');
        expect(options.html).not.toContain('{{');
        expect(options.text).toBe('Bonjour Marie Dupont,');
    });

    it('génère un lien d\'import CV et un code quand le modèle les référence', async () => {
        const candidateId = await createCandidate('Marie Dupont', 'candidate@test.local');
        const templateId = await createTemplate(
            'Votre espace {{prenom}}',
            '<p>Code : {{code}}</p><p>{{lien_import}}</p>',
        );

        const res = await postBulk([candidateId], templateId);
        expect(res.status).toBe(200);
        expect((await res.json()).sent).toBe(1);

        const [, options] = sendEmail.mock.calls[0] as [unknown, { subject: string; html: string; text: string }];
        expect(options.subject).toBe('Votre espace Marie');
        expect(options.html).toMatch(/<p>Code : \d{6}<\/p>/);
        expect(options.html).toContain(`${env.FRONTEND_BASE_URL}/public/cv-import?sig=`);
        expect(options.html).not.toContain('{{');

        const [rows] = await pool.query(
            'SELECT external_email FROM external_link WHERE external_email = ?',
            ['candidate@test.local'],
        );
        expect((rows as { external_email: string }[]).length).toBe(1);
    });

    it('ne crée pas de lien d\'import si le modèle n\'utilise pas ces variables', async () => {
        const candidateId = await createCandidate('Marie Dupont', 'candidate@test.local');
        const templateId = await createTemplate('Bonjour {{prenom}}', '<p>Bonjour {{prenom}}</p>');

        const res = await postBulk([candidateId], templateId);
        expect(res.status).toBe(200);

        const [rows] = await pool.query(
            'SELECT external_email FROM external_link WHERE external_email = ?',
            ['candidate@test.local'],
        );
        expect((rows as { external_email: string }[]).length).toBe(0);
    });
});

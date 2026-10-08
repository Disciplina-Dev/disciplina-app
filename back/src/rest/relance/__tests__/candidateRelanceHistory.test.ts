import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { truncateMysql, dropMongo } from '../../../../test/helpers/db';
import { spyOnGoogleMail } from '../../../../test/helpers/googleMail';
import { env } from '../../../config/env';
import { signRelanceUrl } from '../../../external/crypto';
import { CandidateModel } from '../../../db/mongo/schemas/candidate.schema';
import { MailTemplateModel } from '../../../db/mongo/schemas/mailTemplate.schema';
import { CandidateStatus } from '../../../types/candidate.types';
import pool from '../../../db/mysql/connection';

const SHARED_RH_USER_ID = 0;

describe('candidate relance counter + history', () => {
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
                    `relance-hist-${suffix}@test.local`,
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
            email: `relance-hist-${suffix}@test.local`,
            role: 'RH',
            permission: 'EMPLOYEE',
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    async function createCandidate(email: string): Promise<string> {
        const doc = await CandidateModel.create({
            _id: randomUUID(),
            candidate_id: randomUUID(),
            identity: { full_name: 'Jean Relance', email, phone: '0000000000' },
            status: CandidateStatus.SEEKING,
        });
        return doc._id as string;
    }

    async function candidateRelanceFields(id: string): Promise<{ relanceCount: number; history: any[] }> {
        const res = await fetch(`http://localhost:${env.API_PORT}/api/graphql/candidates`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: authCookies.cookieHeader,
                'x-csrf-token': authCookies.csrfHeader,
            },
            body: JSON.stringify({
                query: `query($id: String!) { candidate(id: $id) { relanceCount relanceHistory { sentAt kind subject sentBy responseAt answer } } }`,
                variables: { id },
            }),
        });
        const json = await res.json();
        expect(json.errors).toBeUndefined();
        return { relanceCount: json.data.candidate.relanceCount, history: json.data.candidate.relanceHistory };
    }

    it('counts availability + template sends and records the candidate answer', async () => {
        const candidateId = await createCandidate(`relance-hist-${suffix}@test.local`);

        // 1. Relance disponibilité (Oui/Non).
        const sendRes = await fetch(`http://localhost:${env.API_PORT}/api/relance/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: authCookies.cookieHeader,
                'x-csrf-token': authCookies.csrfHeader,
            },
            body: JSON.stringify({ ids: [candidateId] }),
        });
        expect(sendRes.status).toBe(200);
        expect((await sendRes.json()).sent).toBe(1);
        expect(sendEmail).toHaveBeenCalledTimes(1);

        let fields = await candidateRelanceFields(candidateId);
        expect(fields.relanceCount).toBe(1);
        expect(fields.history).toHaveLength(1);
        expect(fields.history[0].kind).toBe('availability');
        expect(fields.history[0].sentBy).toBe(userId);
        expect(fields.history[0].responseAt).toBeNull();

        // 2. Envoi groupé d'un modèle RH : compte aussi comme relance reçue.
        const template = await MailTemplateModel.create({
            _id: randomUUID(),
            user_id: SHARED_RH_USER_ID,
            scope: 'rh',
            name: 'Test relance history',
            subject: 'Bonjour {{prenom}}',
            body: '<p>Bonjour {{prenom}}</p>',
            peda_level: null,
            attachment: null,
            created_at: new Date(),
            updated_at: new Date(),
        });
        const bulkRes = await fetch(`http://localhost:${env.API_PORT}/api/relance/bulk`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: authCookies.cookieHeader,
                'x-csrf-token': authCookies.csrfHeader,
            },
            body: JSON.stringify({ ids: [candidateId], templateId: template._id }),
        });
        expect(bulkRes.status).toBe(200);
        expect((await bulkRes.json()).sent).toBe(1);

        fields = await candidateRelanceFields(candidateId);
        expect(fields.relanceCount).toBe(2);
        expect(fields.history).toHaveLength(2);
        const kinds = fields.history.map((h) => h.kind).sort();
        expect(kinds).toEqual(['availability', 'template']);
        const templateEntry = fields.history.find((h) => h.kind === 'template');
        expect(templateEntry.subject).toBe('Bonjour Jean');

        // 3. Réponse du candidat (lien Oui) rattachée à l'historique.
        const { sig, ts } = signRelanceUrl(candidateId, 'oui');
        const answerRes = await fetch(
            `http://localhost:${env.API_PORT}/api/relance/response?id=${candidateId}&answer=oui&sig=${sig}&ts=${ts}`,
        );
        expect(answerRes.status).toBe(200);

        fields = await candidateRelanceFields(candidateId);
        // Le compteur ne compte que les envois : toujours 2 après la réponse.
        expect(fields.relanceCount).toBe(2);
        const answered = fields.history.filter((h) => h.responseAt);
        expect(answered).toHaveLength(1);
        expect(answered[0].answer).toBe('oui');
    });
});

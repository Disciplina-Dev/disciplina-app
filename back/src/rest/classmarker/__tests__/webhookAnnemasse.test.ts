import { describe, it, expect, beforeEach } from 'vitest';
import { truncateMysql } from '../../../../test/helpers/db';
import { env } from '../../../config/env';
import { syncWithRegion } from '../../../db/tenant';
import { getModels } from '../../../db/mongo/tenant';
import { hmac } from '../../../external/crypto';
import { CandidateRepository } from '../../../repositories/mongo/CandidateRepository';
import { CandidateStatus } from '../../../types/candidate.types';

const suffix = Date.now();
const candidateId = `cm-anne-${suffix}`;

async function seedAnnemasseCandidate(): Promise<void> {
    await syncWithRegion('annemasse', async () => {
        await getModels().Candidate.deleteMany({ _id: candidateId });
        await new CandidateRepository().create({
            _id: candidateId,
            candidate_id: candidateId,
            status: CandidateStatus.SEEKING,
            identity: {
                full_name: 'Candidat Annemasse',
                email: `cm-anne-${suffix}@test.local`,
                phone: '0600000000',
            } as any,
        });
    });
}

describe('POST /api/webhooks/classmarker — multi-région', () => {
    beforeEach(async () => {
        await truncateMysql();
        await seedAnnemasseCandidate();
    });

    it('traite un candidat annemasse (persisté dans la base annemasse)', async () => {
        const rawBody = JSON.stringify({
            payload_status: 'live',
            result: { cm_user_id: candidateId, percentage: 72 },
        });
        const res = await fetch(`http://localhost:${env.API_PORT}/api/webhooks/classmarker`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-classmarker-hmac-sha256': hmac.sign(env.CLASSMARKER_WEBHOOK_SECRET ?? '', rawBody, 'base64'),
            },
            body: rawBody,
        });
        expect(res.status).toBe(200);

        await syncWithRegion('annemasse', async () => {
            const doc = await getModels().Candidate.findById(candidateId).lean();
            expect(doc?.classmarker).toMatchObject({ percentage: 72, passed: true });
            expect(doc?.classmarker_history).toHaveLength(1);
        });
    });
});
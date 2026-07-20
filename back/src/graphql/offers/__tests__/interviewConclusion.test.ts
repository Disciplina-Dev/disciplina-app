import { describe, it, expect } from 'vitest';
import { mintToken } from '../../../../test/helpers/auth';
import { OfferRepository } from '../../../repositories/mongo/OfferRepository';
import { seedOffer } from '../../../../test/helpers/seedOffer';
import { CandidateRepository } from '../../../repositories/mongo/CandidateRepository';
import { CandidateHistoryRepository } from '../../../repositories/mongo/CandidateHistoryRepository';
import { env } from '../../../config/env';
import { OfferStatus, MatchedCandidateStatus } from '../../../types/matching.types';
import { CandidateStatus, TitleProfessionalType } from '../../../types/candidate.types';

const ENDPOINT = `http://localhost:${env.API_PORT}/api/graphql/offers`;

function authHeaders(token: string) {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function gql(token: string, body: object) {
    const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify(body),
    });
    return { res, json: await res.json() };
}

const MUTATION = `mutation(
    $offerId: String!
    $candidateId: String!
    $conclusion: InterviewConclusion!
    $immersionStartDate: String
    $immersionEndDate: String
) {
    setInterviewConclusion(
        offerId: $offerId
        candidateId: $candidateId
        conclusion: $conclusion
        immersionStartDate: $immersionStartDate
        immersionEndDate: $immersionEndDate
    ) {
        id
        proposedCandidate {
            id
            interviewConclusion
            immersionStartDate
            immersionEndDate
        }
    }
}`;

async function seedJobWithProposedCandidate(
    suffix: number,
    bookedInterviewSlot: string,
): Promise<{ offerId: string; candidateId: string }> {
    const jobRepo = new OfferRepository();
    const candidateRepo = new CandidateRepository();

    const offerId = `job-conclusion-${suffix}`;
    await seedOffer({
        _id: offerId,
        company_name: `Conclusion Corp ${suffix}`,
        status: OfferStatus.CV_SEND,
    });

    const candidateId = `cand-conclusion-${suffix}`;
    await candidateRepo.create({
        _id: candidateId,
        candidate_id: candidateId,
        tp_type: TitleProfessionalType.AD,
        status: CandidateStatus.SEEKING,
        identity: {
            full_name: `Eve ${suffix}`,
            email: `eve-${suffix}@test.local`,
            phone: '0600000000',
            age: 26,
        },
    });

    await jobRepo.addProposedCandidate(offerId, {
        id: candidateId,
        full_name: `Eve ${suffix}`,
        email: `eve-${suffix}@test.local`,
        status: MatchedCandidateStatus.INTERVIEW,
        booked_interview_slot: bookedInterviewSlot,
        interview_location: 'Saint-Denis',
    });

    return { offerId, candidateId };
}

describe('GraphQL setInterviewConclusion', () => {
    it('rejects when the interview has not happened yet', async () => {
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'RH', permission: 'ADMIN' });
        const suffix = Date.now();
        const futureSlot = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const { offerId, candidateId } = await seedJobWithProposedCandidate(suffix, futureSlot);

        const { res, json } = await gql(token, {
            query: MUTATION,
            variables: { offerId, candidateId, conclusion: 'REJECTED' },
        });

        expect(res.status).toBe(200);
        expect(json.errors).toBeDefined();
        expect(json.errors[0].message).toMatch(/pas encore eu lieu/i);
    });

    it('rejects IMMERSING without immersion dates', async () => {
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'RH', permission: 'ADMIN' });
        const suffix = Date.now() + 1;
        const pastSlot = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { offerId, candidateId } = await seedJobWithProposedCandidate(suffix, pastSlot);

        const { res, json } = await gql(token, {
            query: MUTATION,
            variables: { offerId, candidateId, conclusion: 'IMMERSING' },
        });

        expect(res.status).toBe(200);
        expect(json.errors).toBeDefined();
        expect(json.errors[0].message).toMatch(/immersion/i);
    });

    it.each([
        ['REJECTED', CandidateStatus.SEEKING],
        ['CONTRACT', CandidateStatus.CONTRACT],
    ])('sets %s conclusion, candidate status, and a history entry', async (conclusion, expectedStatus) => {
        const token = mintToken({ id: 1, email: 'rh@test.local', role: 'RH', permission: 'ADMIN' });
        const suffix = Date.now() + Math.floor(Math.random() * 10000);
        const pastSlot = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { offerId, candidateId } = await seedJobWithProposedCandidate(suffix, pastSlot);

        const { res, json } = await gql(token, {
            query: MUTATION,
            variables: { offerId, candidateId, conclusion },
        });

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        const updated = json.data.setInterviewConclusion.proposedCandidate.find(
            (c: { id: string }) => c.id === candidateId,
        );
        expect(updated.interviewConclusion).toBe(conclusion);

        const candidateRepo = new CandidateRepository();
        const candidate = await candidateRepo.findById(candidateId);
        expect(candidate?.status).toBe(expectedStatus);

        const historyRepo = new CandidateHistoryRepository();
        const history = await historyRepo.findByCandidateId(candidateId);
        const manualEntry = history.find((h) => h.owner_email === 'rh@test.local');
        expect(manualEntry).toBeDefined();
    });

    it('sets IMMERSING conclusion with immersion dates', async () => {
        const token = mintToken({ id: 1, email: 'rh@test.local', role: 'RH', permission: 'ADMIN' });
        const suffix = Date.now() + Math.floor(Math.random() * 10000);
        const pastSlot = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { offerId, candidateId } = await seedJobWithProposedCandidate(suffix, pastSlot);

        const { res, json } = await gql(token, {
            query: MUTATION,
            variables: {
                offerId,
                candidateId,
                conclusion: 'IMMERSING',
                immersionStartDate: '2026-07-01',
                immersionEndDate: '2026-07-15',
            },
        });

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        const updated = json.data.setInterviewConclusion.proposedCandidate.find(
            (c: { id: string }) => c.id === candidateId,
        );
        expect(updated.interviewConclusion).toBe('IMMERSING');
        expect(updated.immersionStartDate).toBe('2026-07-01');
        expect(updated.immersionEndDate).toBe('2026-07-15');

        const candidateRepo = new CandidateRepository();
        const candidate = await candidateRepo.findById(candidateId);
        expect(candidate?.status).toBe(CandidateStatus.IMMERSING);
    });
});

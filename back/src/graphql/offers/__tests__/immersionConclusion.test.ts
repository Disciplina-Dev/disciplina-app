import { describe, it, expect } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { OfferRepository } from '../../../repositories/mongo/OfferRepository';
import { seedOffer } from '../../../../test/helpers/seedOffer';
import { CandidateRepository } from '../../../repositories/mongo/CandidateRepository';
import { CandidateHistoryRepository } from '../../../repositories/mongo/CandidateHistoryRepository';
import { env } from '../../../config/env';
import { InterviewConclusion, OfferStatus, MatchedCandidateStatus } from '../../../types/matching.types';
import { CandidateStatus, TitleProfessionalType } from '../../../types/candidate.types';

const ENDPOINT = `http://localhost:${env.API_PORT}/api/graphql/offers`;

function authHeaders(auth: { cookieHeader: string; csrfHeader: string }) {
    return { 'Content-Type': 'application/json', Cookie: auth.cookieHeader, 'x-csrf-token': auth.csrfHeader };
}

async function gql(auth: { cookieHeader: string; csrfHeader: string }, body: object) {
    const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: authHeaders(auth),
        body: JSON.stringify(body),
    });
    return { res, json: await res.json() };
}

const MUTATION = `mutation(
    $offerId: String!
    $candidateId: String!
    $conclusion: ImmersionConclusion!
) {
    setImmersionConclusion(
        offerId: $offerId
        candidateId: $candidateId
        conclusion: $conclusion
    ) {
        id
        proposedCandidate {
            id
            interviewConclusion
            immersionConclusion
        }
    }
}`;

async function seedJobWithImmersionCandidate(suffix: number): Promise<{ offerId: string; candidateId: string }> {
    const jobRepo = new OfferRepository();
    const candidateRepo = new CandidateRepository();

    const offerId = `job-immersion-concl-${suffix}`;
    await seedOffer({
        _id: offerId,
        company_name: `Immersion Corp ${suffix}`,
        status: OfferStatus.CV_SEND,
    });

    const candidateId = `cand-immersion-concl-${suffix}`;
    await candidateRepo.create({
        _id: candidateId,
        candidate_id: candidateId,
        tp_types: [TitleProfessionalType.AD],
        status: CandidateStatus.IMMERSING,
        identity: {
            full_name: `Lea ${suffix}`,
            email: `lea-${suffix}@test.local`,
            phone: '0600000000',
            age: 22,
        },
    });

    const pastSlot = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await jobRepo.addProposedCandidate(offerId, {
        id: candidateId,
        full_name: `Lea ${suffix}`,
        email: `lea-${suffix}@test.local`,
        status: MatchedCandidateStatus.INTERVIEW,
        booked_interview_slot: pastSlot,
        interview_location: 'Saint-Denis',
        interview_conclusion: InterviewConclusion.IMMERSING,
        immersion_start_date: '2026-07-01',
        immersion_end_date: '2026-07-31',
    });

    return { offerId, candidateId };
}

describe('GraphQL setImmersionConclusion', () => {
    it('rejects when the candidate is not in immersion', async () => {
        const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'RH', permission: 'ADMIN' });
        const jobRepo = new OfferRepository();
        const candidateRepo = new CandidateRepository();

        const suffix = Date.now();
        const offerId = `job-no-immersion-${suffix}`;
        const candidateId = `cand-no-immersion-${suffix}`;

        await seedOffer({ _id: offerId, company_name: `Corp ${suffix}`, status: OfferStatus.CV_SEND });
        await candidateRepo.create({
            _id: candidateId,
            candidate_id: candidateId,
            tp_types: [TitleProfessionalType.AD],
            status: CandidateStatus.SEEKING,
            identity: { full_name: `Tom ${suffix}`, email: `tom-${suffix}@test.local`, phone: '0600000000', age: 25 },
        });

        const pastSlot = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        await jobRepo.addProposedCandidate(offerId, {
            id: candidateId,
            full_name: `Tom ${suffix}`,
            email: `tom-${suffix}@test.local`,
            status: MatchedCandidateStatus.INTERVIEW,
            booked_interview_slot: pastSlot,
            interview_location: 'Saint-Denis',
        });

        const { res, json } = await gql(auth, {
            query: MUTATION,
            variables: { offerId, candidateId, conclusion: 'REJECTED' },
        });

        expect(res.status).toBe(200);
        expect(json.errors).toBeDefined();
        expect(json.errors[0].message).toMatch(/immersion/i);
    });

    it.each([
        ['REJECTED', CandidateStatus.SEEKING],
        ['CONTRACT', CandidateStatus.CONTRACT],
    ])('sets %s conclusion, candidate status, and a history entry', async (conclusion, expectedStatus) => {
        const auth = mintAuthCookies({ id: 1, email: 'rh@test.local', role: 'RH', permission: 'ADMIN' });
        const suffix = Date.now() + Math.floor(Math.random() * 10000);
        const { offerId, candidateId } = await seedJobWithImmersionCandidate(suffix);

        const { res, json } = await gql(auth, {
            query: MUTATION,
            variables: { offerId, candidateId, conclusion },
        });

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        const updated = json.data.setImmersionConclusion.proposedCandidate.find(
            (c: { id: string }) => c.id === candidateId,
        );

        expect(updated.immersionConclusion).toBe(conclusion);

        const candidateRepo = new CandidateRepository();
        const candidate = await candidateRepo.findById(candidateId);
        expect(candidate?.status).toBe(expectedStatus);

        const historyRepo = new CandidateHistoryRepository();
        const history = await historyRepo.findByCandidateId(candidateId);
        const manualEntry = history.find((h) => h.owner_email === 'rh@test.local');
        expect(manualEntry).toBeDefined();
    });
});

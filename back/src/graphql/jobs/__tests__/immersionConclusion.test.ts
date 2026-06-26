import { describe, it, expect } from 'vitest';
import { mintToken } from '../../../../test/helpers/auth';
import { JobRepository } from '../../../repositories/mongo/JobRepository';
import { CandidateRepository } from '../../../repositories/mongo/CandidateRepository';
import { CandidateHistoryRepository } from '../../../repositories/mongo/CandidateHistoryRepository';
import { env } from '../../../config/env';
import { InterviewConclusion, JobStatus, ProposedCandidateAnswer } from '../../../types/job.types';
import { CandidateStatus, TitleProfessionalType } from '../../../types/candidate.types';
import { unzipSync } from 'zlib';

const ENDPOINT = `http://localhost:${env.API_PORT}/api/graphql/jobs`;

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
    $jobId: String!
    $candidateId: String!
    $conclusion: ImmersionConclusion!
) {
    setImmersionConclusion(
        jobId: $jobId
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

async function seedJobWithImmersionCandidate(suffix: number): Promise<{ jobId: string; candidateId: string }> {
    const jobRepo = new JobRepository();
    const candidateRepo = new CandidateRepository();

    const jobId = `job-immersion-concl-${suffix}`;
    await jobRepo.create({
        _id: jobId,
        company_name: `Immersion Corp ${suffix}`,
        status: JobStatus.CV_SEND,
    });

    const candidateId = `cand-immersion-concl-${suffix}`;
    await candidateRepo.create({
        _id: candidateId,
        candidate_id: candidateId,
        tp_type: TitleProfessionalType.AD,
        status: CandidateStatus.IMMERSING,
        identity: {
            full_name: `Lea ${suffix}`,
            email: `lea-${suffix}@test.local`,
            phone: '0600000000',
            age: 22,
        },
    });

    const pastSlot = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await jobRepo.addProposedCandidate(jobId, {
        id: candidateId,
        full_name: `Lea ${suffix}`,
        email: `lea-${suffix}@test.local`,
        answer: ProposedCandidateAnswer.ACCEPTED,
        booked_interview_slot: pastSlot,
        interview_location: 'Saint-Denis',
        interview_conclusion: InterviewConclusion.IMMERSING,
        immersion_start_date: '2026-07-01',
        immersion_end_date: '2026-07-31',
    });

    return { jobId, candidateId };
}

describe('GraphQL setImmersionConclusion', () => {
    it('rejects when the candidate is not in immersion', async () => {
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
        const jobRepo = new JobRepository();
        const candidateRepo = new CandidateRepository();

        const suffix = Date.now();
        const jobId = `job-no-immersion-${suffix}`;
        const candidateId = `cand-no-immersion-${suffix}`;

        await jobRepo.create({ _id: jobId, company_name: `Corp ${suffix}`, status: JobStatus.CV_SEND });
        await candidateRepo.create({
            _id: candidateId,
            candidate_id: candidateId,
            tp_type: TitleProfessionalType.AD,
            status: CandidateStatus.MATCHED,
            identity: { full_name: `Tom ${suffix}`, email: `tom-${suffix}@test.local`, phone: '0600000000', age: 25 },
        });

        const pastSlot = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        await jobRepo.addProposedCandidate(jobId, {
            id: candidateId,
            full_name: `Tom ${suffix}`,
            email: `tom-${suffix}@test.local`,
            answer: ProposedCandidateAnswer.ACCEPTED,
            booked_interview_slot: pastSlot,
            interview_location: 'Saint-Denis',
        });

        const { res, json } = await gql(token, {
            query: MUTATION,
            variables: { jobId, candidateId, conclusion: 'REJECTED' },
        });

        expect(res.status).toBe(200);
        expect(json.errors).toBeDefined();
        expect(json.errors[0].message).toMatch(/immersion/i);
    });

    it.each([
        ['REJECTED', CandidateStatus.SEEKING],
        ['CONTRACT', CandidateStatus.CONTRACT],
    ])('sets %s conclusion, candidate status, and a history entry', async (conclusion, expectedStatus) => {
        const token = mintToken({ id: 1, email: 'rh@test.local', role: 'ADMIN' });
        const suffix = Date.now() + Math.floor(Math.random() * 10000);
        const { jobId, candidateId } = await seedJobWithImmersionCandidate(suffix);

        const { res, json } = await gql(token, {
            query: MUTATION,
            variables: { jobId, candidateId, conclusion },
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

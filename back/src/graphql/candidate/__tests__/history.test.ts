import { describe, it, expect } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { CandidateRepository } from '../../../repositories/mongo/CandidateRepository';
import { OfferRepository } from '../../../repositories/mongo/OfferRepository';
import { seedOffer } from '../../../../test/helpers/seedOffer';
import { env } from '../../../config/env';
import { CandidateStatus, TitleProfessionalType } from '../../../types/candidate.types';
import { MatchedCandidateStatus } from '../../../types/matching.types';

const ENDPOINT = `http://localhost:${env.API_PORT}/api/graphql/candidates`;
const JOBS_ENDPOINT = `http://localhost:${env.API_PORT}/api/graphql/offers`;

async function graphqlRequest(
    token: ReturnType<typeof mintAuthCookies>,
    query: string,
    variables?: Record<string, unknown>,
) {
    const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Cookie: token.cookieHeader,
            'x-csrf-token': token.csrfHeader,
        },
        body: JSON.stringify({ query, variables }),
    });
    return res.json();
}

async function jobsGraphqlRequest(
    token: ReturnType<typeof mintAuthCookies>,
    query: string,
    variables?: Record<string, unknown>,
) {
    const res = await fetch(JOBS_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Cookie: token.cookieHeader,
            'x-csrf-token': token.csrfHeader,
        },
        body: JSON.stringify({ query, variables }),
    });
    return res.json();
}

async function seedCandidate(suffix: string) {
    const repo = new CandidateRepository();
    const id = `hist-${suffix}`;
    return repo.create({
        _id: id,
        candidate_id: id,
        tp_type: TitleProfessionalType.AD,
        status: CandidateStatus.SEEKING,
        identity: { full_name: `History ${suffix}`, email: `history-${suffix}@test.local`, phone: '0600000000' },
    });
}

describe('candidateHistory', () => {
    // it('records an automatic entry on status change and exposes it via the query', async () => {
    //     const token = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'RH', permission: 'ADMIN' });
    //     const suffix = `auto-${Date.now()}`;
    //     const candidate = await seedCandidate(suffix);

    //     await graphqlRequest(
    //         token,
    //         `mutation($id: String!, $input: UpdateCandidateInput!) { updateCandidate(id: $id, input: $input) { id status } }`,
    //         { id: candidate._id, input: { status: 'CONTRACT' } },
    //     );

    //     const json = await graphqlRequest(
    //         token,
    //         `query($candidateId: String!) { candidateHistory(candidateId: $candidateId) { id type description ownerEmail createdAt } }`,
    //         { candidateId: candidate._id },
    //     );

    //     expect(json.errors).toBeUndefined();
    //     const entries = json.data.candidateHistory;
    //     expect(entries).toHaveLength(1);
    //     expect(entries[0].type).toBe('RH');
    //     expect(entries[0].ownerEmail).toBeNull();
    // });

    it('adds a manual entry owned by the requesting user and returns it in chronological order', async () => {
        const token = mintAuthCookies({ id: 1, email: 'manual@test.local', role: 'RH', permission: 'ADMIN' });
        const suffix = `manual-${Date.now()}`;
        const candidate = await seedCandidate(suffix);

        const addRes = await graphqlRequest(
            token,
            `mutation($candidateId: String!, $description: String!) {
                addCandidateHistoryEntry(candidateId: $candidateId, description: $description) {
                    id type description ownerEmail createdAt
                }
            }`,
            { candidateId: candidate._id, description: 'Note manuelle' },
        );
        expect(addRes.errors).toBeUndefined();
        expect(addRes.data.addCandidateHistoryEntry.type).toBe('RH');
        expect(addRes.data.addCandidateHistoryEntry.ownerEmail).toBe('manual@test.local');

        const secondAdd = await graphqlRequest(
            token,
            `mutation($candidateId: String!, $description: String!) {
                addCandidateHistoryEntry(candidateId: $candidateId, description: $description) { id createdAt }
            }`,
            { candidateId: candidate._id, description: 'Deuxième note' },
        );
        expect(secondAdd.errors).toBeUndefined();

        const json = await graphqlRequest(
            token,
            `query($candidateId: String!) { candidateHistory(candidateId: $candidateId) { id description createdAt } }`,
            { candidateId: candidate._id },
        );
        const entries = json.data.candidateHistory;
        expect(entries).toHaveLength(2);
        expect(new Date(entries[0].createdAt).getTime()).toBeGreaterThanOrEqual(
            new Date(entries[1].createdAt).getTime(),
        );
    });

    it('only allows the owner to delete their manual entry', async () => {
        const ownerToken = mintAuthCookies({ id: 1, email: 'owner@test.local', role: 'RH', permission: 'ADMIN' });
        const otherToken = mintAuthCookies({ id: 2, email: 'other@test.local', role: 'RH', permission: 'ADMIN' });
        const suffix = `owner-${Date.now()}`;
        const candidate = await seedCandidate(suffix);

        const addRes = await graphqlRequest(
            ownerToken,
            `mutation($candidateId: String!, $description: String!) {
                addCandidateHistoryEntry(candidateId: $candidateId, description: $description) { id }
            }`,
            { candidateId: candidate._id, description: 'Note privée' },
        );
        const entryId = addRes.data.addCandidateHistoryEntry.id;

        const deniedRes = await graphqlRequest(
            otherToken,
            `mutation($id: String!) { deleteCandidateHistoryEntry(id: $id) }`,
            { id: entryId },
        );
        expect(deniedRes.errors).toBeDefined();
        expect(deniedRes.errors[0].message).toMatch(/owner/i);

        const allowedRes = await graphqlRequest(
            ownerToken,
            `mutation($id: String!) { deleteCandidateHistoryEntry(id: $id) }`,
            { id: entryId },
        );
        expect(allowedRes.errors).toBeUndefined();
        expect(allowedRes.data.deleteCandidateHistoryEntry).toBe(true);
    });

    // it('rejects deleting an automatic entry', async () => {
    //     const token = mintAuthCookies({ id: 1, email: 'auto-delete@test.local', role: 'ADMIN' });
    //     const suffix = `auto-delete-${Date.now()}`;
    //     const candidate = await seedCandidate(suffix);

    //     await graphqlRequest(
    //         token,
    //         `mutation($id: String!, $input: UpdateCandidateInput!) { updateCandidate(id: $id, input: $input) { id } }`,
    //         { id: candidate._id, input: { status: 'CONTRACT' } },
    //     );

    //     const historyJson = await graphqlRequest(
    //         token,
    //         `query($candidateId: String!) { candidateHistory(candidateId: $candidateId) { id type } }`,
    //         { candidateId: candidate._id },
    //     );
    //     const autoEntryId = historyJson.data.candidateHistory[0].id;

    //     const deleteJson = await graphqlRequest(
    //         token,
    //         `mutation($id: String!) { deleteCandidateHistoryEntry(id: $id) }`,
    //         { id: autoEntryId },
    //     );
    //     expect(deleteJson.errors).toBeDefined();
    //     expect(deleteJson.errors[0].message).toMatch(/automatic/i);
    // });

    it('records a CANDIDATE-typed entry when the matched candidate status becomes ACCEPTED', async () => {
        const token = mintAuthCookies({ id: 1, email: 'jobs@test.local', role: 'RH', permission: 'ADMIN' });
        const suffix = `accept-${Date.now()}`;
        const candidateId = `hist-job-${suffix}`;
        const jobRepo = new OfferRepository();
        const job = await seedOffer({ _id: `job-${suffix}`, company_name: 'ACME' });
        await jobRepo.addMatchedCandidate(job._id, {
            id: candidateId,
            full_name: 'Job Candidate',
            status: MatchedCandidateStatus.PRE_SELECTED,
        });

        const mutationRes = await jobsGraphqlRequest(
            token,
            `mutation($offerId: String!, $candidateId: String!, $status: MatchedCandidateStatus!) {
                updateMatchedCandidateStatus(offerId: $offerId, candidateId: $candidateId, status: $status) { id }
            }`,
            { offerId: job._id, candidateId, status: 'ACCEPTED' },
        );
        expect(mutationRes.errors).toBeUndefined();

        const historyJson = await graphqlRequest(
            token,
            `query($candidateId: String!) { candidateHistory(candidateId: $candidateId) { type description } }`,
            { candidateId },
        );
        expect(historyJson.data.candidateHistory).toHaveLength(1);
        expect(historyJson.data.candidateHistory[0].type).toBe('CANDIDATE');
    });
});

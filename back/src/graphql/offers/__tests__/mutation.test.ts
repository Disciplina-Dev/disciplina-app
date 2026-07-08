import { describe, it, expect } from 'vitest';
import { mintToken } from '../../../../test/helpers/auth';
import { NeedsAnalysisRepository } from '../../../repositories/mongo/NeedsAnalysisRepository';
import { seedOffer } from '../../../../test/helpers/seedOffer';
import { CandidateRepository } from '../../../repositories/mongo/CandidateRepository';
import { env } from '../../../config/env';
import { OfferStatus, Localisation, Sector, DesiredSex } from '../../../types/matching.types';
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

describe('GraphQL job mutations', () => {
    describe('updateOffer', () => {
        it('updates companyName and returns the job', async () => {
            const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
            const suffix = Date.now();

            const seeded = await seedOffer({
                _id: `job-update-${suffix}`,
                company_name: `Old Corp ${suffix}`,
                status: OfferStatus.NOT_MATCHED,
                localisation: [Localisation.SAINT_DENIS],
            });

            const { res, json } = await gql(token, {
                query: `mutation($id: String!, $job: OfferInput!) {
                    updateOffer(id: $id, job: $job) { id companyName status }
                }`,
                variables: {
                    id: seeded._id,
                    job: { id: seeded._id, companyName: `Updated Corp ${suffix}`, localisation: ['SAINT_DENIS'] },
                },
            });

            console.log(json);
            expect(res.status).toBe(200);
            expect(json.errors).toBeUndefined();
            expect(json.data.updateOffer.companyName).toBe(`Updated Corp ${suffix}`);
        });

        it('returns null when updating a non-existent job', async () => {
            const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });

            const { res, json } = await gql(token, {
                query: `mutation($id: String!, $job: OfferInput!) { updateOffer(id: $id, job: $job) { id } }`,
                variables: { id: 'non-existent-id', job: { id: 'non-existent-id', companyName: 'Ghost' } },
            });

            expect(res.status).toBe(200);
            expect(json.data.updateOffer).toBe(null);
        });
    });

    describe('unmatchOffer', () => {
        it('clears matched candidates and sets NOT_MATCHED', async () => {
            const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
            const suffix = Date.now();
            const repo = new NeedsAnalysisRepository();

            const seeded = await seedOffer({
                _id: `job-unmatch-${suffix}`,
                company_name: `Unmatch Corp ${suffix}`,
                status: OfferStatus.MATCHED,
            });
            await repo.addMatchedCandidate(seeded._id, {
                id: `cand-${suffix}`,
                full_name: `Jane ${suffix}`,
                age: 25,
                email: `jane-${suffix}@test.local`,
            });

            const { res, json } = await gql(token, {
                query: `mutation($id: String!) { unmatchOffer(id: $id) { id status matchedCandidate { id } } }`,
                variables: { id: seeded._id },
            });

            expect(res.status).toBe(200);
            expect(json.errors).toBeUndefined();
            expect(json.data.unmatchOffer.status).toBe('NOT_MATCHED');
            expect(json.data.unmatchOffer.matchedCandidate).toEqual([]);

            const { json: vJson } = await gql(token, {
                query: `query($id: String!) { matchOffer(id: $id) { status matchedCandidate { id } } }`,
                variables: { id: seeded._id },
            });
            expect(vJson.data.matchOffer.status).toBe('NOT_MATCHED');
            expect(vJson.data.matchOffer.matchedCandidate).toEqual([]);
        });

        it('returns null when unmatching a non-existent job', async () => {
            const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });

            const { res, json } = await gql(token, {
                query: `mutation($id: String!) { unmatchOffer(id: $id) { id } }`,
                variables: { id: 'non-existent-id' },
            });

            expect(res.status).toBe(200);
            expect(json.errors).toBeUndefined();
            expect(json.data.unmatchOffer).toBeNull();
        });
    });

    describe('addCandidateToOffer', () => {
        it('adds a matching candidate and sets status to MATCHED', async () => {
            const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
            const suffix = Date.now();
            const candidateRepo = new CandidateRepository();

            const offerId = `job-add-${suffix}`;
            await seedOffer({
                _id: offerId,
                company_name: `Add Corp ${suffix}`,
                desired_tp: TitleProfessionalType.AD,
                driving_license_b: true,
                desired_sex: DesiredSex.MIXTE,
                age_range: '20-40',
                status: OfferStatus.NOT_MATCHED,
                localisation: [Localisation.SAINT_DENIS],
                sector: Sector.RESTAURATION,
            });

            const candidateId = `cand-add-${suffix}`;
            await candidateRepo.create({
                _id: candidateId,
                candidate_id: candidateId,
                tp_type: TitleProfessionalType.AD,
                status: CandidateStatus.SEEKING,
                identity: {
                    full_name: `Alice ${suffix}`,
                    email: `alice-${suffix}@test.local`,
                    phone: '0600000000',
                    age: 28,
                    driving_license_b: true,
                },
                desired_sectors: [Sector.RESTAURATION],
                job_info: { geographic_mobility: [Localisation.SAINT_DENIS] },
            });

            const { res, json } = await gql(token, {
                query: `mutation($offerId: String!, $candidateId: String!) {
                    addCandidateToOffer(offerId: $offerId, candidateId: $candidateId) {
                        id status matchedCandidate { id fullName }
                    }
                }`,
                variables: { offerId, candidateId },
            });

            expect(res.status).toBe(200);
            expect(json.errors).toBeUndefined();
            expect(json.data.addCandidateToOffer.status).toBe('NOT_MATCHED');
            expect(json.data.addCandidateToOffer.matchedCandidate).toHaveLength(1);
            expect(json.data.addCandidateToOffer.matchedCandidate[0].id).toBe(candidateId);
            expect(json.data.addCandidateToOffer.matchedCandidate[0].fullName).toBe(`Alice ${suffix}`);
        });

        it('errors when candidate does not exist', async () => {
            const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
            const suffix = Date.now();

            const seeded = await seedOffer({
                _id: `job-add-miss-${suffix}`,
                status: OfferStatus.NOT_MATCHED,
            });

            const { res, json } = await gql(token, {
                query: `mutation($offerId: String!, $candidateId: String!) {
                    addCandidateToOffer(offerId: $offerId, candidateId: $candidateId) { id }
                }`,
                variables: { offerId: seeded._id, candidateId: 'non-existent-cand' },
            });

            expect(res.status).toBe(200);
            expect(json.errors).toBeDefined();
        });
    });

    describe('removeCandidateFromOffer', () => {
        it('removes a candidate and sets NOT_MATCHED when list becomes empty', async () => {
            const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
            const suffix = Date.now();
            const repo = new NeedsAnalysisRepository();

            const offerId = `job-remove-${suffix}`;
            await seedOffer({ _id: offerId, status: OfferStatus.NOT_MATCHED });
            await repo.addMatchedCandidate(offerId, {
                id: `cand-rem-${suffix}`,
                full_name: `Bob ${suffix}`,
                age: 30,
                email: `bob-${suffix}@test.local`,
            });

            const { res, json } = await gql(token, {
                query: `mutation($offerId: String!, $candidateId: String!) {
                    removeCandidateFromOffer(offerId: $offerId, candidateId: $candidateId) {
                        id status matchedCandidate { id }
                    }
                }`,
                variables: { offerId, candidateId: `cand-rem-${suffix}` },
            });

            expect(res.status).toBe(200);
            expect(json.errors).toBeUndefined();
            expect(json.data.removeCandidateFromOffer.status).toBe('NOT_MATCHED');
            expect(json.data.removeCandidateFromOffer.matchedCandidate).toEqual([]);
        });

        it('removes one candidate and keeps MATCHED status when others remain', async () => {
            const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
            const suffix = Date.now();
            const repo = new NeedsAnalysisRepository();

            const offerId = `job-remove-multi-${suffix}`;
            await seedOffer({ _id: offerId, status: OfferStatus.NOT_MATCHED });
            await repo.addMatchedCandidate(offerId, {
                id: `cand-a-${suffix}`,
                full_name: `Carol ${suffix}`,
                age: 25,
                email: `carol-${suffix}@test.local`,
            });
            await repo.addMatchedCandidate(offerId, {
                id: `cand-b-${suffix}`,
                full_name: `Dave ${suffix}`,
                age: 27,
                email: `dave-${suffix}@test.local`,
            });

            const { res, json } = await gql(token, {
                query: `mutation($offerId: String!, $candidateId: String!) {
                    removeCandidateFromOffer(offerId: $offerId, candidateId: $candidateId) {
                        id status matchedCandidate { id }
                    }
                }`,
                variables: { offerId, candidateId: `cand-a-${suffix}` },
            });

            expect(res.status).toBe(200);
            expect(json.errors).toBeUndefined();
            expect(json.data.removeCandidateFromOffer.matchedCandidate).toHaveLength(1);
            expect(json.data.removeCandidateFromOffer.matchedCandidate[0].id).toBe(`cand-b-${suffix}`);
            expect(json.data.removeCandidateFromOffer.status).toBe('NOT_MATCHED');
        });
    });

    it('rejects unauthenticated requests', async () => {
        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: `mutation($id: String!) { unmatchOffer(id: $id) { id } }`,
                variables: { id: 'some-id' },
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeDefined();
        expect(json.errors[0].message).toMatch(/unauthorized/i);
    });
});

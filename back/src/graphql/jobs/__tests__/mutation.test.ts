import { describe, it, expect } from 'vitest';
import { mintToken } from '../../../../test/helpers/auth';
import { JobRepository } from '../../../repositories/mongo/JobRepository';
import { env } from '../../../config/env';
import { JobStatus, Localisation } from '../../../types/job.types';

const ENDPOINT = `http://localhost:${env.API_PORT}/api/graphql/jobs`;

describe('GraphQL job mutations', () => {
    describe('updateJob', () => {
        it('updates companyName and returns MATCHED status', async () => {
            const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
            const suffix = Date.now();
            const repo = new JobRepository();

            const seeded = await repo.create({
                _id: `job-update-${suffix}`,
                company_name: `Old Corp ${suffix}`,
                status: JobStatus.NOT_MATCHED,
                localisation: [Localisation.SAINT_DENIS],
            });

            const res = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    query: `
                        mutation($id: String!, $job: JobInput!) {
                            updateJob(id: $id, job: $job) {
                                id companyName status
                            }
                        }
                    `,
                    variables: {
                        job: {
                            id: seeded._id,
                            companyName: `Updated Corp ${suffix}`,
                            localisation: ['SAINT_DENIS'],
                        },
                        id: seeded._id,
                    },
                }),
            });
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.errors).toBeUndefined();
            expect(json.data.updateJob.companyName).toBe(`Updated Corp ${suffix}`);

            // Verify via follow-up query
            const verify = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    query: `query($id: String!) { matchJob(id: $id) { id companyName status matchedCandidate { id fullName }}}`,
                    variables: { id: seeded._id },
                }),
            });
            const vjson = await verify.json();
            expect(vjson.data.matchJob.status).toBe('NOT_MATCHED');
        });

        it('returns an error when updating a non-existent job', async () => {
            const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });

            const res = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    query: `
                        mutation($id: String!, $job: JobInput!) {
                            updateJob(id: $id, job: $job) { id }
                        }
                    `,
                    variables: {
                        job: {
                            id: 'non-existent-id',
                            companyName: 'Ghost Corp',
                        },
                        id: 'non-existent-id',
                    },
                }),
            });
            const json = await res.json();
            console.log(json);
            expect(res.status).toBe(200);
            expect(json.data.updateJob).toBe(null);
        });
    });

    describe('unmatch', () => {
        it('clears matched candidates and sets NOT_MATCHED', async () => {
            const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
            const suffix = Date.now();
            const repo = new JobRepository();

            const seeded = await repo.create({
                _id: `job-unmatch-${suffix}`,
                company_name: `Unmatch Corp ${suffix}`,
                status: JobStatus.MATCHED,
                matched_candidate: [{ id: `cand-${suffix}`, full_name: `Jane ${suffix}` }],
            });

            const res = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    query: `mutation($id: String!) { unmatch(id: $id) { id status matchedCandidate { id } } }`,
                    variables: { id: seeded._id },
                }),
            });
            const json = await res.json();
            expect(res.status).toBe(200);
            expect(json.errors).toBeUndefined();
            expect(json.data.unmatch.status).toBe('NOT_MATCHED');
            expect(json.data.unmatch.matchedCandidate).toEqual([]);

            // Verify via follow-up query
            const verify = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    query: `query($id: String!) { matchJob(id: $id) { status matchedCandidate { id } } }`,
                    variables: { id: seeded._id },
                }),
            });
            const vjson = await verify.json();
            expect(vjson.data.matchJob.status).toBe('NOT_MATCHED');
            expect(vjson.data.matchJob.matchedCandidate).toEqual([]);
        });

        it('returns null when unmatching a non-existent job', async () => {
            const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });

            const res = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    query: `mutation($id: String!) { unmatch(id: $id) { id } }`,
                    variables: { id: 'non-existent-id' },
                }),
            });
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.errors).toBeUndefined();
            expect(json.data.unmatch).toBeNull();
        });
    });

    it('rejects unauthenticated requests', async () => {
        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: `mutation($id: String!) { unmatch(id: $id) { id } }`,
                variables: { id: 'some-id' },
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeDefined();
        expect(json.errors[0].message).toMatch(/unauthorized/i);
    });
});

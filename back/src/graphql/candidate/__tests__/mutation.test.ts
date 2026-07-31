import { describe, it, expect } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { CandidateRepository } from '../../../repositories/mongo/CandidateRepository';
import { env } from '../../../config/env';
import { CandidateStatus, TitleProfessionalType } from '../../../types/candidate.types';

const ENDPOINT = `http://localhost:${env.API_PORT}/api/graphql/candidates`;

describe('GraphQL candidate mutations', () => {
    describe('createCandidate', () => {
        it('creates a candidate with minimal required fields', async () => {
            const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'RH', permission: 'ADMIN' });
            const suffix = Date.now();

            const res = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: auth.cookieHeader,
                    'x-csrf-token': auth.csrfHeader,
                },
                body: JSON.stringify({
                    query: `
                        mutation($input: CreateCandidateInput!) {
                            createCandidate(input: $input) {
                                id status tpType identity { fullName email phone }
                            }
                        }
                    `,
                    variables: {
                        input: {
                            status: CandidateStatus.SEEKING,
                            tpType: 'AD',
                            identity: {
                                fullName: `Alice ${suffix}`,
                                email: `alice-${suffix}@test.local`,
                                phone: '0100000001',
                            },
                        },
                    },
                }),
            });
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.errors).toBeUndefined();
            expect(json.data.createCandidate.id).toBeTypeOf('string');
            expect(json.data.createCandidate.status).toBe('SEEKING');
            expect(json.data.createCandidate.tpType).toBe('AD');
            expect(json.data.createCandidate.identity.fullName).toBe(`Alice ${suffix}`);
            expect(json.data.createCandidate.identity.email).toBe(`alice-${suffix}@test.local`);
        });

        it('creates a candidate with all optional nested fields', async () => {
            const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'RH', permission: 'ADMIN' });
            const suffix = Date.now();

            const res = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: auth.cookieHeader,
                    'x-csrf-token': auth.csrfHeader,
                },
                body: JSON.stringify({
                    query: `
                        mutation($input: CreateCandidateInput!) {
                            createCandidate(input: $input) {
                                id
                                status
                                tpType
                                identity { fullName email phone city }
                                education { schoolLevel justification }
                                desiredSectors
                                profile { frenchLevel englishLevel readyForChallenges }
                            }
                        }
                    `,
                    variables: {
                        input: {
                            status: CandidateStatus.SEEKING,
                            tpType: 'AD',
                            identity: {
                                fullName: `Bob ${suffix}`,
                                email: `bob-${suffix}@test.local`,
                                phone: '0100000002',
                                city: 'Saint Denis',
                            },
                            education: {
                                schoolLevel: 'BAC',
                                justification: 'Baccalaureat scientifique',
                            },
                            desiredSectors: ['RESTAURATION', 'COMMERCIAL'],
                            profile: {
                                frenchLevel: 7,
                                englishLevel: 4,
                                readyForChallenges: true,
                            },
                        },
                    },
                }),
            });
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.errors).toBeUndefined();
            const c = json.data.createCandidate;
            expect(c.identity.city).toBe('Saint Denis');
            expect(c.education.schoolLevel).toBe('BAC');
            expect(c.education.justification).toBe('Baccalaureat scientifique');
            expect(c.desiredSectors).toEqual(['RESTAURATION', 'COMMERCIAL']);
            expect(c.profile.frenchLevel).toBe(7);
            expect(c.profile.englishLevel).toBe(4);
            expect(c.profile.readyForChallenges).toBe(true);
        });

        it('applies template defaults for skills_assessment when not provided', async () => {
            const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'RH', permission: 'ADMIN' });
            const suffix = Date.now();

            const res = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: auth.cookieHeader,
                    'x-csrf-token': auth.csrfHeader,
                },
                body: JSON.stringify({
                    query: `
                        mutation($input: CreateCandidateInput!) {
                            createCandidate(input: $input) {
                                id skillsAssessment { competence level }
                            }
                        }
                    `,
                    variables: {
                        input: {
                            status: CandidateStatus.SEEKING,
                            tpType: 'AD',
                            identity: {
                                fullName: `Carol ${suffix}`,
                                email: `carol-${suffix}@test.local`,
                                phone: '0100000003',
                            },
                        },
                    },
                }),
            });
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.errors).toBeUndefined();
            expect(json.data.createCandidate.skillsAssessment.length).toBeGreaterThan(0);
        });
    });

    describe('updateCandidate', () => {
        it('updates the status field and returns camelCase result', async () => {
            const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'RH', permission: 'ADMIN' });
            const suffix = Date.now();
            const repo = new CandidateRepository();

            const seeded = await repo.create({
                _id: `update-status-${suffix}`,
                candidate_id: `update-status-${suffix}`,
                tp_type: TitleProfessionalType.AD,
                status: CandidateStatus.SEEKING,
                identity: { full_name: `Dave ${suffix}`, email: `dave-${suffix}@test.local`, phone: '0100000004' },
            });

            const res = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: auth.cookieHeader,
                    'x-csrf-token': auth.csrfHeader,
                },
                body: JSON.stringify({
                    query: `
                        mutation($id: String!, $input: UpdateCandidateInput!) {
                            updateCandidate(id: $id, input: $input) {
                                id status tpType identity { fullName }
                            }
                        }
                    `,
                    variables: {
                        id: seeded._id,
                        input: { status: 'CONTRACT' },
                    },
                }),
            });
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.errors).toBeUndefined();
            expect(json.data.updateCandidate.status).toBe('CONTRACT');

            // Verify via a follow-up query
            const verify = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: auth.cookieHeader,
                    'x-csrf-token': auth.csrfHeader,
                },
                body: JSON.stringify({
                    query: `query($id: String!) { candidate(id: $id) { status } }`,
                    variables: { id: seeded._id },
                }),
            });
            const vjson = await verify.json();
            expect(vjson.data.candidate.status).toBe('CONTRACT');
        });

        it('stores immersion start/end dates when moving to IMMERSING', async () => {
            const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'RH', permission: 'ADMIN' });
            const suffix = Date.now();
            const repo = new CandidateRepository();

            const seeded = await repo.create({
                _id: `update-imm-${suffix}`,
                candidate_id: `update-imm-${suffix}`,
                tp_type: TitleProfessionalType.AD,
                status: CandidateStatus.SEEKING,
                identity: { full_name: `Imm ${suffix}`, email: `imm-${suffix}@test.local`, phone: '0100000009' },
            });

            const res = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: auth.cookieHeader,
                    'x-csrf-token': auth.csrfHeader,
                },
                body: JSON.stringify({
                    query: `mutation($id: String!, $input: UpdateCandidateInput!) {
                        updateCandidate(id: $id, input: $input) { id status immersionStartDate immersionEndDate }
                    }`,
                    variables: {
                        id: seeded._id,
                        input: {
                            status: 'IMMERSING',
                            immersionStartDate: '2026-09-01',
                            immersionEndDate: '2026-09-15',
                        },
                    },
                }),
            });
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.errors).toBeUndefined();
            expect(json.data.updateCandidate.status).toBe('IMMERSING');
            expect(json.data.updateCandidate.immersionStartDate).toContain('2026-09-01');
            expect(json.data.updateCandidate.immersionEndDate).toContain('2026-09-15');
        });

        it('stores contract offer/company/start date when moving to CONTRACT', async () => {
            const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'RH', permission: 'ADMIN' });
            const suffix = Date.now();
            const repo = new CandidateRepository();

            const seeded = await repo.create({
                _id: `update-contract-${suffix}`,
                candidate_id: `update-contract-${suffix}`,
                tp_type: TitleProfessionalType.AD,
                status: CandidateStatus.SEEKING,
                identity: { full_name: `Erin ${suffix}`, email: `erin-${suffix}@test.local`, phone: '0100000010' },
            });

            const res = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: auth.cookieHeader,
                    'x-csrf-token': auth.csrfHeader,
                },
                body: JSON.stringify({
                    query: `mutation($id: String!, $input: UpdateCandidateInput!) {
                        updateCandidate(id: $id, input: $input) {
                            id status contractOfferId contractCompanyId contractCompanyName contractStartDate
                        }
                    }`,
                    variables: {
                        id: seeded._id,
                        input: {
                            status: 'CONTRACT',
                            contractOfferId: `offer-${suffix}`,
                            contractCompanyId: 42,
                            contractCompanyName: `Entreprise ${suffix}`,
                            contractStartDate: '2026-10-01',
                        },
                    },
                }),
            });
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.errors).toBeUndefined();
            expect(json.data.updateCandidate.status).toBe('CONTRACT');
            expect(json.data.updateCandidate.contractOfferId).toBe(`offer-${suffix}`);
            expect(json.data.updateCandidate.contractCompanyId).toBe(42);
            expect(json.data.updateCandidate.contractCompanyName).toBe(`Entreprise ${suffix}`);
            expect(json.data.updateCandidate.contractStartDate).toContain('2026-10-01');

            // Verify persisted via a follow-up query
            const verify = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: auth.cookieHeader,
                    'x-csrf-token': auth.csrfHeader,
                },
                body: JSON.stringify({
                    query: `query($id: String!) { candidate(id: $id) { contractCompanyName contractStartDate } }`,
                    variables: { id: seeded._id },
                }),
            });
            const vjson = await verify.json();
            expect(vjson.data.candidate.contractCompanyName).toBe(`Entreprise ${suffix}`);
            expect(vjson.data.candidate.contractStartDate).toContain('2026-10-01');
        });

        it('updates nested identity fields', async () => {
            const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'RH', permission: 'ADMIN' });
            const suffix = Date.now();
            const repo = new CandidateRepository();

            const seeded = await repo.create({
                _id: `update-nested-${suffix}`,
                candidate_id: `update-nested-${suffix}`,
                tp_type: TitleProfessionalType.AD,
                status: CandidateStatus.SEEKING,
                identity: { full_name: `Eve ${suffix}`, email: `eve-${suffix}@test.local`, phone: '0100000005' },
            });

            const res = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: auth.cookieHeader,
                    'x-csrf-token': auth.csrfHeader,
                },
                body: JSON.stringify({
                    query: `
                        mutation($id: String!, $input: UpdateCandidateInput!) {
                            updateCandidate(id: $id, input: $input) {
                                id identity { fullName city transportMeans }
                            }
                        }
                    `,
                    variables: {
                        id: seeded._id,
                        input: {
                            identity: {
                                fullName: `Eve Updated ${suffix}`,
                                email: `eve-${suffix}@test.local`,
                                phone: '0100000005',
                                city: 'Saint Paul',
                                transportMeans: 'Car',
                            },
                        },
                    },
                }),
            });
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.errors).toBeUndefined();
            expect(json.data.updateCandidate.identity.fullName).toBe(`Eve Updated ${suffix}`);
            expect(json.data.updateCandidate.identity.city).toBe('Saint Paul');
            expect(json.data.updateCandidate.identity.transportMeans).toBe('Car');
        });

        it('returns an error when updating a non-existent candidate', async () => {
            const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'RH', permission: 'ADMIN' });

            const res = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: auth.cookieHeader,
                    'x-csrf-token': auth.csrfHeader,
                },
                body: JSON.stringify({
                    query: `
                        mutation($id: String!, $input: UpdateCandidateInput!) {
                            updateCandidate(id: $id, input: $input) { id }
                        }
                    `,
                    variables: {
                        id: 'does-not-exist',
                        input: { status: 'CONTRACT' },
                    },
                }),
            });
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.errors).toBeDefined();
            expect(json.errors[0].message).toMatch(/not found/i);
        });
    });

    describe('deleteCandidate', () => {
        it('deletes an existing candidate and returns true', async () => {
            const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'RH', permission: 'ADMIN' });
            const suffix = Date.now();
            const repo = new CandidateRepository();

            const seeded = await repo.create({
                _id: `delete-existing-${suffix}`,
                candidate_id: `delete-existing-${suffix}`,
                tp_type: TitleProfessionalType.AD,
                status: CandidateStatus.SEEKING,
                identity: { full_name: `Frank ${suffix}`, email: `frank-${suffix}@test.local`, phone: '0100000006' },
            });

            const res = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: auth.cookieHeader,
                    'x-csrf-token': auth.csrfHeader,
                },
                body: JSON.stringify({
                    query: `mutation($id: String!) { deleteCandidate(id: $id) }`,
                    variables: { id: seeded._id },
                }),
            });
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.errors).toBeUndefined();
            expect(json.data.deleteCandidate).toBe(true);

            // Verify the candidate is gone
            const verify = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: auth.cookieHeader,
                    'x-csrf-token': auth.csrfHeader,
                },
                body: JSON.stringify({
                    query: `query($id: String!) { candidate(id: $id) { id } }`,
                    variables: { id: seeded._id },
                }),
            });
            const vjson = await verify.json();
            expect(vjson.data.candidate).toBeNull();
        });

        it('returns false when deleting a non-existent candidate', async () => {
            const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'RH', permission: 'ADMIN' });

            const res = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: auth.cookieHeader,
                    'x-csrf-token': auth.csrfHeader,
                },
                body: JSON.stringify({
                    query: `mutation($id: String!) { deleteCandidate(id: $id) }`,
                    variables: { id: 'non-existent-id-for-delete' },
                }),
            });
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.errors).toBeUndefined();
            expect(json.data.deleteCandidate).toBe(false);
        });
    });
});

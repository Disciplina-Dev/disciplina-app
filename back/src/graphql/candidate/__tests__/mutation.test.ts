import { describe, it, expect } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { CandidateRepository } from '../../../repositories/mongo/CandidateRepository';
import { OfferRepository } from '../../../repositories/mongo/OfferRepository';
import { seedOffer } from '../../../../test/helpers/seedOffer';
import { env } from '../../../config/env';
import { OfferStatus } from '../../../types/matching.types';
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
                                id status tpTypes identity { fullName email phone }
                            }
                        }
                    `,
                    variables: {
                        input: {
                            status: CandidateStatus.SEEKING,
                            tpTypes: ['AD'],
                            identity: {
                                fullName: `Alice ${suffix}`,
                                email: `alice-${suffix}@test.local`,
                                phone: '0100000001',
                            },
                            consentments: {
                                dataProcessing: true,
                                dataSharing: false,
                                aiProcessing: false,
                                photoProcessing: false,
                                consentDate: new Date().toISOString(),
                                consentVersion: 'test-v1',
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
            expect(json.data.createCandidate.tpTypes).toEqual(['AD']);
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
                                tpTypes
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
                            tpTypes: ['AD'],
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
                            consentments: {
                                dataProcessing: true,
                                dataSharing: false,
                                aiProcessing: false,
                                photoProcessing: false,
                                consentDate: new Date().toISOString(),
                                consentVersion: 'test-v1',
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
                            tpTypes: ['AD'],
                            identity: {
                                fullName: `Carol ${suffix}`,
                                email: `carol-${suffix}@test.local`,
                                phone: '0100000003',
                            },
                            consentments: {
                                dataProcessing: true,
                                dataSharing: false,
                                aiProcessing: false,
                                photoProcessing: false,
                                consentDate: new Date().toISOString(),
                                consentVersion: 'test-v1',
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

    // Le validator d'unicité email (`identitySchema.path('email').validate`, candidate.schema.ts)
    // a deux branches selon le contexte `this` : Query (via findOneAndUpdate, couvert par les
    // tests updateCandidate ci-dessous) et Document (via .save(), déclenché par
    // CandidateRepository.create). Le resolver createCandidate bloque déjà les doublons en amont
    // et n'atteint donc jamais la branche Document — on appelle le repository directement pour
    // l'exercer, comme le ferait un futur appelant (script d'import, endpoint direct).
    describe('CandidateRepository.create — email uniqueness validator (branche document/.save())', () => {
        it('rejects creating a candidate whose email is already used by another candidate', async () => {
            const suffix = Date.now();
            const repo = new CandidateRepository();

            const existing = await repo.create({
                _id: `save-validator-existing-${suffix}`,
                candidate_id: `save-validator-existing-${suffix}`,
                tp_types: [TitleProfessionalType.AD],
                status: CandidateStatus.SEEKING,
                identity: {
                    full_name: `Karim ${suffix}`,
                    email: `karim-${suffix}@test.local`,
                    phone: '0100000020',
                },
            });

            await expect(
                repo.create({
                    _id: `save-validator-dup-${suffix}`,
                    candidate_id: `save-validator-dup-${suffix}`,
                    tp_types: [TitleProfessionalType.AD],
                    status: CandidateStatus.SEEKING,
                    identity: {
                        full_name: `Karim Bis ${suffix}`,
                        email: existing.identity.email,
                        phone: '0100000021',
                    },
                }),
            ).rejects.toThrow(/existe déjà/i);
        });

        it('allows creating a candidate with a unique email', async () => {
            const suffix = Date.now();
            const repo = new CandidateRepository();

            const created = await repo.create({
                _id: `save-validator-unique-${suffix}`,
                candidate_id: `save-validator-unique-${suffix}`,
                tp_types: [TitleProfessionalType.AD],
                status: CandidateStatus.SEEKING,
                identity: {
                    full_name: `Lina ${suffix}`,
                    email: `lina-${suffix}@test.local`,
                    phone: '0100000022',
                },
            });

            expect(created._id).toBe(`save-validator-unique-${suffix}`);
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
                tp_types: [TitleProfessionalType.AD],
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
                                id status tpTypes identity { fullName }
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
                tp_types: [TitleProfessionalType.AD],
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
                tp_types: [TitleProfessionalType.AD],
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

        it('syncs linked offer status to CONTRACT when moving to CONTRACT', async () => {
            const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'RH', permission: 'ADMIN' });
            const suffix = Date.now();
            const repo = new CandidateRepository();
            const offerRepo = new OfferRepository();

            const candidateId = `update-contract-sync-${suffix}`;
            const seeded = await repo.create({
                _id: candidateId,
                candidate_id: candidateId,
                tp_types: [TitleProfessionalType.AD],
                status: CandidateStatus.SEEKING,
                identity: {
                    full_name: `Fiona ${suffix}`,
                    email: `fiona-${suffix}@test.local`,
                    phone: '0100000011',
                },
            });

            const offerId = `offer-contract-sync-${suffix}`;
            await seedOffer({ _id: offerId, status: OfferStatus.MATCHED });
            await offerRepo.addMatchedCandidate(offerId, {
                id: candidateId,
                full_name: `Fiona ${suffix}`,
                age: 25,
                email: `fiona-${suffix}@test.local`,
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
                        updateCandidate(id: $id, input: $input) { id status }
                    }`,
                    variables: {
                        id: seeded._id,
                        input: { status: 'CONTRACT', contractOfferId: offerId },
                    },
                }),
            });
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.errors).toBeUndefined();
            expect(json.data.updateCandidate.status).toBe('CONTRACT');

            const offer = await offerRepo.findById(offerId);
            expect(offer?.matching?.status).toBe(OfferStatus.CONTRACT);
        });

        it('does not sync linked offer status when moving to a non-contract status', async () => {
            const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'RH', permission: 'ADMIN' });
            const suffix = Date.now();
            const repo = new CandidateRepository();
            const offerRepo = new OfferRepository();

            const candidateId = `update-not-contract-${suffix}`;
            const seeded = await repo.create({
                _id: candidateId,
                candidate_id: candidateId,
                tp_types: [TitleProfessionalType.AD],
                status: CandidateStatus.SEEKING,
                identity: {
                    full_name: `George ${suffix}`,
                    email: `george-${suffix}@test.local`,
                    phone: '0100000012',
                },
            });

            const offerId = `offer-not-contract-${suffix}`;
            await seedOffer({ _id: offerId, status: OfferStatus.MATCHED });
            await offerRepo.addMatchedCandidate(offerId, {
                id: candidateId,
                full_name: `George ${suffix}`,
                age: 25,
                email: `george-${suffix}@test.local`,
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
                        updateCandidate(id: $id, input: $input) { id status }
                    }`,
                    variables: {
                        id: seeded._id,
                        input: { status: 'IMMERSING' },
                    },
                }),
            });
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.errors).toBeUndefined();
            expect(json.data.updateCandidate.status).toBe('IMMERSING');

            const offer = await offerRepo.findById(offerId);
            expect(offer?.matching?.status).toBe(OfferStatus.MATCHED);
        });

        it('updates nested identity fields', async () => {
            const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'RH', permission: 'ADMIN' });
            const suffix = Date.now();
            const repo = new CandidateRepository();

            const seeded = await repo.create({
                _id: `update-nested-${suffix}`,
                candidate_id: `update-nested-${suffix}`,
                tp_types: [TitleProfessionalType.AD],
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

        it('rejects update when the new email is already used by another candidate', async () => {
            const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'RH', permission: 'ADMIN' });
            const suffix = Date.now();
            const repo = new CandidateRepository();

            const taken = await repo.create({
                _id: `update-email-taken-${suffix}`,
                candidate_id: `update-email-taken-${suffix}`,
                tp_types: [TitleProfessionalType.AD],
                status: CandidateStatus.SEEKING,
                identity: { full_name: `Holly ${suffix}`, email: `holly-${suffix}@test.local`, phone: '0100000013' },
            });
            const seeded = await repo.create({
                _id: `update-email-mover-${suffix}`,
                candidate_id: `update-email-mover-${suffix}`,
                tp_types: [TitleProfessionalType.AD],
                status: CandidateStatus.SEEKING,
                identity: { full_name: `Ivan ${suffix}`, email: `ivan-${suffix}@test.local`, phone: '0100000014' },
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
                            updateCandidate(id: $id, input: $input) { id }
                        }
                    `,
                    variables: {
                        id: seeded._id,
                        input: {
                            identity: { fullName: `Ivan ${suffix}`, email: taken.identity.email, phone: '0100000014' },
                        },
                    },
                }),
            });
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.errors).toBeDefined();
            expect(json.errors[0].message).toMatch(/existe déjà/i);
        });

        it('allows updating a candidate while keeping its own email unchanged', async () => {
            const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'RH', permission: 'ADMIN' });
            const suffix = Date.now();
            const repo = new CandidateRepository();

            const seeded = await repo.create({
                _id: `update-email-self-${suffix}`,
                candidate_id: `update-email-self-${suffix}`,
                tp_types: [TitleProfessionalType.AD],
                status: CandidateStatus.SEEKING,
                identity: { full_name: `Jane ${suffix}`, email: `jane-${suffix}@test.local`, phone: '0100000015' },
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
                            updateCandidate(id: $id, input: $input) { id identity { city } }
                        }
                    `,
                    variables: {
                        id: seeded._id,
                        input: {
                            identity: {
                                fullName: `Jane ${suffix}`,
                                email: seeded.identity.email,
                                phone: '0100000015',
                                city: 'Saint Denis',
                            },
                        },
                    },
                }),
            });
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.errors).toBeUndefined();
            expect(json.data.updateCandidate.identity.city).toBe('Saint Denis');
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
                tp_types: [TitleProfessionalType.AD],
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

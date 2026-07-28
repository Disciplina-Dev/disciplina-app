import { describe, it, expect } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { OfferRepository } from '../../../repositories/mongo/OfferRepository';
import { seedOffer } from '../../../../test/helpers/seedOffer';
import { CandidateRepository } from '../../../repositories/mongo/CandidateRepository';
import { env } from '../../../config/env';
import { OfferStatus, DesiredSex, Localisation, Sector } from '../../../types/matching.types';
import { CandidateStatus, TitleProfessionalType } from '../../../types/candidate.types';
const ENDPOINT = `http://localhost:${env.API_PORT}/api/graphql/offers`;

describe('GraphQL job queries', () => {
    it('returns an empty list when no jobs exist', async () => {
        const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'RH', permission: 'ADMIN' });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: auth.cookieHeader,
                'x-csrf-token': auth.csrfHeader,
            },
            body: JSON.stringify({ query: '{ offers { id } }' }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.offers).toEqual([]);
    });

    it('returns all seeded jobs with camelCase fields', async () => {
        const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'RH', permission: 'ADMIN' });
        const suffix = Date.now();

        const j1 = await seedOffer({
            _id: `job-list-${suffix}-1`,
            company_name: `Alpha Corp ${suffix}`,
            age_range: '25-35',
            desired_tp: 'AD',
            desired_sex: DesiredSex.MIXTE,
            driving_license_b: true,
            professional_experience: false,
            status: OfferStatus.NOT_MATCHED,
            localisation: [Localisation.SAINT_DENIS],
        });
        const j2 = await seedOffer({
            _id: `job-list-${suffix}-2`,
            company_name: `Beta Corp ${suffix}`,
            age_range: '18-25',
            desired_tp: 'CC',
            desired_sex: DesiredSex.FILLE,
            driving_license_b: false,
            professional_experience: true,
            status: OfferStatus.MATCHED,
            localisation: [Localisation.SAINT_PAUL, Localisation.LE_PORT],
        });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: auth.cookieHeader,
                'x-csrf-token': auth.csrfHeader,
            },
            body: JSON.stringify({
                query: `{ offers { id companyName ageRange desiredTp { tpType } desiredSex drivingLicencseB professionalExperience status localisation } }`,
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.offers).toHaveLength(2);

        const first = json.data.offers.find((j: any) => j.id === j1._id);
        expect(first.companyName).toBe(`Alpha Corp ${suffix}`);
        expect(first.ageRange).toBe('25-35');
        expect(first.desiredTp[0].tpType).toBe('AD');
        expect(first.desiredSex).toBe('MIXTE');
        expect(first.drivingLicencseB).toBe(true);
        expect(first.professionalExperience).toBe(false);
        expect(first.status).toBe('NOT_MATCHED');
        expect(first.localisation).toEqual(['SAINT_DENIS']);

        const second = json.data.offers.find((j: any) => j.id === j2._id);
        expect(second.companyName).toBe(`Beta Corp ${suffix}`);
        expect(second.ageRange).toBe('18-25');
        expect(second.desiredTp[0].tpType).toBe('CC');
        expect(second.desiredSex).toBe('FILLE');
        expect(second.drivingLicencseB).toBe(false);
        expect(second.professionalExperience).toBe(true);
        expect(second.status).toBe('MATCHED');
        expect(second.localisation).toEqual(['SAINT_PAUL', 'LE_PORT']);
    });

    it('returns a job by id', async () => {
        const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'RH', permission: 'ADMIN' });
        const suffix = Date.now();

        const seeded = await seedOffer({
            _id: `job-find-${suffix}`,
            company_name: `Target Corp ${suffix}`,
            age_range: '30-40',
            desired_tp: 'NTC',
            status: OfferStatus.NOT_MATCHED,
        });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: auth.cookieHeader,
                'x-csrf-token': auth.csrfHeader,
            },
            body: JSON.stringify({
                query: `query($id: String!) { matchOffer(id: $id) { id companyName ageRange desiredTp { tpType } status } }`,
                variables: { id: seeded._id },
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.matchOffer.id).toBe(seeded._id);
        expect(json.data.matchOffer.companyName).toBe(`Target Corp ${suffix}`);
        expect(json.data.matchOffer.desiredTp[0].tpType).toBe('NTC');
    });

    it('returns a job with matched candidates', async () => {
        const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'RH', permission: 'ADMIN' });
        const suffix = Date.now();
        const candidateRepo = new CandidateRepository();

        const offerId = `job-match-${suffix}`;
        await seedOffer({
            _id: offerId,
            company_name: `Matching Corp ${suffix}`,
            desired_tp: 'AD',
            driving_license_b: true,
            desired_sex: DesiredSex.MIXTE,
            age_range: '20-40',
            status: OfferStatus.NOT_MATCHED,
            localisation: [Localisation.ENTRE_DEUX],
            sector: Sector.RESTAURATION,
        });

        const candidateId = `cand-${suffix}`;
        await candidateRepo.create({
            _id: candidateId,
            candidate_id: candidateId,
            tp_type: TitleProfessionalType.AD,
            status: CandidateStatus.SEEKING,
            identity: {
                full_name: `Jane ${suffix}`,
                email: `jane-${suffix}@test.local`,
                phone: '0600000000',
                age: 28,
                driving_license_b: true,
            },
            desired_sectors: ['RESTAURATION'],
            job_info: {
                geographic_mobility: [Localisation.ENTRE_DEUX],
            },
        });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: auth.cookieHeader,
                'x-csrf-token': auth.csrfHeader,
            },
            body: JSON.stringify({
                query: `query($id: String!) { matchOffer(id: $id) { id companyName suggestedCandidates { id fullName age } } }`,
                variables: { id: offerId },
            }),
        });
        const json = await res.json();
        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.matchOffer.id).toBe(offerId);
        expect(json.data.matchOffer.suggestedCandidates.length).toBeGreaterThanOrEqual(1);
        expect(json.data.matchOffer.suggestedCandidates[0].fullName).toBe(`Jane ${suffix}`);
    });

    it('errors when job not found', async () => {
        const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'RH', permission: 'ADMIN' });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: auth.cookieHeader,
                'x-csrf-token': auth.csrfHeader,
            },
            body: JSON.stringify({
                query: `query($id: String!) { matchOffer(id: $id) { id } }`,
                variables: { id: 'non-existent-id' },
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeDefined();
    });

    it('rejects unauthenticated requests', async () => {
        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: '{ offers { id } }' }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeDefined();
        expect(json.errors[0].message).toMatch(/unauthorized/i);
    });

    describe('candidateMatchedOfferIds', () => {
        it('returns job ids where the candidate is in matched_candidate', async () => {
            const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'RH', permission: 'ADMIN' });
            const suffix = Date.now();

            const offerId = `job-mids-${suffix}`;
            const candidateId = `cand-mids-${suffix}`;

            await seedOffer({ _id: offerId, status: OfferStatus.NOT_MATCHED });
            await new OfferRepository().addMatchedCandidate(offerId, {
                id: candidateId,
                full_name: `Eve ${suffix}`,
                age: 24,
                email: `eve-${suffix}@test.local`,
            });

            const res = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: auth.cookieHeader,
                    'x-csrf-token': auth.csrfHeader,
                },
                body: JSON.stringify({
                    query: `query($candidateId: String!) { candidateMatchedOfferIds(candidateId: $candidateId) }`,
                    variables: { candidateId },
                }),
            });
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.errors).toBeUndefined();
            expect(json.data.candidateMatchedOfferIds).toContain(offerId);
        });

        it('returns an empty array when candidate has no matched jobs', async () => {
            const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'RH', permission: 'ADMIN' });

            const res = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: auth.cookieHeader,
                    'x-csrf-token': auth.csrfHeader,
                },
                body: JSON.stringify({
                    query: `query($candidateId: String!) { candidateMatchedOfferIds(candidateId: $candidateId) }`,
                    variables: { candidateId: 'no-match-candidate' },
                }),
            });
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.errors).toBeUndefined();
            expect(json.data.candidateMatchedOfferIds).toEqual([]);
        });
    });
});

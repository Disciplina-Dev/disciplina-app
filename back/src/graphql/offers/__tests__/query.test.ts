import { describe, it, expect } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { OfferRepository } from '../../../repositories/mongo/OfferRepository';
import { seedOffer } from '../../../../test/helpers/seedOffer';
import { CandidateRepository } from '../../../repositories/mongo/CandidateRepository';
import { env } from '../../../config/env';
import { OfferStatus, DesiredSex, Localisation, Sector } from '../../../types/matching.types';
import { CandidateStatus, TitleProfessionalType } from '../../../types/candidate.types';
import { OfferModel } from '../../../db/mongo/schemas/offer.schema';
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
            tp_types: [TitleProfessionalType.AD],
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

    it('relaxes the activity-sector matching criterion when only custom sectors are set', async () => {
        const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'RH', permission: 'ADMIN' });
        const suffix = Date.now();
        const candidateRepo = new CandidateRepository();

        // L'offre ne porte que des secteurs libres (saisis à la main dans l'AB),
        // inconnus du référentiel des candidats : aucun candidat ne pourra matcher
        // `desired_sectors`. Le critère de secteur doit alors être relâché.
        const offerId = `job-custom-sector-${suffix}`;
        await seedOffer({
            _id: offerId,
            company_name: `Custom Sector Corp ${suffix}`,
            desired_tp: 'AD',
            status: OfferStatus.NOT_MATCHED,
            activities: ['Avocats', 'Cabinets de conseil'],
        });

        const candidateId = `cand-custom-sector-${suffix}`;
        await candidateRepo.create({
            _id: candidateId,
            candidate_id: candidateId,
            tp_types: [TitleProfessionalType.AD],
            status: CandidateStatus.SEEKING,
            identity: {
                full_name: `Claire ${suffix}`,
                email: `claire-${suffix}@test.local`,
                phone: '0600000000',
                age: 30,
            },
            desired_sectors: ['BTP'],
            job_info: {},
        });

        const query = `query($id: String!) { matchOffer(id: $id) { id relaxedCriteria suggestedCandidates { id } } }`;

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: auth.cookieHeader,
                'x-csrf-token': auth.csrfHeader,
            },
            body: JSON.stringify({
                query,
                variables: { id: offerId },
            }),
        });
        const json = await res.json();
        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.matchOffer.suggestedCandidates.some((c: { id: string }) => c.id === candidateId)).toBe(true);
        expect(json.data.matchOffer.relaxedCriteria).toEqual(['sector']);
    });

    it('relaxes the activity-sector matching criterion when the flagged sectors yield no candidate', async () => {
        const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'RH', permission: 'ADMIN' });
        const suffix = Date.now();
        const candidateRepo = new CandidateRepository();

        // Même comportement pour des secteurs référencés pour lesquels aucune fiche
        // candidat n'existe actuellement : la liste ne doit pas être vide à cause du secteur.
        const offerId = `job-flagged-sector-${suffix}`;
        await seedOffer({
            _id: offerId,
            company_name: `Flagged Sector Corp ${suffix}`,
            desired_tp: 'AD',
            status: OfferStatus.NOT_MATCHED,
            activities: ['BOULANGERIE'],
        });

        const candidateId = `cand-flagged-sector-${suffix}`;
        await candidateRepo.create({
            _id: candidateId,
            candidate_id: candidateId,
            tp_types: [TitleProfessionalType.AD],
            status: CandidateStatus.SEEKING,
            identity: {
                full_name: `Marc ${suffix}`,
                email: `marc-${suffix}@test.local`,
                phone: '0600000000',
                age: 32,
            },
            desired_sectors: ['RESTAURATION'],
            job_info: {},
        });

        const query = `query($id: String!) { matchOffer(id: $id) { id relaxedCriteria suggestedCandidates { id } } }`;
        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: auth.cookieHeader,
                'x-csrf-token': auth.csrfHeader,
            },
            body: JSON.stringify({
                query,
                variables: { id: offerId },
            }),
        });
        const json = await res.json();
        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.matchOffer.suggestedCandidates.some((c: { id: string }) => c.id === candidateId)).toBe(true);
        expect(json.data.matchOffer.relaxedCriteria).toEqual(['sector']);
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

    describe('schedule backward compatibility', () => {
        const scheduleSelection = `schedule { day startHour endHour }`;

        async function queryOffer(query: string, variables: Record<string, unknown>, auth: ReturnType<typeof mintAuthCookies>) {
            const res = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: auth.cookieHeader,
                    'x-csrf-token': auth.csrfHeader,
                },
                body: JSON.stringify({ query, variables }),
            });
            return { status: res.status, json: await res.json() };
        }

        it('returns an empty schedule when the offer has no schedule field', async () => {
            const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'RH', permission: 'ADMIN' });
            const suffix = Date.now();
            const seeded = await seedOffer({ _id: `job-no-sched-${suffix}`, company_name: `No Sched Corp ${suffix}` });

            const { status, json } = await queryOffer(
                `query($id: String!) { matchOffer(id: $id) { id ${scheduleSelection} } }`,
                { id: seeded._id },
                auth,
            );

            expect(status).toBe(200);
            expect(json.errors).toBeUndefined();
            expect(json.data.matchOffer.id).toBe(seeded._id);
            expect(json.data.matchOffer.schedule).toEqual([]);
        });

        it('preserves legacy string[] schedule_options as ScheduleSlot objects', async () => {
            const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'RH', permission: 'ADMIN' });
            const suffix = Date.now();
            const offerId = `job-legacy-sched-${suffix}`;

            // Insertion brute (hors Mongoose) : simule une offre créée avant le passage
            // aux créneaux structurés, dont `criteria.schedule_options` est un `string[]`.
            await OfferModel.collection.insertOne({
                _id: offerId,
                needs_analysis_id: `ab-legacy-${suffix}`,
                company_infos: { name: `Legacy Corp ${suffix}` },
                localisation: [],
                desired_tp: [],
                criteria: {
                    age_min: null,
                    age_max: null,
                    driving_license: false,
                    experience_required: false,
                    desired_sex: null,
                    schedule_options: ['Lundi : 8h-12h', 'Vendredi : toute la journée'],
                },
                matching: { status: 'NOT_MATCHED', candidates: [], interview_slots: [] },
            });

            const { status, json } = await queryOffer(
                `query($id: String!) { matchOffer(id: $id) { id ${scheduleSelection} } }`,
                { id: offerId },
                auth,
            );

            expect(status).toBe(200);
            expect(json.errors).toBeUndefined();
            expect(json.data.matchOffer.schedule).toEqual([
                { day: null, startHour: 'Lundi : 8h-12h', endHour: null },
                { day: null, startHour: 'Vendredi : toute la journée', endHour: null },
            ]);
        });

        it('maps structured schedule_options slots to camelCase ScheduleSlot objects', async () => {
            const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'RH', permission: 'ADMIN' });
            const suffix = Date.now();
            await seedOffer({
                _id: `job-structured-sched-${suffix}`,
                company_name: `Structured Corp ${suffix}`,
                criteria: {
                    schedule_options: [
                        { day: 'LUNDI', start_hour: '08:00', end_hour: '12:00' },
                        { day: 'MERCREDI', start_hour: '14:00', end_hour: '17:00' },
                    ],
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
                    query: `{ offers { id ${scheduleSelection} } }`,
                }),
            });
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.errors).toBeUndefined();
            expect(json.data.offers).toHaveLength(1);
            expect(json.data.offers[0].schedule).toEqual([
                { day: 'LUNDI', startHour: '08:00', endHour: '12:00' },
                { day: 'MERCREDI', startHour: '14:00', endHour: '17:00' },
            ]);
        });
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

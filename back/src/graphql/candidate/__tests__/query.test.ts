import { describe, it, expect } from 'vitest';
import { mintToken } from '../../../../test/helpers/auth';
import { CandidateRepository } from '../../../repositories/mongo/CandidateRepository';
import { NeedsAnalysisRepository } from '../../../repositories/mongo/NeedsAnalysisRepository';
import { seedOffer } from '../../../../test/helpers/seedOffer';
import { env } from '../../../config/env';
import { CandidateStatus, TitleProfessionalType, TrainingSite } from '../../../types/candidate.types';
import { OfferStatus, DesiredSex, Localisation, Sector } from '../../../types/matching.types';

const ENDPOINT = `http://localhost:${env.API_PORT}/api/graphql/candidates`;

describe('GraphQL candidate queries', () => {
    it('returns an empty list when no candidates exist', async () => {
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ query: '{ candidates { id status tpType } }' }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.candidates).toEqual([]);
    });

    it('returns all seeded candidates with camelCase fields', async () => {
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
        const suffix = Date.now();
        const repo = new CandidateRepository();

        const c1 = await repo.create({
            _id: `id-${suffix}-1`,
            candidate_id: `id-${suffix}-1`,
            tp_type: TitleProfessionalType.AD,
            status: CandidateStatus.SEEKING,
            identity: { full_name: `Alice ${suffix}`, email: `alice-${suffix}@test.local`, phone: '0100000001' },
        });
        const c2 = await repo.create({
            _id: `id-${suffix}-2`,
            candidate_id: `id-${suffix}-2`,
            tp_type: TitleProfessionalType.CC,
            status: CandidateStatus.CONTRACT,
            identity: { full_name: `Bob ${suffix}`, email: `bob-${suffix}@test.local`, phone: '0100000002' },
        });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                query: `{ candidates { id status tpType identity { fullName email } } }`,
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.candidates).toHaveLength(2);
        expect(json.data.candidates[0].id).toBe(c1._id);
        expect(json.data.candidates[0].identity.fullName).toBe(`Alice ${suffix}`);
        expect(json.data.candidates[0].tpType).toBe('AD');
        expect(json.data.candidates[1].id).toBe(c2._id);
        expect(json.data.candidates[1].identity.fullName).toBe(`Bob ${suffix}`);
        expect(json.data.candidates[1].tpType).toBe('CC');
    });

    it('paginates candidates with cursors via candidatesPage', async () => {
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
        const suffix = `page-${Date.now()}`;
        const repo = new CandidateRepository();

        const ids = [`${suffix}-1`, `${suffix}-2`, `${suffix}-3`];
        await Promise.all(
            ids.map((id) =>
                repo.create({
                    _id: id,
                    candidate_id: id,
                    tp_type: TitleProfessionalType.AD,
                    status: CandidateStatus.SEEKING,
                    identity: { full_name: `Candidate ${id}`, email: `${id}@test.local`, phone: '0100000000' },
                }),
            ),
        );

        const query = `query($first: Int, $after: String) {
            candidatesPage(first: $first, after: $after) {
                edges { cursor node { id } }
                pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
            }
        }`;

        const firstPageRes = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ query, variables: { first: 2 } }),
        });
        const firstPage = (await firstPageRes.json()).data.candidatesPage;

        expect(firstPage.edges).toHaveLength(2);
        expect(firstPage.pageInfo.hasNextPage).toBe(true);

        const secondPageRes = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ query, variables: { first: 2, after: firstPage.pageInfo.endCursor } }),
        });
        const secondPage = (await secondPageRes.json()).data.candidatesPage;

        const seenIds = [...firstPage.edges, ...secondPage.edges].map((e: any) => e.node.id);
        expect(seenIds).toEqual(expect.arrayContaining(ids));
    });

    it('returns a candidate by id with camelCase fields', async () => {
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
        const suffix = Date.now();
        const repo = new CandidateRepository();

        const seeded = await repo.create({
            _id: `find-by-id-${suffix}`,
            candidate_id: `find-by-id-${suffix}`,
            tp_type: TitleProfessionalType.AD,
            status: CandidateStatus.SEEKING,
            identity: { full_name: `Target ${suffix}`, email: `target-${suffix}@test.local`, phone: '0600000000' },
            desired_sectors: ['RESTAURATION', 'COMMERCIAL'],
        });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                query: `query($id: String!) { candidate(id: $id) { id status tpType identity { fullName email } desiredSectors } }`,
                variables: { id: seeded._id },
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.candidate.id).toBe(seeded._id);
        expect(json.data.candidate.identity.email).toBe(`target-${suffix}@test.local`);
        expect(json.data.candidate.desiredSectors).toEqual(['RESTAURATION', 'COMMERCIAL']);
    });

    it('returns null for a non-existent candidate id', async () => {
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                query: `query($id: String!) { candidate(id: $id) { id } }`,
                variables: { id: 'non-existent-id' },
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.candidate).toBeNull();
    });

    it('returns a candidate template for a given tpType', async () => {
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                query: `query($tpType: TitleProfessionalType!) { candidateTemplate(tpType: $tpType) { tpType hasEnglishLevel availableSectors defaultSkillsAssessment { competence level } } }`,
                variables: { tpType: 'AD' },
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.candidateTemplate.tpType).toBe('AD');
        expect(json.data.candidateTemplate.hasEnglishLevel).toBeTypeOf('boolean');
        expect(Array.isArray(json.data.candidateTemplate.availableSectors)).toBe(true);
        expect(Array.isArray(json.data.candidateTemplate.defaultSkillsAssessment)).toBe(true);
    });

    it('rejects unauthenticated requests', async () => {
        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: '{ candidates { id } }' }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeDefined();
        expect(json.errors[0].message).toMatch(/unauthorized/i);
    });
});

describe('candidateStats', () => {
    it('returns total and breakdowns by status, tpType, and trainingSite', async () => {
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
        const suffix = `stats-${Date.now()}`;
        const repo = new CandidateRepository();

        await repo.create({
            _id: `${suffix}-1`,
            candidate_id: `${suffix}-1`,
            tp_type: TitleProfessionalType.REM,
            status: CandidateStatus.SEEKING,
            training_site: TrainingSite.SUD_SAINT_PIERRE,
            identity: { full_name: `Stats A ${suffix}`, email: `sa-${suffix}@test.local`, phone: '0600000000' },
        });
        await repo.create({
            _id: `${suffix}-2`,
            candidate_id: `${suffix}-2`,
            tp_type: TitleProfessionalType.REM,
            status: CandidateStatus.CONTRACT,
            training_site: TrainingSite.SUD_SAINT_PIERRE,
            identity: { full_name: `Stats B ${suffix}`, email: `sb-${suffix}@test.local`, phone: '0600000001' },
        });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                query: `{ candidateStats { total byStatus { key count } byTpType { key count } byTrainingSite { key count } byTpAndStatus { tpType status count } } }`,
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        const s = json.data.candidateStats;
        expect(s.total).toBeGreaterThanOrEqual(2);
        expect(s.byStatus.find((b: any) => b.key === 'SEEKING')?.count).toBeGreaterThanOrEqual(1);
        expect(s.byStatus.find((b: any) => b.key === 'CONTRACT')?.count).toBeGreaterThanOrEqual(1);
        expect(s.byTpType.find((b: any) => b.key === 'REM')?.count).toBeGreaterThanOrEqual(2);
        expect(s.byTrainingSite.find((b: any) => b.key === 'SUD_SAINT_PIERRE')?.count).toBeGreaterThanOrEqual(2);
        const tpStatus = s.byTpAndStatus.find((b: any) => b.tpType === 'REM' && b.status === 'SEEKING');
        expect(tpStatus?.count).toBeGreaterThanOrEqual(1);
    });
});

describe('matchCandidate', () => {
    it('returns matched jobs for a compatible candidate', async () => {
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
        const suffix = `mc-${Date.now()}`;
        const candidateRepo = new CandidateRepository();

        const candidateId = `cand-mc-${suffix}`;
        await candidateRepo.create({
            _id: candidateId,
            candidate_id: candidateId,
            tp_type: TitleProfessionalType.NTC,
            status: CandidateStatus.SEEKING,
            identity: {
                full_name: `Match Me ${suffix}`,
                email: `matchme-${suffix}@test.local`,
                phone: '0600000000',
                age: 28,
                driving_license_b: true,
                sex: DesiredSex.MIXTE,
            },
            desired_sectors: [Sector.STATION],
            job_info: { geographic_mobility: [Localisation.SAINT_BENOIT] },
        });

        const offerId = `job-mc-${suffix}`;
        await seedOffer({
            _id: offerId,
            company_name: `Match Corp ${suffix}`,
            desired_tp: TitleProfessionalType.NTC,
            driving_license_b: true,
            desired_sex: DesiredSex.MIXTE,
            age_range: '20-40',
            localisation: [Localisation.SAINT_BENOIT],
            sector: Sector.STATION,
            status: OfferStatus.NOT_MATCHED,
        });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                query: `query($id: String!) { matchCandidate(id: $id) { id matchedOffers { id companyName } } }`,
                variables: { id: candidateId },
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.matchCandidate.id).toBe(candidateId);
        expect(json.data.matchCandidate.matchedOffers).toContainEqual(
            expect.objectContaining({ id: offerId, companyName: `Match Corp ${suffix}` }),
        );
    });

    it('errors when candidate is not found', async () => {
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                query: `query($id: String!) { matchCandidate(id: $id) { id } }`,
                variables: { id: 'ghost-candidate-id' },
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeDefined();
        expect(json.errors[0].message).toMatch(/not found/i);
    });
});

describe('UNAVAILABLE availability transition', () => {
    it('reverts an UNAVAILABLE candidate to SEEKING once the availability date has passed', async () => {
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
        const suffix = `unavail-${Date.now()}`;
        const repo = new CandidateRepository();

        const candidateId = `cand-${suffix}`;
        await repo.create({
            _id: candidateId,
            candidate_id: candidateId,
            tp_type: TitleProfessionalType.AD,
            status: CandidateStatus.UNAVAILABLE,
            identity: { full_name: `Unavail ${suffix}`, email: `${suffix}@test.local`, phone: '0600000000' },
            job_info: { availability_date: new Date('2020-01-01') },
        });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                query: `query($id: String!) { candidate(id: $id) { id status } }`,
                variables: { id: candidateId },
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.candidate.status).toBe('SEEKING');

        const persisted = await repo.findById(candidateId);
        expect(persisted?.status).toBe(CandidateStatus.SEEKING);
    });

    it('keeps an UNAVAILABLE candidate unavailable while the availability date is still in the future', async () => {
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
        const suffix = `stillunavail-${Date.now()}`;
        const repo = new CandidateRepository();

        const candidateId = `cand-${suffix}`;
        const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await repo.create({
            _id: candidateId,
            candidate_id: candidateId,
            tp_type: TitleProfessionalType.AD,
            status: CandidateStatus.UNAVAILABLE,
            identity: { full_name: `Still ${suffix}`, email: `${suffix}@test.local`, phone: '0600000001' },
            job_info: { availability_date: future },
        });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                query: `query($id: String!) { candidate(id: $id) { id status } }`,
                variables: { id: candidateId },
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.data.candidate.status).toBe('UNAVAILABLE');
    });
});

describe('candidatesPage with filters', () => {
    it('filters by tpType', async () => {
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
        const suffix = `flt-tp-${Date.now()}`;
        const repo = new CandidateRepository();

        await repo.create({
            _id: `${suffix}-rem-1`,
            candidate_id: `${suffix}-rem-1`,
            tp_type: TitleProfessionalType.SA,
            status: CandidateStatus.SEEKING,
            identity: { full_name: `FLT-TP-${suffix} A`, email: `ftp-a-${suffix}@test.local`, phone: '0600000000' },
        });
        await repo.create({
            _id: `${suffix}-rem-2`,
            candidate_id: `${suffix}-rem-2`,
            tp_type: TitleProfessionalType.SA,
            status: CandidateStatus.SEEKING,
            identity: { full_name: `FLT-TP-${suffix} B`, email: `ftp-b-${suffix}@test.local`, phone: '0600000001' },
        });
        await repo.create({
            _id: `${suffix}-other`,
            candidate_id: `${suffix}-other`,
            tp_type: TitleProfessionalType.NTC,
            status: CandidateStatus.SEEKING,
            identity: { full_name: `FLT-TP-${suffix} C`, email: `ftp-c-${suffix}@test.local`, phone: '0600000002' },
        });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                query: `query($search: String!, $filters: CandidateFiltersInput) {
                    candidatesPage(first: 10, search: $search, filters: $filters) {
                        edges { node { id tpType } }
                    }
                }`,
                variables: { search: `FLT-TP-${suffix}`, filters: { tpType: 'SA' } },
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        const nodes = json.data.candidatesPage.edges.map((e: any) => e.node);
        expect(nodes).toHaveLength(2);
        expect(nodes.every((n: any) => n.tpType === 'SA')).toBe(true);
        expect(nodes.map((n: any) => n.id)).toContain(`${suffix}-rem-1`);
        expect(nodes.map((n: any) => n.id)).toContain(`${suffix}-rem-2`);
    });

    it('filters by status', async () => {
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
        const suffix = `flt-st-${Date.now()}`;
        const repo = new CandidateRepository();

        await repo.create({
            _id: `${suffix}-seeking`,
            candidate_id: `${suffix}-seeking`,
            tp_type: TitleProfessionalType.AD,
            status: CandidateStatus.SEEKING,
            identity: { full_name: `FLT-ST-${suffix} SEEK`, email: `fst-s-${suffix}@test.local`, phone: '0600000000' },
        });
        await repo.create({
            _id: `${suffix}-matched`,
            candidate_id: `${suffix}-matched`,
            tp_type: TitleProfessionalType.AD,
            status: CandidateStatus.CONTRACT,
            identity: { full_name: `FLT-ST-${suffix} MATCH`, email: `fst-m-${suffix}@test.local`, phone: '0600000001' },
        });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                query: `query($search: String!, $filters: CandidateFiltersInput) {
                    candidatesPage(first: 10, search: $search, filters: $filters) {
                        edges { node { id status } }
                    }
                }`,
                variables: { search: `FLT-ST-${suffix}`, filters: { status: 'SEEKING' } },
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        const nodes = json.data.candidatesPage.edges.map((e: any) => e.node);
        expect(nodes).toHaveLength(1);
        expect(nodes[0].id).toBe(`${suffix}-seeking`);
        expect(nodes[0].status).toBe('SEEKING');
    });

    it('filters by drivingLicenseB', async () => {
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
        const suffix = `flt-dl-${Date.now()}`;
        const repo = new CandidateRepository();

        await repo.create({
            _id: `${suffix}-with`,
            candidate_id: `${suffix}-with`,
            tp_type: TitleProfessionalType.CC,
            status: CandidateStatus.SEEKING,
            identity: {
                full_name: `FLT-DL-${suffix} YES`,
                email: `fdl-y-${suffix}@test.local`,
                phone: '0600000000',
                driving_license_b: true,
            },
        });
        await repo.create({
            _id: `${suffix}-without`,
            candidate_id: `${suffix}-without`,
            tp_type: TitleProfessionalType.CC,
            status: CandidateStatus.SEEKING,
            identity: {
                full_name: `FLT-DL-${suffix} NO`,
                email: `fdl-n-${suffix}@test.local`,
                phone: '0600000001',
                driving_license_b: false,
            },
        });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                query: `query($search: String!, $filters: CandidateFiltersInput) {
                    candidatesPage(first: 10, search: $search, filters: $filters) {
                        edges { node { id identity { drivingLicenseB } } }
                    }
                }`,
                variables: { search: `FLT-DL-${suffix}`, filters: { drivingLicenseB: true } },
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        const nodes = json.data.candidatesPage.edges.map((e: any) => e.node);
        expect(nodes).toHaveLength(1);
        expect(nodes[0].id).toBe(`${suffix}-with`);
        expect(nodes[0].identity.drivingLicenseB).toBe(true);
    });

    it('filters by geographicMobility (OR sur les villes souhaitées)', async () => {
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
        const suffix = `flt-gm-${Date.now()}`;
        const repo = new CandidateRepository();

        await repo.create({
            _id: `${suffix}-paul`,
            candidate_id: `${suffix}-paul`,
            tp_type: TitleProfessionalType.CC,
            status: CandidateStatus.SEEKING,
            identity: { full_name: `FLT-GM-${suffix} PAUL`, email: `fgm-p-${suffix}@test.local`, phone: '0600000000' },
            job_info: { geographic_mobility: ['SAINT_PAUL', 'LE_PORT'] },
        } as any);
        await repo.create({
            _id: `${suffix}-denis`,
            candidate_id: `${suffix}-denis`,
            tp_type: TitleProfessionalType.CC,
            status: CandidateStatus.SEEKING,
            identity: { full_name: `FLT-GM-${suffix} DENIS`, email: `fgm-d-${suffix}@test.local`, phone: '0600000001' },
            job_info: { geographic_mobility: ['SAINT_DENIS'] },
        } as any);

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                query: `query($search: String!, $filters: CandidateFiltersInput) {
                    candidatesPage(first: 10, search: $search, filters: $filters) {
                        edges { node { id } }
                    }
                }`,
                variables: { search: `FLT-GM-${suffix}`, filters: { geographicMobility: ['SAINT_PAUL'] } },
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        const nodes = json.data.candidatesPage.edges.map((e: any) => e.node);
        expect(nodes).toHaveLength(1);
        expect(nodes[0].id).toBe(`${suffix}-paul`);
    });

    it('filters by desiredSectors (OR sur les secteurs souhaités)', async () => {
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
        const suffix = `flt-ds-${Date.now()}`;
        const repo = new CandidateRepository();

        await repo.create({
            _id: `${suffix}-boul`,
            candidate_id: `${suffix}-boul`,
            tp_type: TitleProfessionalType.CC,
            status: CandidateStatus.SEEKING,
            identity: { full_name: `FLT-DS-${suffix} BOUL`, email: `fds-b-${suffix}@test.local`, phone: '0600000000' },
            desired_sectors: ['Boulangerie', 'Restauration'],
        } as any);
        await repo.create({
            _id: `${suffix}-auto`,
            candidate_id: `${suffix}-auto`,
            tp_type: TitleProfessionalType.CC,
            status: CandidateStatus.SEEKING,
            identity: { full_name: `FLT-DS-${suffix} AUTO`, email: `fds-a-${suffix}@test.local`, phone: '0600000001' },
            desired_sectors: ['Automobile'],
        } as any);

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                query: `query($search: String!, $filters: CandidateFiltersInput) {
                    candidatesPage(first: 10, search: $search, filters: $filters) {
                        edges { node { id } }
                    }
                }`,
                variables: { search: `FLT-DS-${suffix}`, filters: { desiredSectors: ['Boulangerie'] } },
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        const nodes = json.data.candidatesPage.edges.map((e: any) => e.node);
        expect(nodes).toHaveLength(1);
        expect(nodes[0].id).toBe(`${suffix}-boul`);
    });
});

import { describe, it, expect } from 'vitest';
import { mintToken } from '../../../../test/helpers/auth';
import { JobRepository } from '../../../repositories/mongo/JobRepository';
import { CandidateRepository } from '../../../repositories/mongo/CandidateRepository';
import { env } from '../../../config/env';
import { JobStatus, DesiredSex, Localisation, Sector } from '../../../types/job.types';
import { CandidateStatus, TitleProfessionalType } from '../../../types/candidate.types';
const ENDPOINT = `http://localhost:${env.API_PORT}/api/graphql/jobs`;

describe('GraphQL job queries', () => {
    it('returns an empty list when no jobs exist', async () => {
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ query: '{ jobs { id } }' }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.jobs).toEqual([]);
    });

    it('returns all seeded jobs with camelCase fields', async () => {
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
        const suffix = Date.now();
        const repo = new JobRepository();

        const j1 = await repo.create({
            _id: `job-list-${suffix}-1`,
            company_name: `Alpha Corp ${suffix}`,
            age_range: '25-35',
            desired_tp: 'AD',
            desired_sex: DesiredSex.MIXTE,
            driving_license_b: true,
            professional_experience: false,
            status: JobStatus.NOT_MATCHED,
            localisation: [Localisation.SAINT_DENIS],
        });
        const j2 = await repo.create({
            _id: `job-list-${suffix}-2`,
            company_name: `Beta Corp ${suffix}`,
            age_range: '18-25',
            desired_tp: 'CC',
            desired_sex: DesiredSex.FILLE,
            driving_license_b: false,
            professional_experience: true,
            status: JobStatus.MATCHED,
            localisation: [Localisation.SAINT_PAUL, Localisation.LE_PORT],
        });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                query: `{ jobs { id companyName ageRange desiredTP desiredSex drivingLicencseB professionalExperience status localisation } }`,
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.jobs).toHaveLength(2);

        const first = json.data.jobs.find((j: any) => j.id === j1._id);
        expect(first.companyName).toBe(`Alpha Corp ${suffix}`);
        expect(first.ageRange).toBe('25-35');
        expect(first.desiredTP).toBe('AD');
        expect(first.desiredSex).toBe('MIXTE');
        expect(first.drivingLicencseB).toBe(true);
        expect(first.professionalExperience).toBe(false);
        expect(first.status).toBe('NOT_MATCHED');
        expect(first.localisation).toEqual(['SAINT_DENIS']);

        const second = json.data.jobs.find((j: any) => j.id === j2._id);
        expect(second.companyName).toBe(`Beta Corp ${suffix}`);
        expect(second.ageRange).toBe('18-25');
        expect(second.desiredTP).toBe('CC');
        expect(second.desiredSex).toBe('FILLE');
        expect(second.drivingLicencseB).toBe(false);
        expect(second.professionalExperience).toBe(true);
        expect(second.status).toBe('MATCHED');
        expect(second.localisation).toEqual(['SAINT_PAUL', 'LE_PORT']);
    });

    it('returns a job by id', async () => {
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
        const suffix = Date.now();
        const repo = new JobRepository();

        const seeded = await repo.create({
            _id: `job-find-${suffix}`,
            company_name: `Target Corp ${suffix}`,
            age_range: '30-40',
            desired_tp: 'NTC',
            status: JobStatus.NOT_MATCHED,
        });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                query: `query($id: String!) { matchJob(id: $id) { id companyName ageRange desiredTP status } }`,
                variables: { id: seeded._id },
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.matchJob.id).toBe(seeded._id);
        expect(json.data.matchJob.companyName).toBe(`Target Corp ${suffix}`);
        expect(json.data.matchJob.desiredTP).toBe('NTC');
    });

    it('returns a job with matched candidates', async () => {
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
        const suffix = Date.now();
        const jobRepo = new JobRepository();
        const candidateRepo = new CandidateRepository();

        const jobId = `job-match-${suffix}`;
        await jobRepo.create({
            _id: jobId,
            company_name: `Matching Corp ${suffix}`,
            desired_tp: 'AD',
            driving_license_b: true,
            desired_sex: DesiredSex.MIXTE,
            age_range: '20-40',
            status: JobStatus.NOT_MATCHED,
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
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                query: `query($id: String!) { matchJob(id: $id) { id companyName matchedCandidate { id fullName age } } }`,
                variables: { id: jobId },
            }),
        });
        const json = await res.json();
        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.matchJob.id).toBe(jobId);
        expect(json.data.matchJob.matchedCandidate.length).toBeGreaterThanOrEqual(1);
        expect(json.data.matchJob.matchedCandidate[0].fullName).toBe(`Jane ${suffix}`);
    });

    it('errors when job not found', async () => {
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                query: `query($id: String!) { matchJob(id: $id) { id } }`,
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
            body: JSON.stringify({ query: '{ jobs { id } }' }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeDefined();
        expect(json.errors[0].message).toMatch(/unauthorized/i);
    });
});

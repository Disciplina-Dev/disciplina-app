import { describe, it, expect } from 'vitest';
import { mintToken } from '../../../../test/helpers/auth';
import { CandidateRepository } from '../../../repositories/mongo/CandidateRepository';
import { env } from '../../../config/env';
import { CandidateStatus, TitleProfessionalType } from '../../../types/candidate.types';

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
            status: CandidateStatus.MATCHED,
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

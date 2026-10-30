import { describe, it, expect } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { seedOffer } from '../../../../test/helpers/seedOffer';
import { env } from '../../../config/env';
import { CandidateRepository } from '../../../repositories/mongo/CandidateRepository';
import { CandidateStatus, TitleProfessionalType } from '../../../types/candidate.types';

const ENDPOINT = `http://localhost:${env.API_PORT}/api/graphql/peda`;

const QUERY = `query($candidateId: ID!) {
    candidateEmployer(candidateId: $candidateId) { name siret address startDate sessionId }
}`;

function gql(role: 'PEDA' | 'RH', variables: object, permission: 'EMPLOYEE' | 'GUEST' = 'EMPLOYEE') {
    const auth = mintAuthCookies({ id: 1, email: 'peda@test.local', role, permission });
    return fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cookieHeader, 'x-csrf-token': auth.csrfHeader },
        body: JSON.stringify({ query: QUERY, variables }),
    }).then((res) => res.json());
}

async function seedCandidate(extra: Record<string, unknown>): Promise<string> {
    const id = `cand-employer-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    await new CandidateRepository().create({
        _id: id,
        candidate_id: id,
        tp_types: [TitleProfessionalType.AD],
        identity: { full_name: 'Test Employer', email: `${id}@test.local`, phone: '0600000000', age: 25 },
        status: CandidateStatus.CONTRACT,
        ...extra,
    } as never);
    return id;
}

describe('GraphQL peda candidateEmployer', () => {
    it('returns the company of a candidate in contract through the offer', async () => {
        const offerId = `offer-employer-${Date.now()}`;
        await seedOffer({ _id: offerId, company_name: 'Acme Employer' });
        const id = await seedCandidate({
            contract_offer_id: offerId,
            contract_company_name: 'Acme Employer',
            contract_start_date: new Date('2026-09-01'),
            contract_session_id: 'sess-1',
        });

        const json = await gql('PEDA', { candidateId: id });

        expect(json.errors).toBeUndefined();
        expect(json.data.candidateEmployer.name).toBe('Acme Employer');
        expect(json.data.candidateEmployer.startDate).toMatch(/^2026-09-01/);
        expect(json.data.candidateEmployer.sessionId).toBe('sess-1');
    });

    it('returns null when the candidate is not in contract', async () => {
        const id = await seedCandidate({
            status: CandidateStatus.SEEKING,
            contract_company_name: 'Residual Corp',
        });

        const json = await gql('PEDA', { candidateId: id });

        expect(json.errors).toBeUndefined();
        expect(json.data.candidateEmployer).toBeNull();
    });

    it('returns null when the contract has no company ("Non renseigné")', async () => {
        const id = await seedCandidate({ contract_company_name: 'Non renseigné' });

        const json = await gql('PEDA', { candidateId: id });

        expect(json.data.candidateEmployer).toBeNull();
    });

    it('rejects non-PEDA roles', async () => {
        const id = await seedCandidate({ contract_company_name: 'Acme' });

        const json = await gql('RH', { candidateId: id }, 'GUEST');

        expect(json.errors).toBeDefined();
    });
});

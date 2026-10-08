import { describe, it, expect } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { env } from '../../../config/env';

const GRAPHQL_ENDPOINT = `http://localhost:${env.API_PORT}/api/graphql/peda`;
const REST_BASE = `http://localhost:${env.API_PORT}/api/peda`;

function pedaAuth() {
    return mintAuthCookies({ id: 1, email: 'peda-pdf@test.local', role: 'PEDA', permission: 'EMPLOYEE' });
}

function gqlFetch(auth: { cookieHeader: string; csrfHeader: string }, query: string, variables?: unknown) {
    return fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cookieHeader, 'x-csrf-token': auth.csrfHeader },
        body: JSON.stringify({ query, variables }),
    }).then((res) => res.json());
}

describe('GET /api/peda/alternant-sequences/:id/pdf (#888)', () => {
    it('generates a real PDF for a SA document', async () => {
        const auth = pedaAuth();
        const suffix = Date.now();

        const created = (
            await gqlFetch(auth, `mutation($input: CreateAlternantInput!) { createAlternant(input: $input) { id } }`, {
                input: {
                    firstName: `Pdf-${suffix}`,
                    lastName: `Test-${suffix}`,
                    session: `PDF-${suffix}`,
                    company: { name: 'Acme SARL', startDate: '2026-09-01', endDate: '2027-06-30' },
                },
            })
        ).data.createAlternant;

        const seqs = (
            await gqlFetch(
                auth,
                `query($alternantId: ID!) { alternantSequences(alternantId: $alternantId) { id numero } }`,
                { alternantId: created.id },
            )
        ).data.alternantSequences as { id: string; numero: number }[];
        const seq = seqs.find((s) => s.numero === 1)!;

        const res = await fetch(`${REST_BASE}/alternant-sequences/${seq.id}/pdf`, {
            headers: { Cookie: auth.cookieHeader, 'x-csrf-token': auth.csrfHeader },
        });
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toContain('application/pdf');
        const buffer = Buffer.from(await res.arrayBuffer());
        expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    }, 20000);

    it('rejects an unknown sequence id', async () => {
        const auth = pedaAuth();
        const res = await fetch(`${REST_BASE}/alternant-sequences/does-not-exist/pdf`, {
            headers: { Cookie: auth.cookieHeader, 'x-csrf-token': auth.csrfHeader },
        });
        expect(res.status).toBeGreaterThanOrEqual(400);
    });
});

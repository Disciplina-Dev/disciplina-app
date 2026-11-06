import { describe, it, expect, beforeEach } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { NeedsAnalysisRepository } from '../../../repositories/mongo/NeedsAnalysisRepository';
import { CompanyRepository } from '../../../repositories/mysql/CompanyRepository';
import { NeedsAnalysis, NeedsAnalysisStatus } from '../../../types/needsAnalysisNoSql.types';
import { Localisation } from '../../../types/matching.types';
import { env } from '../../../config/env';

const ENDPOINT = `http://localhost:${env.API_PORT}/api/graphql/needs-analysis`;
const COMPANY_ID = 779;

const auth = mintAuthCookies({ id: 1, email: 'rh@test.local', role: 'RH', permission: 'EMPLOYEE' });

async function graphql(query: string, variables: Record<string, unknown>) {
    const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Cookie: auth.cookieHeader,
            'x-csrf-token': auth.csrfHeader,
        },
        body: JSON.stringify({ query, variables }),
    });
    const json = await res.json();
    expect(json.errors).toBeUndefined();
    return json.data;
}

async function graphqlRaw(query: string, variables: Record<string, unknown>) {
    const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Cookie: auth.cookieHeader,
            'x-csrf-token': auth.csrfHeader,
        },
        body: JSON.stringify({ query, variables }),
    });
    return res.json();
}

function needsAnalysis(id: string): NeedsAnalysis {
    return {
        _id: id,
        company_infos: { id: COMPANY_ID, name: `Company ${id}` },
        // Requis par la mise à jour générique (validateData) : sans commercial
        // porteur, updateNeedsAnalysis rejette la fiche.
        saler_info: { id: 1, email: 'rh@test.local' },
        status: NeedsAnalysisStatus.SIGNE,
        created_at: new Date(),
        positions: [{ title: 'Poste', localisation: [Localisation.SAINT_DENIS], desired_tp: [] }],
    };
}

async function fetchTracking(id: string) {
    const data = await graphql(
        `
            query ($id: ID!) {
                needsAnalysis(id: $id) {
                    id
                    franceTravail
                    koann
                    lastActiveAt
                }
            }
        `,
        { id },
    );
    return data.needsAnalysis;
}

describe('GraphQL company tracking refs + manual activation date (needsAnalysis)', () => {
    const repo = new NeedsAnalysisRepository();

    beforeEach(async () => {
        await repo.create(needsAnalysis('ab-tracking'));
    });

    it('defaults tracking refs to null and exposes them on queries', async () => {
        const fetched = await fetchTracking('ab-tracking');
        expect(fetched.franceTravail).toBeNull();
        expect(fetched.koann).toBeNull();

        const page = await graphql(
            `
                query ($first: Int) {
                    needsAnalysesPage(first: $first) {
                        edges {
                            node {
                                id
                                franceTravail
                                koann
                                lastActiveAt
                            }
                        }
                    }
                }
            `,
            { first: 50 },
        );
        const edges = page.needsAnalysesPage.edges as {
            node: { id: string; franceTravail: string | null; koann: string | null };
        }[];
        const edge = edges.find((e) => e.node.id === 'ab-tracking');
        expect(edge?.node.franceTravail).toBeNull();
        expect(edge?.node.koann).toBeNull();
    });

    it('sets France Travail / KOANN refs and clears them with an empty string', async () => {
        const updated = await graphql(
            `
                mutation ($id: ID!, $franceTravail: String, $koann: String) {
                    updateNeedsAnalysisTracking(id: $id, franceTravail: $franceTravail, koann: $koann) {
                        id
                        franceTravail
                        koann
                    }
                }
            `,
            { id: 'ab-tracking', franceTravail: 'FT-12345', koann: 'KOANN-abc' },
        );
        expect(updated.updateNeedsAnalysisTracking.franceTravail).toBe('FT-12345');
        expect(updated.updateNeedsAnalysisTracking.koann).toBe('KOANN-abc');

        const fetched = await fetchTracking('ab-tracking');
        expect(fetched.franceTravail).toBe('FT-12345');
        expect(fetched.koann).toBe('KOANN-abc');

        // Mise à jour partielle : le champ omis est conservé.
        const partial = await graphql(
            `
                mutation ($id: ID!, $koann: String) {
                    updateNeedsAnalysisTracking(id: $id, koann: $koann) {
                        id
                        franceTravail
                        koann
                    }
                }
            `,
            { id: 'ab-tracking', koann: 'KOANN-def' },
        );
        expect(partial.updateNeedsAnalysisTracking.franceTravail).toBe('FT-12345');
        expect(partial.updateNeedsAnalysisTracking.koann).toBe('KOANN-def');

        // Chaîne vide = efface (null).
        const cleared = await graphql(
            `
                mutation ($id: ID!, $franceTravail: String, $koann: String) {
                    updateNeedsAnalysisTracking(id: $id, franceTravail: $franceTravail, koann: $koann) {
                        id
                        franceTravail
                        koann
                    }
                }
            `,
            { id: 'ab-tracking', franceTravail: '   ', koann: '' },
        );
        expect(cleared.updateNeedsAnalysisTracking.franceTravail).toBeNull();
        expect(cleared.updateNeedsAnalysisTracking.koann).toBeNull();
    });

    it('sets the activation date manually and clears it with null', async () => {
        const target = new Date('2024-05-06T00:00:00.000Z').toISOString();
        const updated = await graphql(
            `
                mutation ($id: ID!, $lastActiveAt: String) {
                    updateNeedsAnalysisActivationDate(id: $id, lastActiveAt: $lastActiveAt) {
                        id
                        lastActiveAt
                    }
                }
            `,
            { id: 'ab-tracking', lastActiveAt: target },
        );
        expect(new Date(updated.updateNeedsAnalysisActivationDate.lastActiveAt).getTime()).toBe(
            new Date(target).getTime(),
        );

        const fetched = await fetchTracking('ab-tracking');
        expect(new Date(fetched.lastActiveAt).getTime()).toBe(new Date(target).getTime());

        const cleared = await graphql(
            `
                mutation ($id: ID!, $lastActiveAt: String) {
                    updateNeedsAnalysisActivationDate(id: $id, lastActiveAt: $lastActiveAt) {
                        id
                        lastActiveAt
                    }
                }
            `,
            { id: 'ab-tracking', lastActiveAt: null },
        );
        expect(cleared.updateNeedsAnalysisActivationDate.lastActiveAt).toBeNull();
    });

    it('rejects an invalid activation date and unknown analyses', async () => {
        const badDate = await graphqlRaw(
            `mutation($id: ID!, $lastActiveAt: String) {
                updateNeedsAnalysisActivationDate(id: $id, lastActiveAt: $lastActiveAt) { id }
            }`,
            { id: 'ab-tracking', lastActiveAt: 'not-a-date' },
        );
        expect(badDate.errors).toBeDefined();

        const missingTracking = await graphqlRaw(
            `mutation($id: ID!, $franceTravail: String) {
                updateNeedsAnalysisTracking(id: $id, franceTravail: $franceTravail) { id }
            }`,
            { id: 'ab-does-not-exist', franceTravail: 'x' },
        );
        expect(missingTracking.errors).toBeDefined();

        const missingDate = await graphqlRaw(
            `mutation($id: ID!, $lastActiveAt: String) {
                updateNeedsAnalysisActivationDate(id: $id, lastActiveAt: $lastActiveAt) { id }
            }`,
            { id: 'ab-does-not-exist', lastActiveAt: new Date().toISOString() },
        );
        expect(missingDate.errors).toBeDefined();
    });

    it('survives a generic updateNeedsAnalysis (no reset of tracking refs)', async () => {
        // La mise à jour générique exige une entreprise MySQL existante.
        const suffix = Date.now();
        const companyId = await new CompanyRepository().create({
            name: `Tracking Corp ${suffix}`,
            siret: `${suffix}0000000010`.slice(0, 14),
            address: 'X',
            sector: 'IT',
            conclusion: 'X',
        });
        const abId = `ab-tracking-update-${suffix}`;
        await repo.create({
            ...needsAnalysis(abId),
            company_infos: { id: companyId, name: `Tracking Corp ${suffix}` },
        });
        await graphql(
            `
                mutation ($id: ID!, $franceTravail: String, $koann: String) {
                    updateNeedsAnalysisTracking(id: $id, franceTravail: $franceTravail, koann: $koann) {
                        id
                    }
                }
            `,
            { id: abId, franceTravail: 'FT-keep', koann: 'KOANN-keep' },
        );
        await graphql(
            `
                mutation ($id: ID!, $input: NeedsAnalysisInput!) {
                    updateNeedsAnalysis(id: $id, input: $input) {
                        id
                    }
                }
            `,
            { id: abId, input: { companyDescription: 'Nouvelle description' } },
        );
        const fetched = await fetchTracking(abId);
        expect(fetched.franceTravail).toBe('FT-keep');
        expect(fetched.koann).toBe('KOANN-keep');
    });
});

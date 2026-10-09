import { describe, it, expect, beforeEach } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { NeedsAnalysisRepository } from '../../../repositories/mongo/NeedsAnalysisRepository';
import { CompanyRepository } from '../../../repositories/mysql/CompanyRepository';
import { NeedsAnalysis, NeedsAnalysisStatus } from '../../../types/needsAnalysisNoSql.types';
import { Localisation } from '../../../types/matching.types';
import { env } from '../../../config/env';

const ENDPOINT = `http://localhost:${env.API_PORT}/api/graphql/needs-analysis`;
const COMPANY_ID = 777;

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

async function setIndicator(id: string, indicator: string | null) {
    const data = await graphql(
        `
            mutation ($id: ID!, $indicator: CompanyIndicator) {
                updateNeedsAnalysisIndicator(id: $id, indicator: $indicator) {
                    id
                    companyIndicator
                }
            }
        `,
        { id, indicator },
    );
    return data.updateNeedsAnalysisIndicator;
}

async function fetchIndicator(id: string) {
    const data = await graphql(
        `
            query ($id: ID!) {
                needsAnalysis(id: $id) {
                    id
                    companyIndicator
                }
            }
        `,
        { id },
    );
    return data.needsAnalysis.companyIndicator;
}

describe('GraphQL company indicator (needsAnalysis)', () => {
    const repo = new NeedsAnalysisRepository();

    beforeEach(async () => {
        await repo.create(needsAnalysis('ab-indicator'));
    });

    it('defaults to null (automatic color) and is exposed on queries', async () => {
        await expect(fetchIndicator('ab-indicator')).resolves.toBeNull();

        const page = await graphql(
            `
                query ($first: Int) {
                    needsAnalysesPage(first: $first) {
                        edges {
                            node {
                                id
                                companyIndicator
                            }
                        }
                    }
                }
            `,
            { first: 50 },
        );
        const edges = page.needsAnalysesPage.edges as { node: { id: string; companyIndicator: string | null } }[];
        const edge = edges.find((e) => e.node.id === 'ab-indicator');
        expect(edge?.node.companyIndicator).toBeNull();
    });

    it('sets each color and resets back to automatic with null', async () => {
        for (const color of ['WHITE', 'YELLOW', 'GREEN', 'ORANGE', 'RED']) {
            const updated = await setIndicator('ab-indicator', color);
            expect(updated.companyIndicator).toBe(color);
            await expect(fetchIndicator('ab-indicator')).resolves.toBe(color);
        }

        const reset = await setIndicator('ab-indicator', null);
        expect(reset.companyIndicator).toBeNull();
        await expect(fetchIndicator('ab-indicator')).resolves.toBeNull();
    });

    it('rejects an unknown indicator value and an unknown analysis', async () => {
        const badValue = await graphqlRaw(
            `mutation($id: ID!, $indicator: CompanyIndicator) {
                updateNeedsAnalysisIndicator(id: $id, indicator: $indicator) { id }
            }`,
            { id: 'ab-indicator', indicator: 'PURPLE' },
        );
        expect(badValue.errors).toBeDefined();

        const missing = await graphqlRaw(
            `mutation($id: ID!, $indicator: CompanyIndicator) {
                updateNeedsAnalysisIndicator(id: $id, indicator: $indicator) { id }
            }`,
            { id: 'ab-does-not-exist', indicator: 'RED' },
        );
        expect(missing.errors).toBeDefined();
    });

    it('survives a generic updateNeedsAnalysis (no reset to automatic)', async () => {
        // La mise à jour générique exige une entreprise MySQL existante.
        const suffix = Date.now();
        const companyId = await new CompanyRepository().create({
            name: `Indicator Corp ${suffix}`,
            siret: `${suffix}0000000010`.slice(0, 14),
            address: 'X',
            sector: 'IT',
            conclusion: 'X',
        });
        const abId = `ab-indicator-update-${suffix}`;
        await repo.create({
            ...needsAnalysis(abId),
            company_infos: { id: companyId, name: `Indicator Corp ${suffix}` },
        });
        await setIndicator(abId, 'ORANGE');
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
        await expect(fetchIndicator(abId)).resolves.toBe('ORANGE');
    });
});

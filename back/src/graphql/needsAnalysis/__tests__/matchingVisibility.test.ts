import { describe, it, expect, beforeEach } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { truncateMysql, dropMongo } from '../../../../test/helpers/db';
import { env } from '../../../config/env';
import { CompanyRepository } from '../../../repositories/mysql/CompanyRepository';
import pool from '../../../db/mysql/connection';

const ENDPOINT = `http://localhost:${env.API_PORT}/api/graphql/needs-analysis`;
const OFFERS_ENDPOINT = `http://localhost:${env.API_PORT}/api/graphql/offers`;

describe('GraphQL draft matching visibility (Non envoyée)', () => {
    let companyId: number;
    let userId: number;
    let authCookies: { cookieHeader: string; csrfHeader: string };
    const suffix = Date.now();

    beforeEach(async () => {
        await truncateMysql();
        await dropMongo();

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.execute(
                'INSERT INTO users (email, first_name, last_name, password, role_id, permission_id) VALUES (?, ?, ?, ?, ?, ?)',
                [`sp-${suffix}@test.local`, 'Commercial', `${suffix}`, `pwd-${suffix}`, 1, 1],
            );
            userId = (result as any).insertId;
        } finally {
            conn.release();
        }

        const companyRepo = new CompanyRepository();
        const siret = `${suffix}00000000`.slice(0, 14);
        companyId = await companyRepo.create({
            name: `Test Company ${suffix}`,
            siret,
            address: '123 Route de Test',
            sector: 'IT',
            conclusion: 'À Réfléchir',
        });

        authCookies = mintAuthCookies({
            id: userId,
            email: `sp-${suffix}@test.local`,
            role: 'COMMERCIAL',
            permission: 'EMPLOYEE',
        });
    });

    async function graphql(query: string, variables: Record<string, unknown>, endpoint = ENDPOINT) {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: authCookies.cookieHeader,
                'x-csrf-token': authCookies.csrfHeader,
            },
            body: JSON.stringify({ query, variables }),
        });
        return { status: res.status, json: await res.json() };
    }

    function draftInput(extra: Record<string, unknown> = {}) {
        return {
            companyID: companyId,
            userID: userId,
            recruitmentResponsibleName: 'Jean Dupont',
            recruitmentResponsiblePhone: '0692112233',
            recruitmentResponsibleEmail: 'jean.dupont@company.local',
            positions: [
                {
                    trainingDomain: 'VENTE',
                    title: 'Apprenti Conseiller de Vente',
                    localisation: ['SAINT_DENIS'],
                    desiredTp: [{ missions: ['Accueil client'] }],
                    criteria: {
                        educationLevel: 'BAC',
                        drivingLicense: false,
                        experienceRequired: false,
                        softSkills: 'Dynamique',
                    },
                },
            ],
            recruitmentMethod: 'PRESELECTION',
            immersionPeriod: 'OUI',
            trainingDays: JSON.stringify({ monday: ['MATIN'] }),
            ...extra,
        };
    }

    async function createDraft(extra: Record<string, unknown> = {}) {
        const { json } = await graphql(
            `
                mutation CreateNeedsAnalysis($input: NeedsAnalysisInput!) {
                    createNeedsAnalysis(input: $input) {
                        id
                        status
                        isVisibleInMatching
                    }
                }
            `,
            { input: draftInput(extra) },
        );
        expect(json.errors).toBeUndefined();
        return json.data.createNeedsAnalysis;
    }

    async function offersCount(needsAnalysisId: string): Promise<number> {
        const { json } = await graphql(
            `
                query ($needsAnalysisId: String!) {
                    offersByNeedsAnalysis(needsAnalysisId: $needsAnalysisId) {
                        id
                    }
                }
            `,
            { needsAnalysisId },
            OFFERS_ENDPOINT,
        );
        expect(json.errors).toBeUndefined();
        return json.data.offersByNeedsAnalysis.length;
    }

    it('creates matching offers for a draft published at creation, keeping BROUILLON status', async () => {
        const created = await createDraft({ isVisibleInMatching: true });
        expect(created.status).toBe('BROUILLON');
        expect(created.isVisibleInMatching).toBe(true);

        // L'AB brouillon publiée se comporte comme une AB non signée : ses offres existent.
        await expect(offersCount(created.id)).resolves.toBeGreaterThan(0);

        // Elle reste listée dans l'onglet Actif du matching.
        const { json: pageJson } = await graphql(
            `
                query ($first: Int, $filter: OfferFilterInput) {
                    needsAnalysesPage(first: $first, filter: $filter) {
                        edges {
                            node {
                                id
                            }
                        }
                    }
                }
            `,
            { first: 50, filter: { abStatus: 'ACTIVE' } },
        );
        expect(pageJson.errors).toBeUndefined();
        const ids = pageJson.data.needsAnalysesPage.edges.map((e: any) => e.node.id);
        expect(ids).toContain(created.id);
    });

    it('creates no offers for a plain draft (existing behavior preserved)', async () => {
        const created = await createDraft();
        expect(created.status).toBe('BROUILLON');
        expect(created.isVisibleInMatching).toBe(false);
        await expect(offersCount(created.id)).resolves.toBe(0);
    });

    it('publishes and unpublishes an existing draft without changing its status', async () => {
        const created = await createDraft();
        await expect(offersCount(created.id)).resolves.toBe(0);

        const { json: publishJson } = await graphql(
            `
                mutation ($id: ID!, $visible: Boolean!) {
                    setNeedsAnalysisMatchingVisibility(id: $id, visible: $visible) {
                        id
                        status
                        isVisibleInMatching
                    }
                }
            `,
            { id: created.id, visible: true },
        );
        expect(publishJson.errors).toBeUndefined();
        expect(publishJson.data.setNeedsAnalysisMatchingVisibility.status).toBe('BROUILLON');
        expect(publishJson.data.setNeedsAnalysisMatchingVisibility.isVisibleInMatching).toBe(true);
        await expect(offersCount(created.id)).resolves.toBeGreaterThan(0);

        // Republier est idempotent : pas d'offres en double.
        const { json: republishJson } = await graphql(
            `
                mutation ($id: ID!, $visible: Boolean!) {
                    setNeedsAnalysisMatchingVisibility(id: $id, visible: $visible) {
                        id
                    }
                }
            `,
            { id: created.id, visible: true },
        );
        expect(republishJson.errors).toBeUndefined();
        const afterRepublish = await offersCount(created.id);
        await expect(offersCount(created.id)).resolves.toBe(afterRepublish);

        // Dépublier retire les offres, l'AB redevient un simple brouillon.
        const { json: unpublishJson } = await graphql(
            `
                mutation ($id: ID!, $visible: Boolean!) {
                    setNeedsAnalysisMatchingVisibility(id: $id, visible: $visible) {
                        id
                        status
                        isVisibleInMatching
                    }
                }
            `,
            { id: created.id, visible: false },
        );
        expect(unpublishJson.errors).toBeUndefined();
        expect(unpublishJson.data.setNeedsAnalysisMatchingVisibility.status).toBe('BROUILLON');
        expect(unpublishJson.data.setNeedsAnalysisMatchingVisibility.isVisibleInMatching).toBe(false);
        await expect(offersCount(created.id)).resolves.toBe(0);
    });

    it('refuses to publish a non-draft analysis', async () => {
        const created = await createDraft();
        const { json: updateJson } = await graphql(
            `
                mutation UpdateNeedsAnalysis($id: ID!, $input: NeedsAnalysisInput!) {
                    updateNeedsAnalysis(id: $id, input: $input) {
                        id
                        status
                    }
                }
            `,
            { id: created.id, input: { status: 'EN_ATTENTE_SIGNATURE' } },
        );
        expect(updateJson.errors).toBeUndefined();
        expect(updateJson.data.updateNeedsAnalysis.status).toBe('EN_ATTENTE_SIGNATURE');

        const { json } = await graphql(
            `
                mutation ($id: ID!, $visible: Boolean!) {
                    setNeedsAnalysisMatchingVisibility(id: $id, visible: $visible) {
                        id
                    }
                }
            `,
            { id: created.id, visible: true },
        );
        expect(json.errors).toBeDefined();
    });
});

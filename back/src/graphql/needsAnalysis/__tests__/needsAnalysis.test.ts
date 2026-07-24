import { describe, it, expect, beforeEach } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { truncateMysql, dropMongo } from '../../../../test/helpers/db';
import { env } from '../../../config/env';
import { CompanyRepository } from '../../../repositories/mysql/CompanyRepository';
import pool from '../../../db/mysql/connection';
import { JobRole, Permission } from '../../../types/user.types';

const ENDPOINT = `http://localhost:${env.API_PORT}/api/graphql/needs-analysis`;

describe('GraphQL Needs Analysis integration', () => {
    let companyId: number;
    let userId: number;
    let authCookies: { cookieHeader: string; csrfHeader: string };
    const suffix = Date.now();

    beforeEach(async () => {
        await truncateMysql();
        await dropMongo();

        // 1. Seed user
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

        // 2. Seed company
        const companyRepo = new CompanyRepository();
        const siret = `${suffix}00000000`.slice(0, 14);
        companyId = await companyRepo.create({
            name: `Test Company ${suffix}`,
            siret,
            address: '123 Route de Test',
            sector: 'IT',
            conclusion: 'À Réfléchir',
        });

        // 3. Mint auth cookies
        authCookies = mintAuthCookies({
            id: userId,
            email: `sp-${suffix}@test.local`,
            role: 'COMMERCIAL',
            permission: 'EMPLOYEE',
        });
    });

    async function graphql(query: string, variables: Record<string, unknown>) {
        const res = await fetch(ENDPOINT, {
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

    // PDF generation boots a real headless Chrome: allow well over the 5s default
    it(
        'creates and retrieves a multi-position needs analysis with distinct per-position criteria',
        { timeout: 30000 },
        async () => {
            const input = {
                companyID: companyId,
                userID: userId,
                recruitmentResponsibleName: 'Jean Dupont',
                recruitmentResponsiblePhone: '0692112233',
                recruitmentResponsibleEmail: 'jean.dupont@company.local',
                companySectors: ['Commerce / Vente'],
                positions: [
                    {
                        trainingDomain: 'VENTE',
                        title: 'Apprenti Conseiller de Vente',
                        missions: ['Accueil client', 'Mise en rayon'],
                        localisation: ['SAINT_DENIS', 'SAINTE_MARIE'],
                        criteria: {
                            educationLevel: 'BAC',
                            drivingLicense: false,
                            experienceRequired: false,
                            ageMin: 18,
                            ageMax: 27,
                            softSkills: 'Dynamique, souriant',
                            conditions: 'Temps plein, travail le samedi',
                        },
                    },
                    {
                        trainingDomain: 'SECRETARIAT',
                        title: 'Secrétaire Assistante',
                        missions: ['Saisie de données'],
                        localisation: ['SAINT_PIERRE'],
                        criteria: {
                            educationLevel: 'BAC_PLUS_2',
                            drivingLicense: true,
                            experienceRequired: true,
                            ageMin: 21,
                            ageMax: 30,
                            softSkills: 'Rigueur, discrétion',
                            conditions: 'Temps partiel',
                        },
                    },
                ],
                recruitmentMethod: 'PRESELECTION',
                immersionPeriod: 'OUI',
                trainingDays: JSON.stringify({ monday: ['MATIN', 'APRES_MIDI'], tuesday: ['MATIN'] }),
                status: 'BROUILLON',
            };

            const createMutation = `
            mutation CreateNeedsAnalysis($input: NeedsAnalysisInput!) {
                createNeedsAnalysis(input: $input) {
                    id
                    companyInfos { id activities }
                    salerInfo { id }
                    referents { recruitmentReferents { name } }
                    positionsCount
                    positions {
                        title
                        missions
                        localisation
                        criteria {
                            educationLevel
                            drivingLicense
                            experienceRequired
                            ageMin
                            ageMax
                            softSkills
                            conditions
                        }
                    }
                    status
                }
            }
        `;

            const { status: createStatus, json: createJson } = await graphql(createMutation, { input });
            expect(createStatus).toBe(200);
            expect(createJson.errors).toBeUndefined();

            const created = createJson.data.createNeedsAnalysis;
            expect(created.companyInfos.id).toBe(companyId);
            expect(created.companyInfos.activities).toEqual(['Commerce / Vente']);
            expect(created.salerInfo.id).toBe(userId);
            expect(created.referents.recruitmentReferents.name).toBe('Jean Dupont');
            expect(created.positionsCount).toBe(2);
            expect(created.positions).toHaveLength(2);

            // Each position keeps its own, distinct criteria — no bleed-through between postes.
            expect(created.positions[0].title).toBe('Apprenti Conseiller de Vente');
            expect(created.positions[0].criteria.drivingLicense).toBe(false);
            expect(created.positions[0].criteria.experienceRequired).toBe(false);
            expect(created.positions[0].criteria.ageMin).toBe(18);
            expect(created.positions[0].criteria.ageMax).toBe(27);
            expect(created.positions[0].criteria.softSkills).toBe('Dynamique, souriant');

            expect(created.positions[1].title).toBe('Secrétaire Assistante');
            expect(created.positions[1].criteria.drivingLicense).toBe(true);
            expect(created.positions[1].criteria.experienceRequired).toBe(true);
            expect(created.positions[1].criteria.ageMin).toBe(21);
            expect(created.positions[1].criteria.ageMax).toBe(30);
            expect(created.positions[1].criteria.softSkills).toBe('Rigueur, discrétion');

            expect(created.status).toBe('BROUILLON');

            const needsAnalysisId = created.id;

            // Query: needsAnalysis(id)
            const fetchQuery = `
            query FetchNeedsAnalysis($id: ID!) {
                needsAnalysis(id: $id) {
                    id
                    companyInfos { id }
                    referents { recruitmentReferents { name } }
                    trainingDays
                }
            }
        `;
            const { json: fetchJson } = await graphql(fetchQuery, { id: needsAnalysisId });
            expect(fetchJson.errors).toBeUndefined();
            const fetched = fetchJson.data.needsAnalysis;
            expect(fetched.id).toBe(needsAnalysisId);
            expect(fetched.referents.recruitmentReferents.name).toBe('Jean Dupont');

            // Query: needsAnalysesByCompany(companyID)
            const companyQuery = `
            query FetchByCompany($companyID: Int!) {
                needsAnalysesByCompany(companyID: $companyID) {
                    id
                    positions { title }
                }
            }
        `;
            const { json: compJson } = await graphql(companyQuery, { companyID: companyId });
            expect(compJson.errors).toBeUndefined();
            expect(compJson.data.needsAnalysesByCompany).toHaveLength(1);
            expect(compJson.data.needsAnalysesByCompany[0].positions[0].title).toBe('Apprenti Conseiller de Vente');

            // REST: download the generated PDF (exercises the per-position criteria PDF blocks)
            const pdfRes = await fetch(`http://localhost:${env.API_PORT}/api/needs-analysis/${needsAnalysisId}/pdf`, {
                headers: { Cookie: authCookies.cookieHeader },
            });
            expect(pdfRes.status).toBe(200);
            expect(pdfRes.headers.get('content-type')).toContain('application/pdf');
            const pdfBytes = Buffer.from(await pdfRes.arrayBuffer());
            expect(pdfBytes.length).toBeGreaterThan(1000);
            expect(pdfBytes.subarray(0, 5).toString()).toBe('%PDF-');
        },
    );

    it('receives Yousign webhook and updates status to SIGNE', { timeout: 30000 }, async () => {
        const input = {
            companyID: companyId,
            userID: userId,
            recruitmentResponsibleName: 'Jean Dupont',
            recruitmentResponsiblePhone: '0692112233',
            recruitmentResponsibleEmail: 'jean.dupont@company.local',
            positions: [
                {
                    trainingDomain: 'VENTE',
                    title: 'Apprenti Conseiller de Vente',
                    missions: ['Accueil client'],
                    localisation: ['SAINT_DENIS', 'SAINTE_MARIE'],
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
            status: 'BROUILLON',
        };

        const createMutation = `
            mutation CreateNeedsAnalysis($input: NeedsAnalysisInput!) {
                createNeedsAnalysis(input: $input) {
                    id
                    yousignSignatureRequestID
                    status
                }
            }
        `;

        // 1. Create Needs Analysis via GraphQL
        const { json: createJson } = await graphql(createMutation, { input });
        expect(createJson.errors).toBeUndefined();
        const created = createJson.data.createNeedsAnalysis;
        expect(created.status).toBe('BROUILLON');

        // Creation no longer triggers Yousign: simulate a manually initiated procedure
        const yousignId = `mock-yousign-req-${suffix}`;
        const updateMutation = `
            mutation UpdateNeedsAnalysis($id: ID!, $input: NeedsAnalysisInput!) {
                updateNeedsAnalysis(id: $id, input: $input) {
                    id
                    yousignSignatureRequestID
                    status
                }
            }
        `;
        const { json: updateJson } = await graphql(updateMutation, {
            id: created.id,
            input: { yousignSignatureRequestID: yousignId, status: 'EN_ATTENTE_SIGNATURE' },
        });
        expect(updateJson.errors).toBeUndefined();
        expect(updateJson.data.updateNeedsAnalysis.status).toBe('EN_ATTENTE_SIGNATURE');

        // 2. Trigger Webhook call
        const webhookUrl = `http://localhost:${env.API_PORT}/api/webhooks/yousign`;
        const webhookRes = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                eventName: 'procedure.signed',
                data: {
                    id: yousignId,
                },
            }),
        });

        expect(webhookRes.status).toBe(200);
        const webhookJson = await webhookRes.json();
        expect(webhookJson.success).toBe(true);

        // 3. Query back GraphQL to check status has changed to SIGNE
        const fetchQuery = `
            query FetchNeedsAnalysis($id: ID!) {
                needsAnalysis(id: $id) {
                    status
                }
            }
        `;
        const { json: fetchJson } = await graphql(fetchQuery, { id: created.id });
        expect(fetchJson.errors).toBeUndefined();
        expect(fetchJson.data.needsAnalysis.status).toBe('SIGNE');
    });
});

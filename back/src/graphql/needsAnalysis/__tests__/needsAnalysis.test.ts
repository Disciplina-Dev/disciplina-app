import { describe, it, expect, beforeEach } from 'vitest';
import { mintToken } from '../../../../test/helpers/auth';
import { truncateMysql } from '../../../../test/helpers/db';
import { env } from '../../../config/env';
import { CompanyRepository } from '../../../repositories/mysql/CompanyRepository';
import pool from '../../../db/mysql/connection';
import { Role } from '../../../types/user.types';

const ENDPOINT = `http://localhost:${env.API_PORT}/api/graphql/companies`;

describe('GraphQL Needs Analysis integration', () => {
    let companyId: number;
    let userId: number;
    let token: string;
    const suffix = Date.now();

    beforeEach(async () => {
        await truncateMysql();

        // 1. Seed user
        const conn = await pool.getConnection();
        try {
            const [result] = await conn.execute(
                'INSERT INTO users (email, name, password, role) VALUES (?, ?, ?, ?)',
                [`sp-${suffix}@test.local`, `Commercial ${suffix}`, `pwd-${suffix}`, Role.COMMERCIAL]
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
            conclusion: 'À Réfléchir'
        });

        // 3. Mint JWT token
        token = mintToken({ id: userId, email: `sp-${suffix}@test.local`, role: Role.COMMERCIAL });
    });

    // PDF generation boots a real headless Chrome: allow well over the 5s default
    it('creates and retrieves a needs analysis record', { timeout: 30000 }, async () => {
        const input = {
            companyID: companyId,
            userID: userId,
            recruitmentResponsibleName: 'Jean Dupont',
            recruitmentResponsiblePhone: '0692112233',
            recruitmentResponsibleEmail: 'jean.dupont@company.local',
            positions: [
                {
                    trainingDomain: 'VENTE',
                    jobTitle: 'Apprenti Conseiller de Vente',
                    selectedMissions: ['Accueil client', 'Mise en rayon'],
                    localisation: 'NORD',
                },
                {
                    trainingDomain: 'SECRETARIAT',
                    jobTitle: 'Secrétaire Assistante',
                    selectedMissions: ['Saisie de données'],
                    localisation: 'SUD',
                },
            ],
            otherMissions: 'Encaissement ponctuel',
            drivingLicense: 'OPTIONNEL',
            experienceRequired: 'DEBUTANT',
            ageMin: 18,
            ageMax: 27,
            softSkills: 'Dynamique, souriant',
            conditions: 'Temps plein, travail le samedi',
            recruitmentMethod: 'PRESELECTION',
            immersionPeriod: 'OUI',
            trainingDays: JSON.stringify({
                monday: ['MATIN', 'APRES_MIDI'],
                tuesday: ['MATIN']
            }),
            status: 'BROUILLON'
        };

        // Mutation: createNeedsAnalysis
        const createMutation = `
            mutation CreateNeedsAnalysis($input: NeedsAnalysisInput!) {
                createNeedsAnalysis(input: $input) {
                    id
                    companyID
                    userID
                    recruitmentResponsibleName
                    jobTitle
                    positionsCount
                    positions {
                        trainingDomain
                        jobTitle
                        selectedMissions
                        localisation
                    }
                    selectedMissions
                    ageMin
                    ageMax
                    conditions
                    trainingDays
                    status
                }
            }
        `;

        const createRes = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                query: createMutation,
                variables: { input }
            }),
        });

        const createJson = await createRes.json();
        expect(createRes.status).toBe(200);
        expect(createJson.errors).toBeUndefined();
        
        const created = createJson.data.createNeedsAnalysis;
        expect(created.id).toBeGreaterThan(0);
        expect(created.companyID).toBe(companyId);
        expect(created.recruitmentResponsibleName).toBe('Jean Dupont');
        // Legacy single-position columns mirror the first position
        expect(created.jobTitle).toBe('Apprenti Conseiller de Vente');
        expect(created.selectedMissions).toEqual(['Accueil client', 'Mise en rayon']);
        expect(created.positionsCount).toBe(2);
        expect(created.positions).toHaveLength(2);
        expect(created.positions[1].jobTitle).toBe('Secrétaire Assistante');
        expect(created.positions[1].localisation).toBe('SUD');
        expect(created.ageMin).toBe(18);
        expect(created.ageMax).toBe(27);
        expect(created.conditions).toBe('Temps plein, travail le samedi');
        expect(created.status).toBe('EN_ATTENTE_SIGNATURE');

        const needsAnalysisId = created.id;

        // Query: needsAnalysis(id)
        const fetchQuery = `
            query FetchNeedsAnalysis($id: Int!) {
                needsAnalysis(id: $id) {
                    id
                    companyID
                    recruitmentResponsibleName
                    otherMissions
                    trainingDays
                }
            }
        `;

        const fetchRes = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                query: fetchQuery,
                variables: { id: needsAnalysisId }
            }),
        });

        const fetchJson = await fetchRes.json();
        expect(fetchRes.status).toBe(200);
        expect(fetchJson.errors).toBeUndefined();

        const fetched = fetchJson.data.needsAnalysis;
        expect(fetched.id).toBe(needsAnalysisId);
        expect(fetched.recruitmentResponsibleName).toBe('Jean Dupont');
        expect(fetched.otherMissions).toBe('Encaissement ponctuel');
        
        // Query: needsAnalysesByCompany(companyID)
        const companyQuery = `
            query FetchByCompany($companyID: Int!) {
                needsAnalysesByCompany(companyID: $companyID) {
                    id
                    jobTitle
                }
            }
        `;

        const compRes = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                query: companyQuery,
                variables: { companyID: companyId }
            }),
        });

        const compJson = await compRes.json();
        expect(compJson.errors).toBeUndefined();
        expect(compJson.data.needsAnalysesByCompany).toHaveLength(1);
        expect(compJson.data.needsAnalysesByCompany[0].jobTitle).toBe('Apprenti Conseiller de Vente');
    });

    it('receives Yousign webhook and updates status to SIGNE', { timeout: 30000 }, async () => {
        const input = {
            companyID: companyId,
            userID: userId,
            recruitmentResponsibleName: 'Jean Dupont',
            recruitmentResponsiblePhone: '0692112233',
            recruitmentResponsibleEmail: 'jean.dupont@company.local',
            positionsCount: 2,
            localisation: 'NORD',
            trainingDomain: 'VENTE',
            jobTitle: 'Apprenti Conseiller de Vente',
            selectedMissions: ['Accueil client'],
            educationLevel: 'BAC',
            drivingLicense: 'OPTIONNEL',
            experienceRequired: 'DEBUTANT',
            ageRequirements: ['18-25'],
            softSkills: 'Dynamique',
            recruitmentMethod: 'PRESELECTION',
            immersionPeriod: 'OUI',
            trainingDays: JSON.stringify({ monday: ['MATIN'] }),
            status: 'BROUILLON'
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
        const createRes = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                query: createMutation,
                variables: { input }
            }),
        });

        const createJson = await createRes.json();
        expect(createJson.errors).toBeUndefined();
        const created = createJson.data.createNeedsAnalysis;
        const yousignId = created.yousignSignatureRequestID;
        expect(yousignId).toBeDefined();
        expect(created.status).toBe('EN_ATTENTE_SIGNATURE');

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
                    id: yousignId
                }
            }),
        });

        expect(webhookRes.status).toBe(200);
        const webhookJson = await webhookRes.json();
        expect(webhookJson.success).toBe(true);

        // 3. Query back GraphQL to check status has changed to SIGNE
        const fetchQuery = `
            query FetchNeedsAnalysis($id: Int!) {
                needsAnalysis(id: $id) {
                    status
                }
            }
        `;

        const fetchRes = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                query: fetchQuery,
                variables: { id: created.id }
            }),
        });

        const fetchJson = await fetchRes.json();
        expect(fetchJson.errors).toBeUndefined();
        expect(fetchJson.data.needsAnalysis.status).toBe('SIGNE');
    });
});

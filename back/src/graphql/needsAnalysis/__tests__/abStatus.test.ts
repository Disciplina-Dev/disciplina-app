import { describe, it, expect, beforeEach } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { NeedsAnalysisRepository } from '../../../repositories/mongo/NeedsAnalysisRepository';
import { OfferModel } from '../../../db/mongo/schemas/offer.schema';
import { NeedsAnalysisModel } from '../../../db/mongo/schemas/needsAnalysis.schema';
import { NeedsAnalysis, NeedsAnalysisStatus } from '../../../types/needsAnalysisNoSql.types';
import { OfferStatus, MatchedCandidateStatus, Localisation, MatchingCandidate } from '../../../types/matching.types';
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

function needsAnalysis(id: string): NeedsAnalysis {
    return {
        _id: id,
        company_infos: { id: COMPANY_ID, name: `Company ${id}` },
        status: NeedsAnalysisStatus.SIGNE,
        created_at: new Date(),
        positions: [{ title: 'Poste', localisation: [Localisation.SAINT_DENIS], desired_tp: [] }],
    };
}

async function seedOffer(id: string, needsAnalysisId: string, status: OfferStatus, candidates: MatchingCandidate[] = []) {
    await OfferModel.create({
        _id: id,
        needs_analysis_id: needsAnalysisId,
        company_infos: { id: COMPANY_ID, name: `Company ${needsAnalysisId}` },
        localisation: [Localisation.SAINT_DENIS],
        desired_tp: [],
        title: 'Poste',
        matching: { status, candidates, interview_slots: [] },
    });
}

async function fetchPageIds(abStatus?: string): Promise<string[]> {
    const data = await graphql(
        `query($first: Int, $filter: OfferFilterInput) {
            needsAnalysesPage(first: $first, filter: $filter) {
                edges { node { id } }
            }
        }`,
        { first: 50, filter: abStatus ? { abStatus } : undefined },
    );
    return (data.needsAnalysesPage.edges as { node: { id: string } }[]).map((e) => e.node.id).sort();
}

describe('GraphQL AB status tabs (needsAnalysesPage)', () => {
    const repo = new NeedsAnalysisRepository();

    beforeEach(async () => {
        // AB1 : offre active (pas en contrat) → Actif
        await repo.create(needsAnalysis('ab-active'));
        await seedOffer('offer-ab-active', 'ab-active', OfferStatus.NOT_MATCHED);

        // AB2 : toutes les offres en contrat (matching.status CONTRACT) → Archivé
        await repo.create(needsAnalysis('ab-archived'));
        await seedOffer('offer-ab-archived-1', 'ab-archived', OfferStatus.CONTRACT);
        await seedOffer('offer-ab-archived-2', 'ab-archived', OfferStatus.CONTRACT);

        // AB3 : offre dont un candidat est en contrat (mais matching.status CV_SEND) → Archivé
        await repo.create(needsAnalysis('ab-candidate-contract'));
        await seedOffer('offer-ab-candidate-contract', 'ab-candidate-contract', OfferStatus.CV_SEND, [
            { id: 'cand-1', full_name: 'Jean', status: MatchedCandidateStatus.CONTRACT },
        ]);

        // AB4 : aucune offre (AB non encore envoyée en signature) → Actif
        await repo.create(needsAnalysis('ab-no-offer'));

        // AB5 : offres mixtes (une en contrat, une pas) → Actif
        await repo.create(needsAnalysis('ab-mixed'));
        await seedOffer('offer-ab-mixed-1', 'ab-mixed', OfferStatus.CONTRACT);
        await seedOffer('offer-ab-mixed-2', 'ab-mixed', OfferStatus.NOT_MATCHED);
    });

    it('filters ABs by derived status (ACTIVE / ARCHIVED / INACTIVE / all)', async () => {
        await expect(fetchPageIds()).resolves.toEqual([
            'ab-active',
            'ab-archived',
            'ab-candidate-contract',
            'ab-mixed',
            'ab-no-offer',
        ]);
        await expect(fetchPageIds('ACTIVE')).resolves.toEqual(['ab-active', 'ab-mixed', 'ab-no-offer']);
        await expect(fetchPageIds('ARCHIVED')).resolves.toEqual(['ab-archived', 'ab-candidate-contract']);
        await expect(fetchPageIds('INACTIVE')).resolves.toEqual([]);
    });

    it('soft-deletes an AB: it becomes INACTIVE but is not removed', async () => {
        const deleteMutation = `mutation($id: ID!) { deleteNeedsAnalysis(id: $id) }`;
        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: auth.cookieHeader,
                'x-csrf-token': auth.csrfHeader,
            },
            body: JSON.stringify({ query: deleteMutation, variables: { id: 'ab-active' } }),
        });
        const json = await res.json();
        expect(json.errors).toBeUndefined();
        expect(json.data.deleteNeedsAnalysis).toBe(true);

        // Le document est conservé et marqué inactif.
        const doc = await NeedsAnalysisModel.findById('ab-active').lean();
        expect(doc?.is_deleted).toBe(true);
        // Ses offres ont été retirées comme avant.
        const offers = await OfferModel.find({ needs_analysis_id: 'ab-active' }).lean();
        expect(offers).toHaveLength(0);

        await expect(fetchPageIds()).resolves.toEqual([
            'ab-active',
            'ab-archived',
            'ab-candidate-contract',
            'ab-mixed',
            'ab-no-offer',
        ]);
        await expect(fetchPageIds('ACTIVE')).resolves.toEqual(['ab-mixed', 'ab-no-offer']);
        await expect(fetchPageIds('ARCHIVED')).resolves.toEqual(['ab-archived', 'ab-candidate-contract']);
        await expect(fetchPageIds('INACTIVE')).resolves.toEqual(['ab-active']);
    });

    it('hides inactive (soft-deleted) ABs from the commercial portefeuille', async () => {
        const data = await graphql(
            `query($companyID: Int!) { needsAnalysesByCompany(companyID: $companyID) { id } }`,
            { companyID: COMPANY_ID },
        );
        expect(data.needsAnalysesByCompany.map((n: { id: string }) => n.id).sort()).toEqual([
            'ab-active',
            'ab-archived',
            'ab-candidate-contract',
            'ab-mixed',
            'ab-no-offer',
        ]);

        await graphql(`mutation($id: ID!) { deleteNeedsAnalysis(id: $id) }`, { id: 'ab-archived' });

        const after = await graphql(
            `query($companyID: Int!) { needsAnalysesByCompany(companyID: $companyID) { id } }`,
            { companyID: COMPANY_ID },
        );
        expect(after.needsAnalysesByCompany.map((n: { id: string }) => n.id).sort()).toEqual([
            'ab-active',
            'ab-candidate-contract',
            'ab-mixed',
            'ab-no-offer',
        ]);
    });
});

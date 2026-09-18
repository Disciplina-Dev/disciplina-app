import { describe, it, expect, beforeEach } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { NeedsAnalysisRepository } from '../../../repositories/mongo/NeedsAnalysisRepository';
import { OfferModel } from '../../../db/mongo/schemas/offer.schema';
import { NeedsAnalysis, NeedsAnalysisStatus } from '../../../types/needsAnalysisNoSql.types';
import { OfferStatus, Localisation } from '../../../types/matching.types';
import { env } from '../../../config/env';

const AB_ENDPOINT = `http://localhost:${env.API_PORT}/api/graphql/needs-analysis`;
const OFFERS_ENDPOINT = `http://localhost:${env.API_PORT}/api/graphql/offers`;
const COMPANY_ID = 778;

const auth = mintAuthCookies({ id: 1, email: 'rh@test.local', role: 'RH', permission: 'EMPLOYEE' });

async function graphql(endpoint: string, query: string, variables: Record<string, unknown>) {
    const res = await fetch(endpoint, {
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

async function seedOffer(id: string, needsAnalysisId: string, status: OfferStatus) {
    await OfferModel.create({
        _id: id,
        needs_analysis_id: needsAnalysisId,
        company_infos: { id: COMPANY_ID, name: `Company ${needsAnalysisId}` },
        localisation: [Localisation.SAINT_DENIS],
        desired_tp: [],
        title: 'Poste',
        matching: { status, candidates: [], interview_slots: [] },
    });
}

async function fetchAb(id: string): Promise<{ id: string; abStatus: string; lastActiveAt: string | null }> {
    const data = await graphql(AB_ENDPOINT, `query($id: ID!) { needsAnalysis(id: $id) { id abStatus lastActiveAt } }`, {
        id,
    });
    return data.needsAnalysis;
}

async function setAbStatus(id: string, abStatus: string | null) {
    const data = await graphql(
        AB_ENDPOINT,
        `mutation($id: ID!, $abStatus: AbStatus) {
            updateNeedsAnalysisAbStatus(id: $id, abStatus: $abStatus) { id abStatus lastActiveAt }
        }`,
        { id, abStatus },
    );
    return data.updateNeedsAnalysisAbStatus;
}

describe('AB activation date (lastActiveAt)', () => {
    const repo = new NeedsAnalysisRepository();

    beforeEach(async () => {
        // ab-stamp : une offre en contrat → dérive ARCHIVED, sans date d'activation.
        await repo.create(needsAnalysis('ab-stamp'));
        await seedOffer('offer-ab-stamp', 'ab-stamp', OfferStatus.CONTRACT);

        // ab-derived : même point de départ, pour tester la réactivation dérivée.
        await repo.create(needsAnalysis('ab-derived'));
        await seedOffer('offer-ab-derived', 'ab-derived', OfferStatus.CONTRACT);
    });

    it('is null before the first activation and stamped when the AB becomes ACTIVE', async () => {
        const before = await fetchAb('ab-stamp');
        expect(before.abStatus).toBe('ARCHIVED');
        expect(before.lastActiveAt).toBeNull();

        const updated = await setAbStatus('ab-stamp', 'ACTIVE');
        expect(updated.abStatus).toBe('ACTIVE');
        expect(updated.lastActiveAt).not.toBeNull();

        const after = await fetchAb('ab-stamp');
        expect(after.lastActiveAt).toBe(updated.lastActiveAt);
    });

    it('only updates when the AB becomes ACTIVE again after INACTIVE/ARCHIVED', async () => {
        const first = await setAbStatus('ab-stamp', 'ACTIVE');
        expect(first.lastActiveAt).not.toBeNull();

        // Forçage redondant alors que déjà ACTIVE : la date est conservée.
        const same = await setAbStatus('ab-stamp', 'ACTIVE');
        expect(same.lastActiveAt).toBe(first.lastActiveAt);

        // Passage en INACTIVE : la date est conservée.
        await setAbStatus('ab-stamp', 'INACTIVE');
        const inactive = await fetchAb('ab-stamp');
        expect(inactive.abStatus).toBe('INACTIVE');
        expect(inactive.lastActiveAt).toBe(first.lastActiveAt);

        // Réactivation : la date est mise à jour (>=, même milliseconde possible).
        const reactivated = await setAbStatus('ab-stamp', 'ACTIVE');
        expect(new Date(reactivated.lastActiveAt).getTime()).toBeGreaterThanOrEqual(
            new Date(first.lastActiveAt).getTime(),
        );

        // Réinitialisation au calcul auto qui dérive ARCHIVED : pas de mise à jour.
        await setAbStatus('ab-stamp', null);
        const derived = await fetchAb('ab-stamp');
        expect(derived.abStatus).toBe('ARCHIVED');
        expect(derived.lastActiveAt).toBe(reactivated.lastActiveAt);
    });

    it('stamps a derived reactivation when the last contracted offer is deleted', async () => {
        const before = await fetchAb('ab-derived');
        expect(before.abStatus).toBe('ARCHIVED');
        expect(before.lastActiveAt).toBeNull();

        const deleted = await graphql(OFFERS_ENDPOINT, `mutation($id: String!) { deleteOffer(id: $id) }`, {
            id: 'offer-ab-derived',
        });
        expect(deleted.deleteOffer).toBe(true);

        // Sans offre, l'AB dérive ACTIVE : la suppression a horodaté la réactivation.
        const after = await fetchAb('ab-derived');
        expect(after.abStatus).toBe('ACTIVE');
        expect(after.lastActiveAt).not.toBeNull();
    });

    it('exposes lastActiveAt on the needsAnalysesPage nodes', async () => {
        await setAbStatus('ab-stamp', 'ACTIVE');
        const data = await graphql(
            AB_ENDPOINT,
            `query($first: Int) {
                needsAnalysesPage(first: $first) { edges { node { id lastActiveAt } } }
            }`,
            { first: 50 },
        );
        const node = (data.needsAnalysesPage.edges as { node: { id: string; lastActiveAt: string | null } }[]).find(
            (e) => e.node.id === 'ab-stamp',
        );
        expect(node?.lastActiveAt).not.toBeNull();
    });
});

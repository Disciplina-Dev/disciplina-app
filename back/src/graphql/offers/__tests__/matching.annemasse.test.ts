import { describe, it, expect } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { seedOffer } from '../../../../test/helpers/seedOffer';
import { env } from '../../../config/env';
import { getModels } from '../../../db/mongo/tenant';
import { syncWithRegion } from '../../../db/tenant';
import { CandidateStatus, TitleProfessionalType } from '../../../types/candidate.types';
import { Localisation, OfferStatus } from '../../../types/matching.types';

const ENDPOINT = `http://localhost:${env.API_PORT}/api/graphql/offers`;
const suffix = Date.now();

async function seedCandidate(id: string, fields: Record<string, unknown>) {
    await getModels().Candidate.create({
        _id: id,
        candidate_id: id,
        tp_types: [TitleProfessionalType.AD],
        status: CandidateStatus.SEEKING,
        identity: { full_name: id, email: `${id}@test.local`, phone: '0600000000', age: 25 },
        ...fields,
    });
}

describe('matching tenant annemasse (GEO-06)', () => {
    it('propose un candidat Annemasse pour une offre Annemasse, pas un candidat Réunion', async () => {
        const offerId = `offer-anm-${suffix}`;
        const annemasseId = `cand-anm-${suffix}`;
        const reunionId = `cand-reu-${suffix}`;

        await syncWithRegion('annemasse', async () => {
            await seedOffer({
                _id: offerId,
                company_name: `Boulangerie Annemasse ${suffix}`,
                desired_tp: 'AD',
                status: OfferStatus.NOT_MATCHED,
                localisation: [Localisation.ANNEMASSE],
            });
            await seedCandidate(annemasseId, {
                training_site: 'ANNEMASSE',
                job_info: { geographic_mobility: [Localisation.ANNEMASSE] },
            });
            await seedCandidate(reunionId, {
                training_site: 'NORD_SAINTE_MARIE',
                job_info: { geographic_mobility: [Localisation.SAINT_DENIS] },
            });
        });

        const auth = mintAuthCookies({
            id: 1,
            email: 'admin@test.local',
            role: 'RH',
            permission: 'ADMIN',
            region: 'annemasse',
        });
        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: auth.cookieHeader, 'x-csrf-token': auth.csrfHeader },
            body: JSON.stringify({
                query: `query($id: String!) { matchOffer(id: $id) { suggestedCandidates { id } } }`,
                variables: { id: offerId },
            }),
        });
        const json = await res.json();

        expect(json.errors).toBeUndefined();
        const ids = json.data.matchOffer.suggestedCandidates.map((c: { id: string }) => c.id);
        expect(ids).toContain(annemasseId);
        expect(ids).not.toContain(reunionId);
    });
});

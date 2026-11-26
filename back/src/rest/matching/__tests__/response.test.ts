import { describe, it, expect, beforeEach } from 'vitest';
import { dropMongo, truncateMysql } from '../../../../test/helpers/db';
import { seedOffer } from '../../../../test/helpers/seedOffer';
import { signMatchUrl } from '../../../external/crypto';
import { env } from '../../../config/env';
import { MatchedCandidateStatus } from '../../../types/matching.types';
import { OfferModel } from '../../../db/mongo/schemas/offer.schema';

function responseUrl(offerId: string, candidateId: string, answer: 'oui' | 'non'): string {
    const { sig, ts } = signMatchUrl(offerId, candidateId, answer);
    const base = `http://localhost:${env.API_PORT}/api/matching/response`;
    return `${base}?offerId=${encodeURIComponent(offerId)}&candidateId=${encodeURIComponent(candidateId)}&answer=${answer}&sig=${encodeURIComponent(sig)}&ts=${ts}`;
}

describe('GET /api/matching/response', () => {
    beforeEach(async () => {
        await truncateMysql();
        await dropMongo();
    });

    it('records a « oui » answer when the candidate belongs to the offer', async () => {
        const suffix = Date.now();
        const offerId = `offer-response-${suffix}`;
        const candidateId = `cand-response-${suffix}`;
        await seedOffer({
            _id: offerId,
            candidates: [{ id: candidateId, status: MatchedCandidateStatus.PRE_SELECTED_MAIL_SEND }],
        });

        const res = await fetch(responseUrl(offerId, candidateId, 'oui'));

        expect(res.status).toBe(200);
        const offer = await OfferModel.findById(offerId).lean();
        expect(offer?.matching?.candidates?.find((c) => c.id === candidateId)?.status).toBe(
            MatchedCandidateStatus.ACCEPTED,
        );
    });

    it('does not confirm the answer when the candidate is not attached to the offer', async () => {
        const suffix = Date.now();
        const offerId = `offer-response-missing-${suffix}`;
        await seedOffer({ _id: offerId });

        const res = await fetch(responseUrl(offerId, `cand-missing-${suffix}`, 'oui'));

        expect(res.status).toBe(404);
        expect(await res.text()).toContain("n'est plus disponible");
    });
});

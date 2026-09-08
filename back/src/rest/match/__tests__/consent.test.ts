import { describe, it, expect } from 'vitest';
import { env } from '../../../config/env';
import { OfferRepository } from '../../../repositories/mongo/OfferRepository';
import { MatchLinkRepository } from '../../../repositories/mysql/MatchLinkRepository';
import { CandidateService } from '../../../services/CandidateService';
import { seedOffer } from '../../../../test/helpers/seedOffer';
import { issueMatchToken } from '../../../services/matchToken';
import { OfferStatus, MatchedCandidateStatus, Sex } from '../../../types/matching.types';
import { TitleProfessionalType, CandidateStatus } from '../../../types/candidate.types';

const BASE = `http://localhost:${env.API_PORT}/api/match`;

async function seedCandidate(suffix: number, dataSharing: boolean): Promise<string> {
    const service = new CandidateService();
    const id = `cand-match-consent-${suffix}`;
    await service.create({
        _id: id,
        candidate_id: id,
        tp_types: [TitleProfessionalType.CC],
        status: CandidateStatus.SEEKING,
        identity: {
            full_name: `Candidat Match Consentement ${suffix}`,
            email: `cand-match-consent-${suffix}@test.local`,
            phone: '0692000003',
        } as any,
        consentments: {
            data_processing: true,
            data_sharing: dataSharing,
            ai_processing: false,
            photo_processing: false,
            consent_date: new Date(),
            consent_version: '1',
        },
    } as any);
    return id;
}

async function seedSession(suffix: number, candidateIds: string[]): Promise<{ signature: string; token: string }> {
    const offerId = `offer-match-consent-${suffix}`;
    await seedOffer({ _id: offerId, company_name: `Match Consent Corp ${suffix}`, status: OfferStatus.CV_SEND });

    const offerRepo = new OfferRepository();
    for (const id of candidateIds) {
        await offerRepo.addProposedCandidate(offerId, {
            id,
            full_name: `Candidate ${id}`,
            sex: Sex.NONE,
            status: MatchedCandidateStatus.SEND,
        });
    }

    const signature = `sig-match-consent-${suffix}`.padEnd(64, '0');
    const matchLinkRepo = new MatchLinkRepository();
    await matchLinkRepo.create({
        signature,
        code: '000000',
        identifier: `id-${suffix}`,
        rh_email: `rh-match-consent-${suffix}@test.local`,
        company_email: `company-match-consent-${suffix}@test.local`,
        offer_uuid: offerId,
        expires_at: new Date(Date.now() + 60 * 60 * 1000),
    });

    const token = issueMatchToken(signature, offerId, 3600);
    return { signature, token };
}

describe('GET /api/match/:signature/candidates — data_sharing consent filtering', () => {
    it('excludes candidates who did not consent to data_sharing from the company view', async () => {
        const suffix = Date.now();
        const consentingId = await seedCandidate(suffix, true);
        const nonConsentingId = await seedCandidate(suffix + 1, false);
        const { signature, token } = await seedSession(suffix, [consentingId, nonConsentingId]);

        const res = await fetch(`${BASE}/${signature}/candidates`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        const ids = json.map((c: { id: string }) => c.id);
        expect(ids).toContain(consentingId);
        expect(ids).not.toContain(nonConsentingId);
    });
});

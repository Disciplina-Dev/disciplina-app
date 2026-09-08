import { describe, it, expect, beforeEach } from 'vitest';
import { env } from '../../../config/env';
import { ExternalAccessRepository } from '../../../repositories/mysql/ExternalAccessRepository';
import { CandidateService } from '../../../services/CandidateService';
import { seedOffer } from '../../../../test/helpers/seedOffer';
import { UserRepository } from '../../../repositories/mysql/UserRepository';
import { signAccessToken, ACCESS_TOKEN_COOKIE } from '../../middleware/tokenAuth';
import { GuestRole, Permission } from '../../../types/user.types';
import { truncateMysql } from '../../../../test/helpers/db';
import { OfferStatus, MatchedCandidateStatus, Sex } from '../../../types/matching.types';
import { TitleProfessionalType, CandidateStatus } from '../../../types/candidate.types';

const BASE = `http://localhost:${env.API_PORT}/api/external`;

async function createRhUser(): Promise<{ id: number; email: string }> {
    const repo = new UserRepository();
    const email = `rh-match-consent-${Date.now()}@test.local`;
    const id = await repo.create({
        email,
        first_name: 'RH',
        last_name: 'Consent',
        password: 'hashed',
        role_id: 2,
        permission_id: 1,
        sectors: null,
        oauth_token: null,
        refresh_token: null,
    });
    return { id, email };
}

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

async function seedSession(suffix: number, candidateIds: string[]): Promise<{ signature: string; cookie: string }> {
    const offerId = `offer-match-consent-${suffix}`;
    await seedOffer({
        _id: offerId,
        company_name: `Match Consent Corp ${suffix}`,
        status: OfferStatus.CV_SEND,
        candidates: candidateIds.map((id) => ({
            id,
            full_name: `Candidate ${id}`,
            email: `candidate-${id}@test.local`,
            age: 20,
            sex: Sex.NONE,
            status: MatchedCandidateStatus.SEND,
        })),
    });

    const { id: userId } = await createRhUser();
    const signature = `sig-match-consent-${suffix}`.padEnd(64, '0');
    await new ExternalAccessRepository().create({
        signature,
        code: '000000',
        user_id: userId,
        external_id: offerId,
        external_type: 'COMPANY',
        external_email: `company-match-consent-${suffix}@test.local`,
        external_first_name: 'Consent Corp',
        reference_id: 2,
        reference_key: offerId,
        status: 'AUTHENTICATED',
        attempts: 0,
        expires_at: null,
    });

    const token = signAccessToken({
        role: GuestRole.EXTERNAL_GUEST,
        permission: Permission.GUEST,
        signature,
        referenceId: 2,
    });
    return { signature, cookie: `${ACCESS_TOKEN_COOKIE}=${token}` };
}

describe('GET /api/external/:signature/match/candidates — data_sharing consent filtering', () => {
    beforeEach(async () => {
        await truncateMysql();
    });

    it('excludes candidates who did not consent to data_sharing from the company view', async () => {
        const suffix = Date.now();
        const consentingId = await seedCandidate(suffix, true);
        const nonConsentingId = await seedCandidate(suffix + 1, false);
        const { signature, cookie } = await seedSession(suffix, [consentingId, nonConsentingId]);

        const res = await fetch(`${BASE}/${signature}/match/candidates`, {
            headers: { Cookie: cookie },
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        const ids = (json as { id: string }[]).map((c) => c.id);
        expect(ids).toContain(consentingId);
        expect(ids).not.toContain(nonConsentingId);
    });
});

import { describe, it, expect, vi } from 'vitest';
import { MatchLinkService } from '../MatchLinkService';
import { InterviewMailService } from '../InterviewMailService';
import { MatchLinkRepository } from '../../repositories/mysql/MatchLinkRepository';
import { OfferRepository } from '../../repositories/mongo/OfferRepository';
import { seedOffer } from '../../../test/helpers/seedOffer';
import { UserRepository } from '../../repositories/mysql/UserRepository';
import { OfferStatus, MatchedCandidateStatus } from '../../types/matching.types';

async function createRhUser(suffix: number): Promise<{ id: number; email: string }> {
    const repo = new UserRepository();
    const email = `rh-matchlink-${suffix}@test.local`;
    const id = await repo.create({
        email,
        first_name: 'RH',
        last_name: String(suffix),
        password: 'hashed',
        role_id: 2,
        permission_id: 1,
        sectors: null,
        oauth_token: null,
        refresh_token: null,
    });
    return { id, email };
}

describe('MatchLinkService.submitAnswers', () => {
    it('writes the interview pool at the job level and creates an interview_access row + email for accepted candidates', async () => {
        const suffix = Date.now();
        const rh = await createRhUser(suffix);
        const jobRepo = new OfferRepository();
        const matchLinkRepo = new MatchLinkRepository();

        // Stub the mailer via constructor injection (same pattern the class already
        // supports for tests) instead of going through the real Gmail API.
        const sendInvitation = vi.fn().mockResolvedValue(undefined);
        const stubMailService = { sendInvitation } as unknown as InterviewMailService;
        const service = new MatchLinkService(undefined, undefined, undefined, undefined, stubMailService);

        const offerId = `job-matchlink-${suffix}`;
        await seedOffer({
            _id: offerId,
            company_name: `MatchLink Corp ${suffix}`,
            status: OfferStatus.CV_SEND,
        });

        const candidateId = `cand-matchlink-${suffix}`;
        await jobRepo.addProposedCandidate(offerId, {
            id: candidateId,
            full_name: `Candidate ${suffix}`,
            email: `candidate-matchlink-${suffix}@test.local`,
            status: MatchedCandidateStatus.SEND,
        });

        const signature = `sig-matchlink-${suffix}`.padEnd(64, '0');
        await matchLinkRepo.create({
            signature,
            code: '999999',
            identifier: 'ENT-TESTID01',
            rh_email: rh.email,
            company_email: `company-${suffix}@test.local`,
            offer_uuid: offerId,
            expires_at: new Date(Date.now() + 60 * 60 * 1000),
        });

        const slots = ['2030-06-01T09:00:00.000Z', '2030-06-01T10:00:00.000Z'];
        const location = 'Saint-Pierre, 5 avenue des Tests';

        await service.submitAnswers(signature, [
            {
                candidateId,
                status: MatchedCandidateStatus.INTERVIEW,
                interviewSlots: slots,
                interviewLocation: location,
            },
        ]);

        const offer = await jobRepo.findById(offerId);
        expect(offer?.matching?.interview_slots).toEqual(slots);
        expect(offer?.matching?.interview_location).toBe(location);
        expect(offer?.matching?.candidates?.[0].status).toBe(MatchedCandidateStatus.INTERVIEW);
        // The job-level pool is shared, not duplicated per-candidate.
        expect((offer?.matching?.candidates?.[0] as Record<string, unknown> | undefined)?.interview).toBeUndefined();

        expect(sendInvitation).toHaveBeenCalledTimes(1);
        expect(sendInvitation).toHaveBeenCalledWith(
            rh.email,
            `candidate-matchlink-${suffix}@test.local`,
            `MatchLink Corp ${suffix}`,
            expect.any(String),
            expect.any(String),
        );

        // Find the interview_access row created for this candidate via a raw lookup.
        const { query } = await import('../../db/mysql/connection');
        const rows = await query<{ signature: string }[]>(
            'SELECT signature FROM interview_access WHERE candidate_id = ? AND offer_uuid = ?',
            [candidateId, offerId],
        );
        expect(rows).toHaveLength(1);
    });
});

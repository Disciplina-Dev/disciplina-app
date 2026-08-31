import { describe, it, expect, vi } from 'vitest';
import { MatchAccessService } from '../MatchAccessService';
import { InterviewMailService } from '../InterviewMailService';
import { ExternalAccessRepository } from '../../repositories/mysql/ExternalAccessRepository';
import { OfferRepository } from '../../repositories/mongo/OfferRepository';
import { seedOffer } from '../../../test/helpers/seedOffer';
import { UserRepository } from '../../repositories/mysql/UserRepository';
import { OfferStatus, MatchedCandidateStatus, Sex } from '../../types/matching.types';

async function createRhUser(suffix: number): Promise<{ id: number; email: string }> {
    const repo = new UserRepository();
    const email = `rh-matchaccess-${suffix}@test.local`;
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

describe('MatchAccessService', () => {
    it('creates the session in external_access (reference 2) with a SENDING status', async () => {
        const suffix = Date.now();
        const rh = await createRhUser(suffix);
        const offerId = `job-matchaccess-${suffix}`;
        const candidateId = `cand-matchaccess-${suffix}`;

        await seedOffer({
            _id: offerId,
            company_name: `MatchAccess Corp ${suffix}`,
            status: OfferStatus.CV_SEND,
            candidates: [
                {
                    id: candidateId,
                    full_name: `Candidate ${suffix}`,
                    email: `candidate-matchaccess-${suffix}@test.local`,
                    age: 20,
                    sex: Sex.NONE,
                    status: MatchedCandidateStatus.ACCEPTED,
                },
            ],
        });

        const service = new MatchAccessService();
        const session = await service.createSession({
            offerId,
            rhUserId: rh.id,
            rhEmail: rh.email,
            companyEmail: `company-${suffix}@test.local`,
            candidates: [{ id: candidateId }],
        });

        const row = await new ExternalAccessRepository().findBySignature(session.signature);
        expect(row).not.toBeNull();
        expect(row?.reference_id).toBe(2);
        expect(row?.reference_key).toBe(offerId);
        expect(row?.external_id).toBe(offerId);
        expect(row?.external_type).toBe('COMPANY');
        expect(row?.external_email).toBe(`company-${suffix}@test.local`);
        expect(row?.status).toBe('SENDING');
        expect(session.link).toContain(`/external/authenticate?sig=${session.signature}`);
    });

    it('writes the interview pool at the job level and creates an external_access row (reference 3) + invitation email for accepted candidates', async () => {
        const suffix = Date.now();
        const rh = await createRhUser(suffix);
        const jobRepo = new OfferRepository();
        const externalRepo = new ExternalAccessRepository();

        const sendInvitation = vi.fn().mockResolvedValue(undefined);
        const stubMailService = { sendInvitation } as unknown as InterviewMailService;
        const service = new MatchAccessService(
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            stubMailService,
        );

        const offerId = `job-matchaccess-${suffix}`;
        const candidateId = `cand-matchaccess-${suffix}`;
        await seedOffer({
            _id: offerId,
            company_name: `MatchAccess Corp ${suffix}`,
            status: OfferStatus.CV_SEND,
            candidates: [
                {
                    id: candidateId,
                    full_name: `Candidate ${suffix}`,
                    email: `candidate-matchaccess-${suffix}@test.local`,
                    age: 20,
                    sex: Sex.NONE,
                    status: MatchedCandidateStatus.ACCEPTED,
                },
            ],
        });

        const session = await service.createSession({
            offerId,
            rhUserId: rh.id,
            rhEmail: rh.email,
            companyEmail: `company-${suffix}@test.local`,
            candidates: [{ id: candidateId }],
        });

        const slots = ['2030-06-01T09:00:00.000Z', '2030-06-01T10:00:00.000Z'];
        const location = 'Saint-Pierre, 5 avenue des Tests';

        await service.submitAnswers(session.signature, [
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
        expect((offer?.matching?.candidates?.[0] as Record<string, unknown> | undefined)?.interview).toBeUndefined();

        expect(sendInvitation).toHaveBeenCalledTimes(1);
        expect(sendInvitation).toHaveBeenCalledWith(
            rh.email,
            `candidate-matchaccess-${suffix}@test.local`,
            `MatchAccess Corp ${suffix}`,
            expect.any(String),
        );

        expect((await externalRepo.findBySignature(session.signature))?.status).toBe('COMPLETED');

        const { query } = await import('../../db/mysql/connection');
        const rows = await query<{ signature: string; status: string }[]>(
            'SELECT signature, status FROM external_access WHERE reference_id = 3 AND external_id = ? AND reference_key = ?',
            [offerId, candidateId],
        );
        expect(rows).toHaveLength(1);
        expect(rows[0].status).toBe('SENDING');
    });
});

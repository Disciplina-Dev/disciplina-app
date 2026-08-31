import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { env } from '../../../config/env';
import { ExternalAccessRepository } from '../../../repositories/mysql/ExternalAccessRepository';
import { UserRepository } from '../../../repositories/mysql/UserRepository';
import { OfferRepository } from '../../../repositories/mongo/OfferRepository';
import { seedOffer } from '../../../../test/helpers/seedOffer';
import { truncateMysql } from '../../../../test/helpers/db';
import { CandidateHistoryRepository } from '../../../repositories/mongo/CandidateHistoryRepository';
import { NotificationRepository } from '../../../repositories/mongo/NotificationRepository';
import { GoogleCalendarService } from '../../../external/google/calendar.service';
import { signAccessToken, ACCESS_TOKEN_COOKIE } from '../../middleware/tokenAuth';
import { GuestRole, Permission } from '../../../types/user.types';
import { OfferStatus, MatchedCandidateStatus, Sex } from '../../../types/matching.types';
import { CandidateHistoryType } from '../../../types/candidate.types';

const BASE = `http://localhost:${env.API_PORT}/api/external`;

const repository = new ExternalAccessRepository();
const userRepository = new UserRepository();
const jobRepo = new OfferRepository();

function signature(name: string): string {
    return `${name}-${Date.now()}`.padEnd(64, '0');
}

function guestCookie(sig: string, referenceId = 3): string {
    const token = signAccessToken({
        role: GuestRole.EXTERNAL_GUEST,
        permission: Permission.GUEST,
        signature: sig,
        referenceId,
    });
    return `${ACCESS_TOKEN_COOKIE}=${token}`;
}

async function createRhUser(suffix: number, oauth = false): Promise<{ id: number; email: string }> {
    const email = `rh-interview-ext-${suffix}@test.local`;
    const id = await userRepository.create({
        email,
        first_name: 'RH',
        last_name: String(suffix),
        password: 'hashed',
        role_id: 2,
        permission_id: 1,
        sectors: null,
        oauth_token: oauth ? 'oauth-access-token' : null,
        refresh_token: oauth ? 'oauth-refresh-token' : null,
    });
    return { id, email };
}

async function seedInterviewOffer(suffix: number, slots: string[], candidates: { id: string; email: string; bookedSlot?: string }[]) {
    const offerId = `job-interview-ext-${suffix}`;
    await seedOffer({
        _id: offerId,
        company_name: `Interview Ext Corp ${suffix}`,
        status: OfferStatus.CV_SEND,
        interview_slots: slots,
        interview_location: 'Saint-Denis, 12 rue des Tests',
        candidates: candidates.map((c) => ({
            id: c.id,
            full_name: `Candidate ${c.id}`,
            email: c.email,
            age: 30,
            sex: Sex.NONE,
            status: MatchedCandidateStatus.INTERVIEW,
            ...(c.bookedSlot ? { booked_interview_slot: c.bookedSlot } : {}),
        })),
    });
    return offerId;
}

async function createInterviewSession(
    rhId: number,
    offerId: string,
    candidateId: string,
    sig: string,
    overrides: Partial<Parameters<ExternalAccessRepository['create']>[0]> = {},
): Promise<void> {
    await repository.create({
        signature: sig,
        code: '123456',
        user_id: rhId,
        external_id: offerId,
        external_type: 'CANDIDATE',
        external_email: `candidate-${candidateId}@test.local`,
        external_first_name: 'Candidate',
        reference_id: 3,
        reference_key: candidateId,
        status: 'PENDING',
        attempts: 0,
        expires_at: null,
        ...overrides,
    });
}

describe('External interview flow (reference 3)', () => {
    let freeBusySpy: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
        freeBusySpy = vi.spyOn(GoogleCalendarService.prototype, 'freeBusy').mockResolvedValue([]);
        await truncateMysql();
    });

    afterEach(() => {
        freeBusySpy.mockRestore();
    });

    describe('auth', () => {
        it('authenticates via POST /inspect and issues the guest cookie (reference 3)', async () => {
            const suffix = Date.now();
            const rh = await createRhUser(suffix);
            const offerId = await seedInterviewOffer(suffix, ['2030-01-01T09:00:00.000Z'], [
                { id: `cand-auth-${suffix}`, email: `candidate-auth-${suffix}@test.local` },
            ]);
            const sig = signature('sig-interview-auth');
            await createInterviewSession(rh.id, offerId, `cand-auth-${suffix}`, sig);

            const res = await fetch(`${BASE}/inspect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signature: sig, code: '123456' }),
            });
            expect(res.status).toBe(200);
            await expect(res.json()).resolves.toMatchObject({ success: true, user: { referenceId: 3 } });

            const setCookie = res.headers.get('set-cookie');
            expect(setCookie).toContain(ACCESS_TOKEN_COOKIE);
        });

        it('rejects slots without a guest cookie (401)', async () => {
            const res = await fetch(`${BASE}/some-signature/interview/slots`);
            expect(res.status).toBe(401);
        });

        it('rejects a cookie on a non-matching signature (401)', async () => {
            const suffix = Date.now();
            const rh = await createRhUser(suffix);
            const offerId = await seedInterviewOffer(suffix, ['2030-01-02T09:00:00.000Z'], [
                { id: `cand-sig-${suffix}`, email: 'x@test.local' },
            ]);
            const sig = signature('sig-interview-mismatch');
            await createInterviewSession(rh.id, offerId, `cand-sig-${suffix}`, sig);

            const res = await fetch(`${BASE}/${sig}/interview/slots`, {
                headers: { Cookie: guestCookie('another-signature') },
            });
            expect(res.status).toBe(401);
        });

        it('rejects a session outside the interview perimeter (reference 2 → 403)', async () => {
            const suffix = Date.now();
            const rh = await createRhUser(suffix);
            const offerId = await seedInterviewOffer(suffix, ['2030-01-03T09:00:00.000Z'], [
                { id: `cand-perim-${suffix}`, email: 'x@test.local' },
            ]);
            const sig = signature('sig-interview-perim');
            await createInterviewSession(rh.id, offerId, `cand-perim-${suffix}`, sig);

            const res = await fetch(`${BASE}/${sig}/interview/slots`, {
                headers: { Cookie: guestCookie(sig, 2) },
            });
            expect(res.status).toBe(403);
        });
    });

    describe('GET /:signature/interview/slots', () => {
        it('marks another candidate booked slot as taken', async () => {
            const suffix = Date.now();
            const rh = await createRhUser(suffix);
            const slotA = '2030-03-01T09:00:00.000Z';
            const slotB = '2030-03-01T10:00:00.000Z';
            const otherCandidateId = `cand-other-${suffix}`;
            const candidateId = `cand-view-${suffix}`;
            const offerId = await seedInterviewOffer(suffix, [slotA, slotB], [
                { id: otherCandidateId, email: `other-${suffix}@test.local`, bookedSlot: slotB },
                { id: candidateId, email: `view-${suffix}@test.local` },
            ]);
            const sig = signature('sig-interview-slots');
            await createInterviewSession(rh.id, offerId, candidateId, sig);

            const res = await fetch(`${BASE}/${sig}/interview/slots`, { headers: { Cookie: guestCookie(sig) } });
            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json.slots).toEqual(
                expect.arrayContaining([
                    { slot: slotA, taken: false },
                    { slot: slotB, taken: true },
                ]),
            );
            expect(json.location).toBe('Saint-Denis, 12 rue des Tests');
            expect(json.bookedSlot).toBeUndefined();
        });

        it('marks slots overlapping an RH busy period (all-day event) as taken', async () => {
            const suffix = Date.now();
            const rh = await createRhUser(suffix, true);
            const slotA = '2030-06-01T09:00:00.000Z';
            const slotB = '2030-06-05T09:00:00.000Z';
            const candidateId = `cand-cal-${suffix}`;
            const offerId = await seedInterviewOffer(suffix, [slotA, slotB], [
                { id: candidateId, email: `cal-${suffix}@test.local` },
            ]);
            const sig = signature('sig-interview-cal');
            await createInterviewSession(rh.id, offerId, candidateId, sig);

            freeBusySpy.mockResolvedValue([{ start: '2030-06-01T00:00:00.000Z', end: '2030-06-02T00:00:00.000Z' }]);

            const res = await fetch(`${BASE}/${sig}/interview/slots`, { headers: { Cookie: guestCookie(sig) } });
            const json = await res.json();
            expect(json.slots).toEqual(
                expect.arrayContaining([
                    { slot: slotA, taken: true },
                    { slot: slotB, taken: false },
                ]),
            );
        });

        it('does not mark slots taken when the RH calendar is not connected', async () => {
            const suffix = Date.now();
            const rh = await createRhUser(suffix, false);
            const slot = '2030-06-15T09:00:00.000Z';
            const candidateId = `cand-nocal-${suffix}`;
            const offerId = await seedInterviewOffer(suffix, [slot], [
                { id: candidateId, email: `nocal-${suffix}@test.local` },
            ]);
            const sig = signature('sig-interview-nocal');
            await createInterviewSession(rh.id, offerId, candidateId, sig);

            const res = await fetch(`${BASE}/${sig}/interview/slots`, { headers: { Cookie: guestCookie(sig) } });
            const json = await res.json();
            expect(json.slots).toEqual([{ slot, taken: false }]);
            expect(freeBusySpy).not.toHaveBeenCalled();
        });
    });

    describe('POST /:signature/interview/book', () => {
        it('books a free slot, completes the session and notifies the RH', async () => {
            const suffix = Date.now();
            const rh = await createRhUser(suffix);
            const slot = '2030-04-01T09:00:00.000Z';
            const candidateId = `cand-book-${suffix}`;
            const offerId = await seedInterviewOffer(suffix, [slot], [
                { id: candidateId, email: `book-${suffix}@test.local` },
            ]);
            const sig = signature('sig-interview-book');
            await createInterviewSession(rh.id, offerId, candidateId, sig);

            const res = await fetch(`${BASE}/${sig}/interview/book`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Cookie: guestCookie(sig) },
                body: JSON.stringify({ slot }),
            });
            expect(res.status).toBe(200);

            const offer = await jobRepo.findById(offerId);
            const candidate = offer?.matching?.candidates?.find((c) => c.id === candidateId);
            expect(candidate?.booked_interview_slot).toBe(slot);
            expect((await repository.findBySignature(sig))?.status).toBe('COMPLETED');

            const historyRepo = new CandidateHistoryRepository();
            const history = await historyRepo.findByCandidateId(candidateId);
            const bookingEntry = history.find((h) => h.type === CandidateHistoryType.CANDIDATE);
            expect(bookingEntry?.description).toContain("Le candidat a accepté l'entretien avec");
            expect(bookingEntry?.description).toContain('Interview Ext Corp');

            const notificationRepo = new NotificationRepository();
            const notifications = await notificationRepo.findForUser(rh.id);
            expect(notifications.some((n) => n.type === 'interview_booked')).toBe(true);
        });

        it('rejects a missing slot with 400', async () => {
            const suffix = Date.now();
            const rh = await createRhUser(suffix);
            const candidateId = `cand-noslot-${suffix}`;
            const offerId = await seedInterviewOffer(suffix, ['2030-04-02T09:00:00.000Z'], [
                { id: candidateId, email: `noslot-${suffix}@test.local` },
            ]);
            const sig = signature('sig-interview-noslot');
            await createInterviewSession(rh.id, offerId, candidateId, sig);

            const res = await fetch(`${BASE}/${sig}/interview/book`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Cookie: guestCookie(sig) },
                body: JSON.stringify({}),
            });
            expect(res.status).toBe(400);
        });

        it('rejects booking an already-taken slot with 409, race-safe under concurrency', async () => {
            const suffix = Date.now();
            const rh = await createRhUser(suffix);
            const slot = '2030-05-01T09:00:00.000Z';
            const candidateAId = `cand-race-a-${suffix}`;
            const candidateBId = `cand-race-b-${suffix}`;
            const offerId = await seedInterviewOffer(suffix, [slot], [
                { id: candidateAId, email: `race-a-${suffix}@test.local` },
                { id: candidateBId, email: `race-b-${suffix}@test.local` },
            ]);
            const sigA = signature('sig-interview-race-a');
            const sigB = signature('sig-interview-race-b');
            await createInterviewSession(rh.id, offerId, candidateAId, sigA);
            await createInterviewSession(rh.id, offerId, candidateBId, sigB);

            const [resA, resB] = await Promise.all([
                fetch(`${BASE}/${sigA}/interview/book`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Cookie: guestCookie(sigA) },
                    body: JSON.stringify({ slot }),
                }),
                fetch(`${BASE}/${sigB}/interview/book`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Cookie: guestCookie(sigB) },
                    body: JSON.stringify({ slot }),
                }),
            ]);

            const statuses = [resA.status, resB.status].sort();
            expect(statuses).toEqual([200, 409]);
        });

        it('rejects booking a slot overlapping an RH busy period with 409', async () => {
            const suffix = Date.now();
            const rh = await createRhUser(suffix, true);
            const slot = '2030-07-01T09:00:00.000Z';
            const candidateId = `cand-calbook-${suffix}`;
            const offerId = await seedInterviewOffer(suffix, [slot], [
                { id: candidateId, email: `calbook-${suffix}@test.local` },
            ]);
            const sig = signature('sig-interview-calbook');
            await createInterviewSession(rh.id, offerId, candidateId, sig);

            freeBusySpy.mockResolvedValue([{ start: '2030-07-01T00:00:00.000Z', end: '2030-07-02T00:00:00.000Z' }]);

            const res = await fetch(`${BASE}/${sig}/interview/book`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Cookie: guestCookie(sig) },
                body: JSON.stringify({ slot }),
            });
            expect(res.status).toBe(409);

            const offer = await jobRepo.findById(offerId);
            const candidate = offer?.matching?.candidates?.find((c) => c.id === candidateId);
            expect(candidate?.booked_interview_slot).toBeUndefined();
        });

        it('rejects a re-booking on an already COMPLETED session with 409', async () => {
            const suffix = Date.now();
            const rh = await createRhUser(suffix);
            const slot = '2030-08-01T09:00:00.000Z';
            const candidateId = `cand-done-${suffix}`;
            const offerId = await seedInterviewOffer(suffix, [slot], [
                { id: candidateId, email: `done-${suffix}@test.local` },
            ]);
            const sig = signature('sig-interview-done');
            await createInterviewSession(rh.id, offerId, candidateId, sig, { status: 'COMPLETED' });

            const res = await fetch(`${BASE}/${sig}/interview/book`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Cookie: guestCookie(sig) },
                body: JSON.stringify({ slot }),
            });
            expect(res.status).toBe(409);
            await expect(res.json()).resolves.toMatchObject({ error: 'Session already completed' });
        });
    });
});
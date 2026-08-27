import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { env } from '../../../config/env';
import { OfferRepository } from '../../../repositories/mongo/OfferRepository';
import { seedOffer } from '../../../../test/helpers/seedOffer';
import { UserRepository } from '../../../repositories/mysql/UserRepository';
import { InterviewAccessRepository } from '../../../repositories/mysql/InterviewAccessRepository';
import { CandidateHistoryRepository } from '../../../repositories/mongo/CandidateHistoryRepository';
import { NotificationRepository } from '../../../repositories/mongo/NotificationRepository';
import { GoogleCalendarService } from '../../../external/google/calendar.service';
import { OfferStatus, MatchedCandidateStatus } from '../../../types/matching.types';
import { CandidateHistoryType } from '../../../types/candidate.types';
import { truncateMysql } from '../../../../test/helpers/db';

const BASE = `http://localhost:${env.API_PORT}/api/interview`;

async function createRhUser(suffix: number, oauth = false): Promise<{ id: number; email: string }> {
    const repo = new UserRepository();
    const email = `rh-interview-${suffix}@test.local`;
    const id = await repo.create({
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

async function seedJobWithSlots(suffix: number, slots: string[]) {
    const jobRepo = new OfferRepository();
    const offerId = `job-interview-${suffix}`;
    await seedOffer({
        _id: offerId,
        company_name: `Interview Corp ${suffix}`,
        status: OfferStatus.CV_SEND,
    });
    await jobRepo.setOfferInterviewSlots(offerId, slots, 'Saint-Denis, 12 rue des Tests');
    return offerId;
}

async function addProposedCandidate(offerId: string, candidateId: string, email: string, bookedSlot?: string) {
    const jobRepo = new OfferRepository();
    await jobRepo.addProposedCandidate(offerId, {
        id: candidateId,
        full_name: `Candidate ${candidateId}`,
        email,
        status: MatchedCandidateStatus.INTERVIEW,
        ...(bookedSlot ? { booked_interview_slot: bookedSlot } : {}),
    });
}

describe('Interview access flow', () => {
    let freeBusySpy: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
        freeBusySpy = vi.spyOn(GoogleCalendarService.prototype, 'freeBusy').mockResolvedValue([]);
        await truncateMysql();
    });

    afterEach(() => {
        freeBusySpy.mockRestore();
    });

    describe('GET /:signature/inspect', () => {
        it('reports a non-existent session', async () => {
            const res = await fetch(`${BASE}/does-not-exist/inspect`);
            const json = await res.json();
            expect(res.status).toBe(200);
            expect(json).toEqual({ exists: false, expired: false, status: null });
        });
    });

    describe('POST /:signature/authenticate', () => {
        it('locks after 3 wrong codes and accepts the right one before that', async () => {
            const suffix = Date.now();
            const rh = await createRhUser(suffix);
            const offerId = await seedJobWithSlots(suffix, ['2030-01-01T09:00:00.000Z']);
            const candidateId = `cand-auth-${suffix}`;
            await addProposedCandidate(offerId, candidateId, `candidate-${suffix}@test.local`);

            const accessRepo = new InterviewAccessRepository();
            const signature = `sig-auth-${suffix}`.padEnd(64, '0');
            const code = '123456';
            await accessRepo.create({
                signature,
                code,
                offer_uuid: offerId,
                candidate_id: candidateId,
                rh_email: rh.email,
                expires_at: new Date(Date.now() + 60 * 60 * 1000),
            });

            for (let i = 0; i < 2; i++) {
                const res = await fetch(`${BASE}/${signature}/authenticate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: 'wrong0' }),
                });
                expect(res.status).toBe(401);
                const json = await res.json();
                expect(json.reason).toBe('invalid');
            }

            const lockedRes = await fetch(`${BASE}/${signature}/authenticate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: 'wrong0' }),
            });
            expect(lockedRes.status).toBe(401);
            expect((await lockedRes.json()).reason).toBe('locked');

            const lockedAfter = await accessRepo.findBySignature(signature);
            expect(lockedAfter?.status).toBe('LOCKED');
        });

        it('issues a token on the right code, usable for guarded routes', async () => {
            const suffix = Date.now() + 1;
            const rh = await createRhUser(suffix);
            const offerId = await seedJobWithSlots(suffix, ['2030-02-01T09:00:00.000Z', '2030-02-01T10:00:00.000Z']);
            const candidateId = `cand-auth-ok-${suffix}`;
            await addProposedCandidate(offerId, candidateId, `candidate-ok-${suffix}@test.local`);

            const accessRepo = new InterviewAccessRepository();
            const signature = `sig-auth-ok-${suffix}`.padEnd(64, '0');
            const code = '654321';
            await accessRepo.create({
                signature,
                code,
                offer_uuid: offerId,
                candidate_id: candidateId,
                rh_email: rh.email,
                expires_at: new Date(Date.now() + 60 * 60 * 1000),
            });

            const authRes = await fetch(`${BASE}/${signature}/authenticate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
            });
            expect(authRes.status).toBe(200);
            const { token } = await authRes.json();
            expect(typeof token).toBe('string');

            const slotsRes = await fetch(`${BASE}/${signature}/slots`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            expect(slotsRes.status).toBe(200);
            const slotsJson = await slotsRes.json();
            expect(slotsJson.slots).toHaveLength(2);
        });
    });

    describe('GET /:signature/slots', () => {
        it('marks another candidate booked slot as taken', async () => {
            const suffix = Date.now() + 2;
            const rh = await createRhUser(suffix);
            const slotA = '2030-03-01T09:00:00.000Z';
            const slotB = '2030-03-01T10:00:00.000Z';
            const offerId = await seedJobWithSlots(suffix, [slotA, slotB]);

            const otherCandidateId = `cand-other-${suffix}`;
            await addProposedCandidate(offerId, otherCandidateId, `other-${suffix}@test.local`, slotB);

            const candidateId = `cand-view-${suffix}`;
            await addProposedCandidate(offerId, candidateId, `view-${suffix}@test.local`);

            const accessRepo = new InterviewAccessRepository();
            const signature = `sig-slots-${suffix}`.padEnd(64, '0');
            const code = '111222';
            await accessRepo.create({
                signature,
                code,
                offer_uuid: offerId,
                candidate_id: candidateId,
                rh_email: rh.email,
                expires_at: new Date(Date.now() + 60 * 60 * 1000),
            });

            const authRes = await fetch(`${BASE}/${signature}/authenticate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
            });
            const { token } = await authRes.json();

            const res = await fetch(`${BASE}/${signature}/slots`, { headers: { Authorization: `Bearer ${token}` } });
            const json = await res.json();
            expect(json.slots).toEqual(
                expect.arrayContaining([
                    { slot: slotA, taken: false },
                    { slot: slotB, taken: true },
                ]),
            );
            expect(json.bookedSlot).toBeUndefined();
        });

        it('marks slots overlapping an RH busy period (all-day event) as taken', async () => {
            const suffix = Date.now() + 20;
            const rh = await createRhUser(suffix, true);
            const slotA = '2030-06-01T09:00:00.000Z'; // pendant l'évènement journée entière
            const slotB = '2030-06-05T09:00:00.000Z'; // jour suivant, libre
            const offerId = await seedJobWithSlots(suffix, [slotA, slotB]);

            const candidateId = `cand-cal-${suffix}`;
            await addProposedCandidate(offerId, candidateId, `cal-${suffix}@test.local`);

            const accessRepo = new InterviewAccessRepository();
            const signature = `sig-cal-${suffix}`.padEnd(64, '0');
            const code = '101010';
            await accessRepo.create({
                signature,
                code,
                offer_uuid: offerId,
                candidate_id: candidateId,
                rh_email: rh.email,
                expires_at: new Date(Date.now() + 60 * 60 * 1000),
            });

            // Le RH est occupé toute la journée du 2030-06-01 → seul le créneau A est pris.
            freeBusySpy.mockResolvedValue([{ start: '2030-06-01T00:00:00.000Z', end: '2030-06-02T00:00:00.000Z' }]);

            const authRes = await fetch(`${BASE}/${signature}/authenticate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
            });
            const { token } = await authRes.json();

            const res = await fetch(`${BASE}/${signature}/slots`, { headers: { Authorization: `Bearer ${token}` } });
            const json = await res.json();
            expect(json.slots).toEqual(
                expect.arrayContaining([
                    { slot: slotA, taken: true },
                    { slot: slotB, taken: false },
                ]),
            );
        });

        it('does not mark slots taken when the RH calendar is not connected', async () => {
            const suffix = Date.now() + 21;
            const rh = await createRhUser(suffix, false);
            const slotA = '2030-06-15T09:00:00.000Z';
            const offerId = await seedJobWithSlots(suffix, [slotA]);

            const candidateId = `cand-nocal-${suffix}`;
            await addProposedCandidate(offerId, candidateId, `nocal-${suffix}@test.local`);

            const accessRepo = new InterviewAccessRepository();
            const signature = `sig-nocal-${suffix}`.padEnd(64, '0');
            const code = '202020';
            await accessRepo.create({
                signature,
                code,
                offer_uuid: offerId,
                candidate_id: candidateId,
                rh_email: rh.email,
                expires_at: new Date(Date.now() + 60 * 60 * 1000),
            });

            const authRes = await fetch(`${BASE}/${signature}/authenticate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
            });
            const { token } = await authRes.json();

            const res = await fetch(`${BASE}/${signature}/slots`, { headers: { Authorization: `Bearer ${token}` } });
            const json = await res.json();
            expect(json.slots).toEqual([{ slot: slotA, taken: false }]);
            expect(freeBusySpy).not.toHaveBeenCalled();
        });
    });

    describe('POST /:signature/book', () => {
        it('books a free slot, records history and notifies the RH', async () => {
            const suffix = Date.now() + 3;
            const rh = await createRhUser(suffix);
            const slot = '2030-04-01T09:00:00.000Z';
            const offerId = await seedJobWithSlots(suffix, [slot]);
            const candidateId = `cand-book-${suffix}`;
            await addProposedCandidate(offerId, candidateId, `book-${suffix}@test.local`);

            const accessRepo = new InterviewAccessRepository();
            const signature = `sig-book-${suffix}`.padEnd(64, '0');
            const code = '333444';
            await accessRepo.create({
                signature,
                code,
                offer_uuid: offerId,
                candidate_id: candidateId,
                rh_email: rh.email,
                expires_at: new Date(Date.now() + 60 * 60 * 1000),
            });

            const authRes = await fetch(`${BASE}/${signature}/authenticate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
            });
            const { token } = await authRes.json();

            const bookRes = await fetch(`${BASE}/${signature}/book`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ slot }),
            });
            expect(bookRes.status).toBe(200);

            const jobRepo = new OfferRepository();
            const ctx = await jobRepo.findById(offerId);
            const candidate = ctx?.matching?.candidates?.find((c) => c.id === candidateId);
            expect(candidate?.booked_interview_slot).toBe(slot);

            const historyRepo = new CandidateHistoryRepository();
            const history = await historyRepo.findByCandidateId(candidateId);
            const bookingEntry = history.find((h) => h.type === CandidateHistoryType.CANDIDATE);
            expect(bookingEntry?.description).toContain("Le candidat a accepté l'entretien avec");
            expect(bookingEntry?.description).toContain('Interview Corp');

            const notificationRepo = new NotificationRepository();
            const notifications = await notificationRepo.findForUser(rh.id);
            expect(notifications.some((n) => n.type === 'interview_booked')).toBe(true);
        });

        it('rejects booking an already-taken slot with 409, race-safe under concurrency', async () => {
            const suffix = Date.now() + 4;
            const rh = await createRhUser(suffix);
            const slot = '2030-05-01T09:00:00.000Z';
            const offerId = await seedJobWithSlots(suffix, [slot]);

            const candidateAId = `cand-race-a-${suffix}`;
            const candidateBId = `cand-race-b-${suffix}`;
            await addProposedCandidate(offerId, candidateAId, `race-a-${suffix}@test.local`);
            await addProposedCandidate(offerId, candidateBId, `race-b-${suffix}@test.local`);

            const accessRepo = new InterviewAccessRepository();
            const sigA = `sig-race-a-${suffix}`.padEnd(64, '0');
            const sigB = `sig-race-b-${suffix}`.padEnd(64, '0');
            await accessRepo.create({
                signature: sigA,
                code: '555555',
                offer_uuid: offerId,
                candidate_id: candidateAId,
                rh_email: rh.email,
                expires_at: new Date(Date.now() + 60 * 60 * 1000),
            });
            await accessRepo.create({
                signature: sigB,
                code: '666666',
                offer_uuid: offerId,
                candidate_id: candidateBId,
                rh_email: rh.email,
                expires_at: new Date(Date.now() + 60 * 60 * 1000),
            });

            const [tokenA, tokenB] = await Promise.all(
                [
                    { sig: sigA, code: '555555' },
                    { sig: sigB, code: '666666' },
                ].map(async ({ sig, code }) => {
                    const res = await fetch(`${BASE}/${sig}/authenticate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ code }),
                    });
                    return (await res.json()).token as string;
                }),
            );

            const [resA, resB] = await Promise.all([
                fetch(`${BASE}/${sigA}/book`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
                    body: JSON.stringify({ slot }),
                }),
                fetch(`${BASE}/${sigB}/book`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
                    body: JSON.stringify({ slot }),
                }),
            ]);

            const statuses = [resA.status, resB.status].sort();
            expect(statuses).toEqual([200, 409]);
        });

        it('rejects booking a slot overlapping an RH busy period with 409', async () => {
            const suffix = Date.now() + 22;
            const rh = await createRhUser(suffix, true);
            const slot = '2030-07-01T09:00:00.000Z';
            const offerId = await seedJobWithSlots(suffix, [slot]);

            const candidateId = `cand-calbook-${suffix}`;
            await addProposedCandidate(offerId, candidateId, `calbook-${suffix}@test.local`);

            const accessRepo = new InterviewAccessRepository();
            const signature = `sig-calbook-${suffix}`.padEnd(64, '0');
            const code = '303030';
            await accessRepo.create({
                signature,
                code,
                offer_uuid: offerId,
                candidate_id: candidateId,
                rh_email: rh.email,
                expires_at: new Date(Date.now() + 60 * 60 * 1000),
            });

            const authRes = await fetch(`${BASE}/${signature}/authenticate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
            });
            const { token } = await authRes.json();

            // Le RH est occupé toute la journée du 2030-07-01.
            freeBusySpy.mockResolvedValue([{ start: '2030-07-01T00:00:00.000Z', end: '2030-07-02T00:00:00.000Z' }]);

            const bookRes = await fetch(`${BASE}/${signature}/book`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ slot }),
            });
            expect(bookRes.status).toBe(409);

            const jobRepo = new OfferRepository();
            const ctx = await jobRepo.findById(offerId);
            const candidate = ctx?.matching?.candidates?.find((c) => c.id === candidateId);
            expect(candidate?.booked_interview_slot).toBeUndefined();
        });

        it('books a slot when the RH has no busy period (freeBusy empty)', async () => {
            const suffix = Date.now() + 23;
            const rh = await createRhUser(suffix, true);
            const slot = '2030-07-15T09:00:00.000Z';
            const offerId = await seedJobWithSlots(suffix, [slot]);

            const candidateId = `cand-calfree-${suffix}`;
            await addProposedCandidate(offerId, candidateId, `calfree-${suffix}@test.local`);

            const accessRepo = new InterviewAccessRepository();
            const signature = `sig-calfree-${suffix}`.padEnd(64, '0');
            const code = '404040';
            await accessRepo.create({
                signature,
                code,
                offer_uuid: offerId,
                candidate_id: candidateId,
                rh_email: rh.email,
                expires_at: new Date(Date.now() + 60 * 60 * 1000),
            });

            const authRes = await fetch(`${BASE}/${signature}/authenticate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
            });
            const { token } = await authRes.json();

            const bookRes = await fetch(`${BASE}/${signature}/book`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ slot }),
            });
            expect(bookRes.status).toBe(200);
            expect(freeBusySpy).toHaveBeenCalled();

            const jobRepo = new OfferRepository();
            const ctx = await jobRepo.findById(offerId);
            const candidate = ctx?.matching?.candidates?.find((c) => c.id === candidateId);
            expect(candidate?.booked_interview_slot).toBe(slot);
        });
    });
});

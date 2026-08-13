import { OfferRepository } from '../repositories/mongo/OfferRepository';
import { InterviewAccessRepository } from '../repositories/mysql/InterviewAccessRepository';
import { InterviewAccessStatus } from '../types/interviewAccess.types';
import { generateSignature, generateNumericCode, timingSafeEqualString } from '../external/crypto';
import { issueInterviewToken } from './interviewToken';
import { CandidateHistoryService } from './CandidateHistoryService';
import { CandidateHistoryType } from '../types/candidate.types';
import { OfferHistoryService } from './OfferHistoryService';
import { MAX_ATTEMPTS, AuthResult, isSignedAccessExpired as isExpired } from './signedAccess';

export type { AuthResult };

const LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000; // candidate gets longer than the company's 72h

export interface SlotView {
    slot: string;
    taken: boolean;
}

export interface SlotsView {
    location?: string;
    slots: SlotView[];
    bookedSlot?: string;
}

export class SlotUnavailableError extends Error {}

function formatFr(iso: string): string {
    return new Date(iso).toLocaleString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
}

export class InterviewAccessService {
    constructor(
        private readonly repository = new InterviewAccessRepository(),
        private readonly offerRepository = new OfferRepository(),
        private readonly candidateHistoryService = new CandidateHistoryService(),
        private readonly offerHistoryService = new OfferHistoryService(),
    ) {}

    async createAccess(
        offerId: string,
        candidateId: string,
        rhEmail: string,
    ): Promise<{ signature: string; code: string }> {
        const signature = generateSignature();
        const code = generateNumericCode(6);
        await this.repository.create({
            signature,
            code,
            offer_uuid: offerId,
            candidate_id: candidateId,
            rh_email: rhEmail,
            expires_at: new Date(Date.now() + LINK_TTL_MS),
        });
        return { signature, code };
    }

    async inspect(
        signature: string,
    ): Promise<{ exists: boolean; expired: boolean; status: InterviewAccessStatus | null }> {
        const row = await this.repository.findBySignature(signature);
        if (!row) return { exists: false, expired: false, status: null };
        return { exists: true, expired: isExpired(row), status: row.status as InterviewAccessStatus };
    }

    async authenticate(signature: string, code: string): Promise<AuthResult> {
        const row = await this.repository.findBySignature(signature);
        if (!row || row.status === InterviewAccessStatus.LOCKED) return { ok: false, reason: 'locked' };
        if (isExpired(row)) return { ok: false, reason: 'expired' };

        if (!timingSafeEqualString(code, row.code)) return this.registerFailedAttempt(signature);

        await this.repository.setStatus(signature, InterviewAccessStatus.AUTHENTICATED);
        const expiresIn = Math.floor((new Date(row.expires_at).getTime() - Date.now()) / 1000);
        return { ok: true, token: issueInterviewToken(signature, row.offer_uuid, row.candidate_id, expiresIn) };
    }

    async getContext(signature: string): Promise<{
        rhEmail: string;
        offerUuid: string;
        needsAnalysisId?: string;
        candidateId: string;
        status: InterviewAccessStatus;
    } | null> {
        const row = await this.repository.findBySignature(signature);
        if (!row) return null;
        const offer = await this.offerRepository.findById(row.offer_uuid);
        return {
            rhEmail: row.rh_email,
            offerUuid: row.offer_uuid,
            needsAnalysisId: offer?.needs_analysis_id,
            candidateId: row.candidate_id,
            status: row.status as InterviewAccessStatus,
        };
    }

    async getSlots(signature: string, candidateId: string): Promise<SlotsView> {
        const row = await this.repository.findBySignature(signature);
        if (!row) throw new Error('Session not found');
        const offer = await this.offerRepository.findById(row.offer_uuid);
        const candidates = offer?.matching?.candidates ?? [];
        const taken = new Set(candidates.map((c) => c.booked_interview_slot).filter(Boolean));
        const slots = (offer?.matching?.interview_slots ?? []).map((slot) => ({ slot, taken: taken.has(slot) }));
        const bookedSlot = candidates.find((c) => c.id === candidateId)?.booked_interview_slot;
        return { location: offer?.matching?.interview_location, slots, bookedSlot };
    }

    async bookSlot(signature: string, candidateId: string, slot: string): Promise<void> {
        const row = await this.repository.findBySignature(signature);
        if (!row) throw new Error('Session not found');
        if (row.status === InterviewAccessStatus.COMPLETED) throw new Error('Session already completed');

        const offer = await this.offerRepository.bookInterviewSlot(row.offer_uuid, candidateId, slot);
        if (!offer) throw new SlotUnavailableError("Ce créneau n'est plus disponible");

        await this.candidateHistoryService.recordAuto(
            candidateId,
            CandidateHistoryType.CANDIDATE,
            `Le candidat a accepté l'entretien avec ${offer.company_infos?.name ?? "l'entreprise"} le ${formatFr(
                slot,
            )} à ${offer.matching?.interview_location ?? '—'}`,
        );
        await this.offerHistoryService.recordAuto(row.offer_uuid, `Créneau d'entretien réservé : ${formatFr(slot)}`);
        await this.repository.setStatus(signature, InterviewAccessStatus.COMPLETED);
    }

    private async registerFailedAttempt(signature: string): Promise<AuthResult> {
        const attempts = await this.repository.incrementAttempts(signature);
        if (attempts >= MAX_ATTEMPTS) {
            await this.repository.setStatus(signature, InterviewAccessStatus.LOCKED);
            return { ok: false, reason: 'locked' };
        }
        return { ok: false, reason: 'invalid', remaining: MAX_ATTEMPTS - attempts };
    }
}

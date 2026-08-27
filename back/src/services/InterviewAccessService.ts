import { OfferRepository } from '../repositories/mongo/OfferRepository';
import { InterviewAccessRepository } from '../repositories/mysql/InterviewAccessRepository';
import { InterviewAccessStatus } from '../types/interviewAccess.types';
import { generateSignature, generateNumericCode, timingSafeEqualString } from '../external/crypto';
import { issueInterviewToken } from './interviewToken';
import { CandidateHistoryService } from './CandidateHistoryService';
import { CandidateHistoryType } from '../types/candidate.types';
import { OfferHistoryService } from './OfferHistoryService';
import { MAX_ATTEMPTS, AuthResult, isSignedAccessExpired as isExpired } from './signedAccess';
import { UserService } from './UserService';
import { GoogleCalendarService, BusyInterval } from '../external/google/calendar.service';
import { GoogleTokens } from '../external/google/types';
import { User } from '../types/user.types';
import { logger } from '../external/logger';

export type { AuthResult };

const LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000; // candidate gets longer than the company's 72h

/** Marge de part et d'autre de la plage des créneaux pour la requête freebusy
 *  (couvre notamment les events journée entière aux bornes du fuseau de l'agenda). */
const FREEBUSY_PAD_MS = 60 * 60 * 1000;

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

/** Vrai si l'instant `slotMs` tombe dans un des intervalles occupés de l'agenda RH. */
function slotOverlapsBusy(slotMs: number, busy: BusyInterval[]): boolean {
    return busy.some((b) => {
        const bs = Date.parse(b.start);
        const be = Date.parse(b.end);
        return bs <= slotMs && slotMs < be;
    });
}

function formatFr(iso: string): string {
    return new Date(iso).toLocaleString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Indian/Reunion',
    });
}

export class InterviewAccessService {
    constructor(
        private readonly repository = new InterviewAccessRepository(),
        private readonly offerRepository = new OfferRepository(),
        private readonly candidateHistoryService = new CandidateHistoryService(),
        private readonly offerHistoryService = new OfferHistoryService(),
        private readonly userService = new UserService(),
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

    /**
     * Intervalles occupés de l'agenda du RH référent (résolu via `interview_access.rh_email`).
     * Best-effort : renvoie [] si le RH n'a pas d'agenda Google connecté ou si l'appel échoue,
     * pour ne jamais bloquer la réservation faute d'un calendrier lisible.
     */
    private async rhBusyIntervals(rhEmail: string, slots: string[]): Promise<BusyInterval[]> {
        const times = slots.map((s) => Date.parse(s)).filter((t) => !Number.isNaN(t));
        if (times.length === 0) return [];
        const timeMin = new Date(Math.min(...times) - FREEBUSY_PAD_MS).toISOString();
        const timeMax = new Date(Math.max(...times) + FREEBUSY_PAD_MS).toISOString();
        const rh = await this.userService.findByEmail(rhEmail);
        if (!rh?.oauthToken) return [];
        try {
            return await this.calendarForUser(rh).freeBusy(timeMin, timeMax);
        } catch (err) {
            logger.warn({ err }, '[interview] freebusy check failed, calendar validation skipped');
            return [];
        }
    }

    private calendarForUser(user: User): GoogleCalendarService {
        return GoogleCalendarService.fromTokens(
            { access_token: user.oauthToken ?? undefined, refresh_token: user.refreshToken ?? undefined },
            (refreshed: GoogleTokens) =>
                this.userService.updateGoogleTokens(
                    user.id,
                    refreshed.access_token ?? null,
                    refreshed.refresh_token ?? null,
                ),
        );
    }

    async getSlots(signature: string, candidateId: string): Promise<SlotsView> {
        const row = await this.repository.findBySignature(signature);
        if (!row) throw new Error('Session not found');
        const offer = await this.offerRepository.findById(row.offer_uuid);
        const candidates = offer?.matching?.candidates ?? [];
        const taken = new Set(candidates.map((c) => c.booked_interview_slot).filter(Boolean));
        const interviewSlots = offer?.matching?.interview_slots ?? [];
        const busy = await this.rhBusyIntervals(row.rh_email, interviewSlots);
        const slots = interviewSlots.map((slot) => ({
            slot,
            taken: taken.has(slot) || slotOverlapsBusy(Date.parse(slot), busy),
        }));
        const bookedSlot = candidates.find((c) => c.id === candidateId)?.booked_interview_slot;
        return { location: offer?.matching?.interview_location, slots, bookedSlot };
    }

    async bookSlot(signature: string, candidateId: string, slot: string): Promise<void> {
        const row = await this.repository.findBySignature(signature);
        if (!row) throw new Error('Session not found');
        if (row.status === InterviewAccessStatus.COMPLETED) throw new Error('Session already completed');

        // Revérifie côté serveur que le créneau n'est pas sur une période occupée de l'agenda
        // du RH (anti double-réservation avec des events posés après l'affichage des créneaux).
        const busy = await this.rhBusyIntervals(row.rh_email, [slot]);
        if (slotOverlapsBusy(Date.parse(slot), busy)) {
            throw new SlotUnavailableError("Ce créneau n'est plus disponible");
        }

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

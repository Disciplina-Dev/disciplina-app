import { GoogleCalendarService, BusyInterval } from '../external/google/calendar.service';
import { GoogleTokens } from '../external/google/types';
import { logger } from '../external/logger';
import { ExternalAccessRepository } from '../repositories/mysql/ExternalAccessRepository';
import { CandidateHistoryService } from './CandidateHistoryService';
import { CandidateHistoryType } from '../types/candidate.types';
import { ExternalAccessRow } from '../types/db-rows.types';
import { OfferHistoryService } from './OfferHistoryService';
import { OfferRepository } from '../repositories/mongo/OfferRepository';
import { User } from '../types/user.types';
import { UserService } from './UserService';

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

/** Session déjà complétée : la réservation d'un nouveau créneau est refusée. */
export class SessionAlreadyCompletedError extends Error {}

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
    });
}

/**
 * Réservation de créneau d'entretien par le candidat, branchée sur une session
 * `external_access` de référence 3 (INTERVIEW_SLOTS) : offer = external_id,
 * candidate = reference_key, RH = user_id. Remplace l'ancien workflow
 * `interview_access` / token Bearer par le modèle cookie EXTERNAL_GUEST.
 */
export class ExternalInterviewService {
    constructor(
        private readonly repository = new ExternalAccessRepository(),
        private readonly userService = new UserService(),
        private readonly offerRepository = new OfferRepository(),
        private readonly candidateHistoryService = new CandidateHistoryService(),
        private readonly offerHistoryService = new OfferHistoryService(),
    ) {}

    async getContext(
        signature: string,
    ): Promise<{
        rhEmail: string | null;
        offerUuid: string;
        needsAnalysisId?: string;
        candidateId: string;
        status: ExternalAccessRow['status'];
        referenceId: number;
    } | null> {
        const row = await this.repository.findBySignature(signature);
        if (!row) return null;
        const offer = await this.offerRepository.findById(row.external_id);
        const rh = await this.userService.findById(row.user_id);
        return {
            rhEmail: rh?.email ?? null,
            offerUuid: row.external_id,
            needsAnalysisId: offer?.needs_analysis_id,
            candidateId: row.reference_key,
            status: row.status,
            referenceId: row.reference_id,
        };
    }

    async getSlots(signature: string): Promise<SlotsView> {
        const row = await this.requireInterviewSession(signature);
        const offer = await this.offerRepository.findById(row.external_id);
        if (!offer) throw new Error('Session introuvable');

        const candidates = offer.matching?.candidates ?? [];
        const taken = new Set(candidates.map((c) => c.booked_interview_slot).filter(Boolean));
        const interviewSlots = offer.matching?.interview_slots ?? [];
        const busy = await this.rhBusyIntervals(row, interviewSlots);
        const slots = interviewSlots.map((slot) => ({
            slot,
            taken: taken.has(slot) || slotOverlapsBusy(Date.parse(slot), busy),
        }));
        const bookedSlot = candidates.find((c) => c.id === row.reference_key)?.booked_interview_slot;
        return { location: offer.matching?.interview_location, slots, bookedSlot };
    }

    async bookSlot(signature: string, slot: string): Promise<void> {
        const row = await this.requireInterviewSession(signature);
        if (row.status === 'COMPLETED') throw new SessionAlreadyCompletedError('Session already completed');

        // Revérifie côté serveur que le créneau n'est pas sur une période occupée de l'agenda
        // du RH (anti double-réservation avec des events posés après l'affichage des créneaux).
        const busy = await this.rhBusyIntervals(row, [slot]);
        if (slotOverlapsBusy(Date.parse(slot), busy)) {
            throw new SlotUnavailableError("Ce créneau n'est plus disponible");
        }

        const offer = await this.offerRepository.bookInterviewSlot(row.external_id, row.reference_key, slot);
        if (!offer) throw new SlotUnavailableError("Ce créneau n'est plus disponible");

        await this.candidateHistoryService.recordAuto(
            row.reference_key,
            CandidateHistoryType.CANDIDATE,
            `Le candidat a accepté l'entretien avec ${offer.company_infos?.name ?? "l'entreprise"} le ${formatFr(
                slot,
            )} à ${offer.matching?.interview_location ?? '—'}`,
        );
        await this.offerHistoryService.recordAuto(row.external_id, `Créneau d'entretien réservé : ${formatFr(slot)}`);
        await this.repository.setStatus(signature, 'COMPLETED');
    }

    private async requireInterviewSession(signature: string): Promise<ExternalAccessRow> {
        const row = await this.repository.findBySignature(signature);
        if (!row) throw new Error('Session not found');
        if (row.reference_id !== 3) throw new Error('Session non conforme');
        return row;
    }

    /**
     * Intervalles occupés de l'agenda du RH référent (résolu via `external_access.user_id`).
     * Best-effort : renvoie [] si le RH n'a pas d'agenda Google connecté ou si l'appel échoue,
     * pour ne jamais bloquer la réservation faute d'un calendrier lisible.
     */
    private async rhBusyIntervals(row: ExternalAccessRow, slots: string[]): Promise<BusyInterval[]> {
        const times = slots.map((s) => Date.parse(s)).filter((t) => !Number.isNaN(t));
        if (times.length === 0) return [];
        const timeMin = new Date(Math.min(...times) - FREEBUSY_PAD_MS).toISOString();
        const timeMax = new Date(Math.max(...times) + FREEBUSY_PAD_MS).toISOString();
        const rh = await this.userService.findById(row.user_id);
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
}
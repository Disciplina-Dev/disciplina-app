import { OfferRepository } from '../repositories/mongo/OfferRepository';
import { Offer } from '../types/offer.types';
import { ExternalAccessRepository } from '../repositories/mysql/ExternalAccessRepository';
import { ExternalAccessRow } from '../types/db-rows.types';
import { ExternalAccessService } from './ExternalAccessService';
import { MatchedCandidateStatus, MatchingCandidate } from '../types/matching.types';
import { CandidateHistoryService } from './CandidateHistoryService';
import { CandidateHistoryType } from '../types/candidate.types';
import { OfferHistoryService } from './OfferHistoryService';
import { InterviewMailService } from './InterviewMailService';
import { TodoService } from './TodoService';
import { UserRepository } from '../repositories/mysql/UserRepository';

/** Session déjà complétée : toute action de soumission est refusée. */
export class SessionAlreadyCompletedError extends Error {}

// Réponses possibles de l'entreprise sur le lien externe : refuser, garder pour
// entretien, ou coup de cœur (fast-track immersion).
const COMPANY_ANSWER_STATUSES = [
    MatchedCandidateStatus.REFUSED,
    MatchedCandidateStatus.INTERVIEW,
    MatchedCandidateStatus.IMMERSING,
];

export interface CreateSessionInput {
    offerId: string;
    rhUserId: number;
    rhEmail: string;
    companyEmail: string;
    companyName?: string;
    candidates: { id: string; description?: string }[];
}

export interface SessionCredentials {
    signature: string;
    link: string;
    rhEmail: string;
    companyEmail: string;
    offerUuid: string;
}

export interface AnswerInput {
    candidateId: string;
    status: MatchedCandidateStatus;
    interviewSlots?: string[];
    interviewLocation?: string;
    comment?: string;
}

function buildProposedCandidates(offer: Offer, inputs: CreateSessionInput['candidates']): MatchingCandidate[] {
    const candidates = offer.matching?.candidates ?? [];
    const accepted = new Map(
        candidates
            .filter((c: MatchingCandidate) => c.status === MatchedCandidateStatus.ACCEPTED)
            .map((c: MatchingCandidate) => [c.id, c]),
    );
    return inputs.map((input) => {
        const candidate = accepted.get(input.id);
        if (!candidate) throw new Error(`Candidate ${input.id} is not an accepted candidate of this job`);
        return { ...candidate, description: input.description ?? '' };
    });
}

function validateAnswers(answers: AnswerInput[], proposedIds: Set<string>): void {
    const allowed = new Set<MatchedCandidateStatus>(COMPANY_ANSWER_STATUSES);
    let favorites = 0;
    for (const answer of answers) {
        if (!proposedIds.has(answer.candidateId)) throw new Error('Unknown candidate in answers');
        if (!allowed.has(answer.status)) throw new Error('Invalid answer status');
        if (answer.status === MatchedCandidateStatus.IMMERSING) favorites++;
    }
    if (favorites > 1) throw new Error('Only one FAVORITE allowed');
}

export class MatchAccessService {
    constructor(
        private readonly externalAccessRepository = new ExternalAccessRepository(),
        private readonly externalAccessService = new ExternalAccessService(),
        private readonly offerRepository = new OfferRepository(),
        private readonly candidateHistoryService = new CandidateHistoryService(),
        private readonly offerHistoryService = new OfferHistoryService(),
        private readonly interviewMailService = new InterviewMailService(),
        private readonly todoService = new TodoService(),
        private readonly userRepository = new UserRepository(),
    ) {}

    async createSession(input: CreateSessionInput): Promise<SessionCredentials> {
        const offer = await this.offerRepository.findById(input.offerId);
        if (!offer) throw new Error('Offer not found');

        const proposed = buildProposedCandidates(offer, input.candidates);
        await this.offerRepository.setProposedCandidates(input.offerId, proposed);
        for (const candidate of proposed) {
            await this.candidateHistoryService.recordAuto(
                candidate.id,
                CandidateHistoryType.RH,
                `Le CV du candidat a été envoyé à ${offer.company_infos?.name ?? ''} en attente de réponse`,
            );
        }
        const count = proposed.length;
        const plural = count > 1 ? 's' : '';
        await this.offerHistoryService.recordAuto(
            input.offerId,
            `Session de sélection créée : ${count} candidat${plural} proposé${plural} à l’entreprise`,
        );

        const invite = await this.externalAccessService.createInvite({
            userId: input.rhUserId,
            externalId: input.offerId,
            externalType: 'COMPANY',
            externalEmail: input.companyEmail,
            externalFirstName: input.companyName ?? offer.company_infos?.name ?? 'Client',
            referenceId: 2,
            referenceKey: input.offerId,
        });
        if (!invite.success) throw new Error('Session de sélection non créée');

        return {
            signature: invite.signature,
            link: invite.link,
            rhEmail: input.rhEmail,
            companyEmail: input.companyEmail,
            offerUuid: input.offerId,
        };
    }

    async getContext(
        signature: string,
    ): Promise<{
        rhEmail: string | null;
        companyEmail: string | null;
        offerUuid: string;
        needsAnalysisId?: string;
        status: ExternalAccessRow['status'];
        referenceId: number;
    } | null> {
        const row = await this.externalAccessRepository.findBySignature(signature);
        if (!row) return null;
        const offer = await this.offerRepository.findById(row.reference_key);
        const rh = await this.userRepository.findById(row.user_id);
        return {
            rhEmail: rh?.email ?? null,
            companyEmail: row.external_email,
            offerUuid: row.reference_key,
            needsAnalysisId: offer?.needs_analysis_id,
            status: row.status,
            referenceId: row.reference_id,
        };
    }

    async getProposedCandidates(signature: string): Promise<MatchingCandidate[]> {
        const row = await this.externalAccessRepository.findBySignature(signature);
        if (!row) throw new Error('Session not found');
        const offer = await this.offerRepository.findById(row.reference_key);
        return (
            offer?.matching?.candidates?.filter((c: MatchingCandidate) => c.status === MatchedCandidateStatus.SEND) ??
            []
        );
    }

    async submitAnswers(signature: string, answers: AnswerInput[]): Promise<void> {
        const row = await this.externalAccessRepository.findBySignature(signature);
        if (!row) throw new Error('Session not found');
        if (row.status === 'COMPLETED') throw new SessionAlreadyCompletedError('Session already completed');
        if (row.reference_id !== 2) throw new Error('Session non conforme');

        const offer = await this.offerRepository.findById(row.reference_key);
        if (!offer) throw new Error('Offer not found');
        const proposedIds = new Set<string>(
            (offer.matching?.candidates ?? [])
                .filter((c: MatchingCandidate) => c.status === MatchedCandidateStatus.SEND)
                .map((c: MatchingCandidate) => c.id),
        );
        validateAnswers(answers, proposedIds);

        const slotsAnswer = answers.find((a) => a.interviewSlots?.length);
        if (slotsAnswer?.interviewSlots) {
            await this.offerRepository.setOfferInterviewSlots(
                row.reference_key,
                slotsAnswer.interviewSlots,
                slotsAnswer.interviewLocation,
            );
        }

        for (const answer of answers) {
            await this.offerRepository.setProposedCandidateStatus(
                row.reference_key,
                answer.candidateId,
                answer.status,
                answer.comment,
            );
            await this.candidateHistoryService.recordAuto(
                answer.candidateId,
                CandidateHistoryType.COMPANY,
                this.buildProposedAnswerLabel(answer.status),
            );
            const candidate = offer.matching?.candidates?.find((c: MatchingCandidate) => c.id === answer.candidateId);
            await this.offerHistoryService.recordAuto(
                row.reference_key,
                `Réponse de l’entreprise pour ${candidate?.full_name ?? 'un candidat'} : ${this.buildOfferAnswerLabel(
                    answer.status,
                )}`,
            );
            if (answer.status === MatchedCandidateStatus.REFUSED && answer.comment) {
                await this.candidateHistoryService.recordAuto(
                    answer.candidateId,
                    CandidateHistoryType.COMPANY,
                    `Motif du refus : ${answer.comment}`,
                );
            }
            if (
                answer.status === MatchedCandidateStatus.INTERVIEW ||
                answer.status === MatchedCandidateStatus.IMMERSING
            ) {
                await this.notifyRhCandidateKept(row.reference_key, answer.candidateId, offer.company_infos?.name);
                if (slotsAnswer?.interviewSlots?.length) {
                    await this.triggerInterviewAccess(
                        row.reference_key,
                        answer.candidateId,
                        row,
                        offer.company_infos?.name,
                    );
                }
            }
        }
        await this.externalAccessRepository.setStatus(signature, 'COMPLETED');
        await this.offerHistoryService.recordAuto(row.reference_key, 'Session de sélection complétée par l’entreprise');
    }

    // L'entreprise a fini son matching pour ce candidat : To-Do RH pour organiser
    // l'entretien / l'immersion puis en partager la conclusion.
    private async notifyRhCandidateKept(offerId: string, candidateId: string, companyName?: string): Promise<void> {
        const rhUsers = (await this.userRepository.findByRoleIds([2])) ?? [];
        const company = companyName ?? "l'entreprise";
        await Promise.all(
            rhUsers.map((user) =>
                this.todoService.createSystemTodo(
                    user.id,
                    `Organiser l'entretien du candidat retenu par ${company}`,
                    `interview:${offerId}:${candidateId}`,
                ),
            ),
        );
    }

    private async triggerInterviewAccess(
        offerId: string,
        candidateId: string,
        row: ExternalAccessRow,
        companyName?: string,
    ): Promise<void> {
        const offer = await this.offerRepository.findById(offerId);
        const candidate = offer?.matching?.candidates?.find((c: MatchingCandidate) => c.id === candidateId);
        if (!candidate?.email) return;

        const invite = await this.externalAccessService.createInvite({
            userId: row.user_id,
            externalId: offerId,
            externalType: 'CANDIDATE',
            externalEmail: candidate.email,
            externalFirstName: candidate.full_name?.trim().split(' ')[0] || 'Candidat',
            referenceId: 3,
            referenceKey: candidateId,
        });
        if (!invite.success) return;

        const rh = await this.userRepository.findById(row.user_id);
        if (!rh?.email) return;
        await this.interviewMailService.sendInvitation(
            rh.email,
            candidate.email,
            companyName ?? "l'entreprise",
            invite.signature,
        );
    }

    private buildProposedAnswerLabel(status: MatchedCandidateStatus): string {
        switch (status) {
            case MatchedCandidateStatus.REFUSED:
                return "L'entreprise a refusé le candidat";
            case MatchedCandidateStatus.IMMERSING:
                return "Le candidat est le coup de cœur de l'entreprise";
            default:
                return "L'entreprise garde le candidat pour un entretien";
        }
    }

    private buildOfferAnswerLabel(status: MatchedCandidateStatus): string {
        switch (status) {
            case MatchedCandidateStatus.REFUSED:
                return 'candidat refusé';
            case MatchedCandidateStatus.IMMERSING:
                return 'coup de cœur (immersion proposée)';
            default:
                return 'candidat retenu pour un entretien';
        }
    }
}
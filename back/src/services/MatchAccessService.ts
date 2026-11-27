import { OfferRepository } from '../repositories/mongo/OfferRepository';
import { Offer } from '../types/offer.types';
import { CandidateRepository } from '../repositories/mongo/CandidateRepository';
import { ExternalAccessRepository } from '../repositories/mysql/ExternalAccessRepository';
import { ExternalAccessRow } from '../types/db-rows.types';
import { ExternalAccessService } from './ExternalAccessService';
import { MatchedCandidateStatus, MatchingCandidate } from '../types/matching.types';
import { CandidateHistoryService } from './CandidateHistoryService';
import { CandidateService } from './CandidateService';
import { CandidateHistoryType } from '../types/candidate.types';
import { OfferHistoryService } from './OfferHistoryService';
import { InterviewMailService } from './InterviewMailService';
import { TodoService } from './TodoService';
import { NotificationService } from './NotificationService';
import { UserRepository } from '../repositories/mysql/UserRepository';
import { ConsentType, hasConsent } from './consentGuard';
import { buildMatchingLink } from '../utils/matchingLink';

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
    /** Copies carbone du mail d'invitation (non stockées, transmises au mail uniquement). */
    cc?: string[];
    candidates: { id: string; description?: string }[];
}

export interface SessionCredentials {
    signature: string;
    link: string;
    rhEmail: string;
    companyEmail: string;
    cc?: string[];
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
        private readonly candidateRepository = new CandidateRepository(),
        private readonly notificationService = new NotificationService(),
        private readonly candidateService = new CandidateService(),
    ) {}

    async createSession(input: CreateSessionInput): Promise<SessionCredentials> {
        const offer = await this.offerRepository.findById(input.offerId);
        if (!offer) throw new Error('Offer not found');

        const proposed = buildProposedCandidates(offer, input.candidates);
        await this.assertSharingConsent(proposed);
        await this.persistProposedDescriptions(proposed, input.candidates);
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
            cc: input.cc?.length ? input.cc : undefined,
            offerUuid: input.offerId,
        };
    }

    /**
     * Garde-fou RGPD : la vue entreprise (`GET match/candidates`) exclut les
     * candidats sans consentement `data_sharing`. Échouer ici avec un message
     * explicite plutôt que de créer une session qui afficherait
     * « Aucun candidat à afficher » côté entreprise.
     */
    private async assertSharingConsent(proposed: MatchingCandidate[]): Promise<void> {
        const docs = proposed.length
            ? await this.candidateRepository.findConsentmentsByIds(proposed.map((c) => c.id))
            : [];
        const byId = new Map(docs.map((doc) => [String(doc._id), doc]));
        const missing = proposed.filter((candidate) => {
            const doc = byId.get(candidate.id);
            return !doc || !hasConsent(doc, [ConsentType.DATA_SHARING]);
        });
        if (missing.length > 0) {
            const names = missing.map((c) => c.full_name ?? c.id).join(', ');
            throw new Error(
                `Consentement de partage manquant (data_sharing) pour : ${names}. ` +
                    'Recueillez leur consentement avant de les proposer à l’entreprise.',
            );
        }
    }

    /**
     * La description éditée dans la modale de proposition est désormais celle de
     * la fiche candidat : on la persiste (source `manual`). Une description
     * verrouillée est immuable — on réutilise alors le texte de la fiche pour la
     * proposition au lieu de le modifier.
     */
    private async persistProposedDescriptions(
        proposed: MatchingCandidate[],
        inputs: CreateSessionInput['candidates'],
    ): Promise<void> {
        const inputById = new Map(inputs.map((candidate) => [candidate.id, candidate]));
        for (const candidate of proposed) {
            const input = inputById.get(candidate.id);
            if (!input) continue;
            const state = await this.candidateService.getDescriptionState(candidate.id);
            if (!state) continue;
            if (state.locked) {
                candidate.description = state.description ?? '';
                continue;
            }
            if (input.description === undefined) continue;
            if ((state.description ?? '').trim() === input.description.trim()) continue;
            await this.candidateService.saveDescriptionFromProposal(candidate.id, input.description);
        }
    }

    async getContext(signature: string): Promise<{
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
                await this.notifyRhCandidateKept(
                    row.reference_key,
                    answer.candidateId,
                    answer.status,
                    offer.company_infos?.name,
                    candidate?.full_name,
                    offer.needs_analysis_id,
                );
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
    // l'entretien / l'immersion puis en partager la conclusion, et notification
    // in-app pour que toute l'équipe RH voie la réponse sans attendre la To-Do.
    private async notifyRhCandidateKept(
        offerId: string,
        candidateId: string,
        status: MatchedCandidateStatus,
        companyName?: string,
        candidateName?: string,
        needsAnalysisId?: string | null,
    ): Promise<void> {
        const rhUsers = (await this.userRepository.findByRoleIds([2])) ?? [];
        const company = companyName ?? "l'entreprise";
        const name = candidateName ?? 'Un candidat';
        const favorite = status === MatchedCandidateStatus.IMMERSING;
        const link = buildMatchingLink(offerId, needsAnalysisId);
        await Promise.all(
            rhUsers.map(async (user) => {
                await this.todoService.createSystemTodo(
                    user.id,
                    `Organiser l'entretien du candidat retenu par ${company}`,
                    `interview:${offerId}:${candidateId}`,
                );
                await this.notificationService.create({
                    userId: user.id,
                    type: favorite ? 'company_candidate_favorite' : 'company_interview_request',
                    category: 'candidate',
                    level: favorite ? 'success' : 'info',
                    title: favorite ? "Coup de cœur de l'entreprise" : "Entretien demandé par l'entreprise",
                    message: favorite
                        ? `${company} a eu un coup de cœur pour ${name} (immersion proposée).`
                        : `${company} souhaite un entretien avec ${name}.`,
                    link,
                });
            }),
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

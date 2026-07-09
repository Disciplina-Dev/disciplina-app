import { OfferRepository } from '../repositories/mongo/OfferRepository';
import { Offer } from '../types/offer.types';
import { MatchLinkRepository } from '../repositories/mysql/MatchLinkRepository';
import { MatchLinkRow } from '../types/db-rows.types';
import { MatchLinkStatus } from '../types/matchLink.types';
import { MatchedCandidateStatus, MatchingCandidate, ProposedCandidateAnswer } from '../types/matching.types';
import { generateSignature, generateNumericCode, generateIdentifier, timingSafeEqualString } from '../external/crypto';
import { issueMatchToken } from './matchToken';
import { CandidateHistoryService } from './CandidateHistoryService';
import { CandidateHistoryType } from '../types/candidate.types';
import { InterviewAccessService } from './InterviewAccessService';
import { InterviewMailService } from './InterviewMailService';

const LINK_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 3;

export interface CreateSessionInput {
    offerId: string;
    rhEmail: string;
    companyEmail: string;
    candidates: { id: string; description?: string }[];
}

export interface SessionCredentials {
    signature: string;
    code: string;
    identifier: string;
    rhEmail: string;
    companyEmail: string;
    offerUuid: string;
}

export interface AnswerInput {
    candidateId: string;
    answer: ProposedCandidateAnswer;
    interviewSlots?: string[];
    interviewLocation?: string;
    comment?: string;
}

export type AuthResult =
    | { ok: true; token: string }
    | { ok: false; reason: 'invalid' | 'locked' | 'expired'; remaining?: number };

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
        return { ...candidate, description: input.description ?? '', answer: null };
    });
}

function isExpired(row: MatchLinkRow): boolean {
    return new Date(row.expires_at).getTime() < Date.now();
}

function validateAnswers(answers: AnswerInput[], proposedIds: Set<string>): void {
    const allowed = new Set(Object.values(ProposedCandidateAnswer));
    let favorites = 0;
    for (const answer of answers) {
        if (!proposedIds.has(answer.candidateId)) throw new Error('Unknown candidate in answers');
        if (!allowed.has(answer.answer)) throw new Error('Invalid answer status');
        if (answer.answer === ProposedCandidateAnswer.FAVORITE) favorites++;
    }
    if (favorites > 1) throw new Error('Only one FAVORITE allowed');
}

export class MatchLinkService {
    constructor(
        private readonly matchLinkRepository = new MatchLinkRepository(),
        private readonly offerRepository = new OfferRepository(),
        private readonly candidateHistoryService = new CandidateHistoryService(),
        private readonly interviewAccessService = new InterviewAccessService(),
        private readonly interviewMailService = new InterviewMailService(),
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

        const credentials = this.generateCredentials(input);
        await this.matchLinkRepository.create({
            signature: credentials.signature,
            code: credentials.code,
            identifier: credentials.identifier,
            rh_email: input.rhEmail,
            company_email: input.companyEmail,
            offer_uuid: input.offerId,
            expires_at: new Date(Date.now() + LINK_TTL_MS),
        });
        return credentials;
    }

    async inspect(signature: string): Promise<{ exists: boolean; expired: boolean; status: MatchLinkStatus | null }> {
        const row = await this.matchLinkRepository.findBySignature(signature);
        if (!row) return { exists: false, expired: false, status: null };
        return { exists: true, expired: isExpired(row), status: row.status as MatchLinkStatus };
    }

    async regenerate(signature: string): Promise<SessionCredentials | null> {
        const row = await this.matchLinkRepository.findBySignature(signature);
        if (!row) return null;

        const code = generateNumericCode(6);
        const identifier = generateIdentifier();
        await this.matchLinkRepository.regenerate(signature, code, identifier, new Date(Date.now() + LINK_TTL_MS));
        return {
            signature,
            code,
            identifier,
            rhEmail: row.rh_email,
            companyEmail: row.company_email,
            offerUuid: row.offer_uuid,
        };
    }

    async authenticate(signature: string, code: string, identifier: string): Promise<AuthResult> {
        const row = await this.matchLinkRepository.findBySignature(signature);
        if (!row || row.status === MatchLinkStatus.LOCKED) return { ok: false, reason: 'locked' };
        if (isExpired(row)) return { ok: false, reason: 'expired' };

        const matches = timingSafeEqualString(code, row.code) && timingSafeEqualString(identifier, row.identifier);
        if (!matches) return this.registerFailedAttempt(signature);

        await this.matchLinkRepository.setStatus(signature, MatchLinkStatus.AUTHENTICATED);
        const expiresIn = Math.floor((new Date(row.expires_at).getTime() - Date.now()) / 1000);
        return { ok: true, token: issueMatchToken(signature, row.offer_uuid, expiresIn) };
    }

    async getContext(
        signature: string,
    ): Promise<{ rhEmail: string; companyEmail: string; offerUuid: string; status: MatchLinkStatus } | null> {
        const row = await this.matchLinkRepository.findBySignature(signature);
        if (!row) return null;
        return {
            rhEmail: row.rh_email,
            companyEmail: row.company_email,
            offerUuid: row.offer_uuid,
            status: row.status as MatchLinkStatus,
        };
    }

    async getProposedCandidates(signature: string): Promise<MatchingCandidate[]> {
        const row = await this.matchLinkRepository.findBySignature(signature);
        if (!row) throw new Error('Session not found');
        const offer = await this.offerRepository.findById(row.offer_uuid);
        return (
            offer?.matching?.candidates?.filter(
                (c: MatchingCandidate) => c.status === MatchedCandidateStatus.OFFER_SEND,
            ) ?? []
        );
    }

    async submitAnswers(signature: string, answers: AnswerInput[]): Promise<void> {
        const row = await this.matchLinkRepository.findBySignature(signature);
        if (!row) throw new Error('Session not found');
        if (row.status === MatchLinkStatus.COMPLETED) throw new Error('Session already completed');

        const offer = await this.offerRepository.findById(row.offer_uuid);
        const proposedIds = new Set<string>(
            (offer?.matching?.candidates ?? [])
                .filter((c: MatchingCandidate) => c.status === MatchedCandidateStatus.OFFER_SEND)
                .map((c: MatchingCandidate) => c.id),
        );
        validateAnswers(answers, proposedIds);

        const slotsAnswer = answers.find((a) => a.interviewSlots?.length);
        if (slotsAnswer?.interviewSlots) {
            await this.offerRepository.setOfferInterviewSlots(
                row.offer_uuid,
                slotsAnswer.interviewSlots,
                slotsAnswer.interviewLocation,
            );
        }

        for (const answer of answers) {
            await this.offerRepository.setProposedCandidateAnswer(
                row.offer_uuid,
                answer.candidateId,
                answer.answer,
                answer.comment,
            );
            await this.candidateHistoryService.recordAuto(
                answer.candidateId,
                CandidateHistoryType.COMPANY,
                this.buildProposedAnswerLabel(answer.answer),
            );
            if (answer.answer === ProposedCandidateAnswer.REFUSED && answer.comment) {
                await this.candidateHistoryService.recordAuto(
                    answer.candidateId,
                    CandidateHistoryType.COMPANY,
                    `Motif du refus : ${answer.comment}`,
                );
            }
            if (
                (answer.answer === ProposedCandidateAnswer.ACCEPTED ||
                    answer.answer === ProposedCandidateAnswer.FAVORITE) &&
                slotsAnswer?.interviewSlots?.length
            ) {
                await this.triggerInterviewAccess(
                    row.offer_uuid,
                    answer.candidateId,
                    row.rh_email,
                    offer?.company_infos?.name,
                );
            }
        }
        await this.matchLinkRepository.setStatus(signature, MatchLinkStatus.COMPLETED);
    }

    private async triggerInterviewAccess(
        offerId: string,
        candidateId: string,
        rhEmail: string,
        companyName?: string,
    ): Promise<void> {
        const offer = await this.offerRepository.findById(offerId);
        const candidate = offer?.matching?.candidates?.find((c: MatchingCandidate) => c.id === candidateId);
        if (!candidate?.email) return;
        const { signature, code } = await this.interviewAccessService.createAccess(offerId, candidateId, rhEmail);
        await this.interviewMailService.sendInvitation(
            rhEmail,
            candidate.email,
            companyName ?? "l'entreprise",
            signature,
            code,
        );
    }

    private async registerFailedAttempt(signature: string): Promise<AuthResult> {
        const attempts = await this.matchLinkRepository.incrementAttempts(signature);
        if (attempts >= MAX_ATTEMPTS) {
            await this.matchLinkRepository.setStatus(signature, MatchLinkStatus.LOCKED);
            return { ok: false, reason: 'locked' };
        }
        return { ok: false, reason: 'invalid', remaining: MAX_ATTEMPTS - attempts };
    }

    private buildProposedAnswerLabel(answer: ProposedCandidateAnswer): string {
        switch (answer) {
            case ProposedCandidateAnswer.REFUSED:
                return "L'entreprise a refusé le candidat";
            case ProposedCandidateAnswer.FAVORITE:
                return "Le candidat est le coup de cœur de l'entreprise";
            default:
                return "L'entreprise a accepté le candidat en attente de la réponse du candidat";
        }
    }

    private generateCredentials(input: CreateSessionInput): SessionCredentials {
        return {
            signature: generateSignature(),
            code: generateNumericCode(6),
            identifier: generateIdentifier(),
            rhEmail: input.rhEmail,
            companyEmail: input.companyEmail,
            offerUuid: input.offerId,
        };
    }
}

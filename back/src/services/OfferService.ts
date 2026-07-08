import { NeedsAnalysisRepository, MatchingOfferContext } from '../repositories/mongo/NeedsAnalysisRepository';
import { CandidateRepository } from '../repositories/mongo/CandidateRepository';
import { NeedsAnalysis } from '../types/needsAnalysisNoSql.types';
import { toNeedsAnalysis } from './mappers/needsAnalysis.mapper';
import { CompaniesService } from './CompaniesService';
import { CandidateService } from './CandidateService';
import { Candidate, CandidateHistoryType, CandidateStatus } from '../types/candidate.types';
import { CandidateHistoryService } from './CandidateHistoryService';
import {
    InterviewConclusion,
    ImmersionConclusion,
    OfferStatus,
    MatchedCandidateStatus,
    MatchingCandidate,
    ProposedCandidateAnswer,
    Sex,
} from '../types/matching.types';
import { signMatchUrl } from '../external/crypto';
import { env } from '../config/env';
import { isInterviewDatePast } from '../utils/interview';

const INTERVIEW_CONCLUSION_TO_CANDIDATE_STATUS: Record<InterviewConclusion, CandidateStatus> = {
    [InterviewConclusion.REJECTED]: CandidateStatus.SEEKING,
    [InterviewConclusion.IMMERSING]: CandidateStatus.IMMERSING,
    [InterviewConclusion.CONTRACT]: CandidateStatus.CONTRACT,
};

const IMMERSION_CONCLUSION_TO_CANDIDATE_STATUS: Record<ImmersionConclusion, CandidateStatus> = {
    [ImmersionConclusion.REJECTED]: CandidateStatus.SEEKING,
    [ImmersionConclusion.CONTRACT]: CandidateStatus.CONTRACT,
};

function matchingCandidateToGql(mc: MatchingCandidate): object {
    return {
        id: mc.id,
        fullName: mc.full_name,
        age: mc.age,
        sex: mc.sex,
        city: mc.city,
        email: mc.email,
        phone: mc.phone,
        status: mc.status,
    };
}

function proposedCandidateToGql(pc: MatchingCandidate): object {
    return {
        ...matchingCandidateToGql(pc),
        description: pc.description,
        answer: pc.answer,
        comment: pc.comment,
        interviewLocation: pc.interview_location,
        bookedInterviewSlot: pc.booked_interview_slot,
        interviewConclusion: pc.interview_conclusion,
        immersionStartDate: pc.immersion_start_date,
        immersionEndDate: pc.immersion_end_date,
        immersionLocation: pc.immersion_location,
        immersionConclusion: pc.immersion_conclusion,
    };
}

function toGql(ctx: MatchingOfferContext, suggestedCandidates?: MatchingCandidate[]): object {
    const { analysis, offer } = ctx;
    const ageMin = offer.criteria?.age_min;
    const ageMax = offer.criteria?.age_max;
    const ageRange = ageMin != null && ageMax != null ? `${ageMin}-${ageMax}` : undefined;
    const candidates = offer.matching?.candidates ?? [];

    return {
        id: offer.id,
        companyName: analysis.company_infos?.name,
        ageRange,
        desiredTP: offer.tp_type,
        desiredSex: offer.criteria?.desired_sex ?? 'MIXTE',
        drivingLicencseB: offer.criteria?.driving_license ?? false,
        professionalExperience: offer.criteria?.experience_required ?? false,
        status: offer.matching?.status ?? OfferStatus.NOT_MATCHED,
        localisation: offer.localisation,
        sector: null,
        matched: false,
        matchedCandidate: candidates
            .filter((c) => c.status !== MatchedCandidateStatus.OFFER_SEND)
            .map(matchingCandidateToGql),
        suggestedCandidates: suggestedCandidates?.map(matchingCandidateToGql),
        proposedCandidate: candidates
            .filter((c) => c.status === MatchedCandidateStatus.OFFER_SEND)
            .map(proposedCandidateToGql),
        interviewSlots: offer.matching?.interview_slots,
        interviewLocation: offer.matching?.interview_location,
    };
}

function candidateToMatchingCandidate(c: Candidate): MatchingCandidate {
    return {
        id: c._id,
        full_name: c.identity.full_name,
        age: c.identity.age,
        city: c.identity.city,
        email: c.identity.email,
        phone: c.identity.phone,
        sex: c.identity.sex as Sex,
        status: MatchedCandidateStatus.RETAINED,
    };
}

function deriveJobStatus(matchedCandidates: MatchingCandidate[], currentStatus?: OfferStatus): OfferStatus {
    if (matchedCandidates.length === 0) return OfferStatus.NOT_MATCHED;

    const manualStages = [OfferStatus.CV_SEND, OfferStatus.IMMERSING, OfferStatus.CONTRACT];
    if (currentStatus && manualStages.includes(currentStatus)) return currentStatus;

    const hasAccepted = matchedCandidates.some((c) => c.status === MatchedCandidateStatus.ACCEPTED);
    return hasAccepted ? OfferStatus.MATCHED : OfferStatus.NOT_MATCHED;
}

export class OfferService {
    private needsAnalysisRepository = new NeedsAnalysisRepository();
    private candidateRepository = new CandidateRepository();
    private candidateService = new CandidateService();
    private candidateHistoryService = new CandidateHistoryService();
    private companiesService = new CompaniesService();

    async findAll(): Promise<object[]> {
        const contexts = await this.needsAnalysisRepository.listMatchingOffers();
        return contexts.map((ctx) => toGql(ctx));
    }

    async getCompanyInfo(offerId: string): Promise<object | null> {
        const ctx = await this.needsAnalysisRepository.findOfferById(offerId);
        if (!ctx) return null;

        const companyId = ctx.analysis.company_infos?.id;
        const companyName = ctx.analysis.company_infos?.name;
        const company = companyId ? await this.companiesService.findById(companyId) : null;
        const ab = toNeedsAnalysis(ctx.analysis);

        return { companyName: companyName ?? company?.name ?? null, company, ab };
    }

    async find(id: string): Promise<object | null> {
        const ctx = await this.needsAnalysisRepository.findOfferById(id);
        if (!ctx) return null;

        const { analysis, offer } = ctx;
        const filter: Record<string, any> = {};

        if (offer.tp_type) filter['tp_type'] = offer.tp_type;
        if (offer.criteria?.driving_license) filter['identity.driving_license_b'] = true;

        if (offer.criteria?.age_min != null && offer.criteria?.age_max != null) {
            filter['identity.age'] = { $gte: offer.criteria.age_min, $lte: offer.criteria.age_max };
        }

        if (offer.localisation?.length) filter['job_info.geographic_mobility'] = { $all: offer.localisation };

        const candidates = await this.candidateRepository.findByfilter(filter);
        const suggestedCandidates = candidates.map(candidateToMatchingCandidate);

        return toGql(ctx, suggestedCandidates);
    }

    async update(id: string, data: any): Promise<object | null> {
        if (data.status) {
            const ctx = await this.needsAnalysisRepository.setOfferStatus(id, data.status as OfferStatus);
            return ctx ? toGql(ctx) : null;
        }
        return null;
    }

    async delete(id: string): Promise<boolean> {
        return this.needsAnalysisRepository.deleteOffer(id);
    }

    async addCandidate(offerId: string, candidateId: string): Promise<object | null> {
        const candidate = await this.candidateRepository.findById(candidateId);
        if (!candidate) throw new Error('Candidat introuvable');

        const matchingCandidate = candidateToMatchingCandidate(candidate);
        const ctx = await this.needsAnalysisRepository.addMatchedCandidate(offerId, matchingCandidate);
        if (!ctx) return null;

        await this.candidateHistoryService.recordAuto(
            candidateId,
            CandidateHistoryType.RH,
            `Le candidat a été retenu pour ${ctx.analysis.company_infos?.name ?? ''}`,
        );

        const synced = await this.syncDerivedStatus(offerId, ctx);
        return toGql(synced);
    }

    async removeCandidate(offerId: string, candidateId: string): Promise<object | null> {
        const ctx = await this.needsAnalysisRepository.removeMatchedCandidate(offerId, candidateId);
        if (!ctx) return null;

        const synced = await this.syncDerivedStatus(offerId, ctx);
        return toGql(synced);
    }

    async unmatchAll(offerId: string): Promise<object | null> {
        const ctx = await this.needsAnalysisRepository.clearMatchedCandidates(offerId);
        return ctx ? toGql(ctx) : null;
    }

    async getMatchedOfferIds(candidateId: string): Promise<string[]> {
        return this.needsAnalysisRepository.findOfferIdsWithCandidate(candidateId);
    }

    async getCandidatePlacement(candidateId: string): Promise<object | null> {
        const placements = await this.needsAnalysisRepository.findPlacementOffers(candidateId);

        let contract: { ctx: MatchingOfferContext; pc: MatchingCandidate } | null = null;
        let immersion: { ctx: MatchingOfferContext; pc: MatchingCandidate } | null = null;
        for (const p of placements) {
            const pc = p.offer.matching?.candidates?.find((c) => c.id === candidateId);
            if (!pc) continue;
            if (
                pc.interview_conclusion === InterviewConclusion.CONTRACT ||
                pc.immersion_conclusion === ImmersionConclusion.CONTRACT
            ) {
                contract = { ctx: p, pc };
            } else if (
                pc.interview_conclusion === InterviewConclusion.IMMERSING &&
                pc.immersion_conclusion !== ImmersionConclusion.REJECTED
            ) {
                immersion = { ctx: p, pc };
            }
        }

        const hit = contract ?? immersion;
        if (!hit) return null;

        const kind = contract ? 'CONTRACT' : 'IMMERSING';
        let since: string | null = null;
        if (kind === 'IMMERSING') {
            since = hit.pc.immersion_start_date ?? null;
        } else {
            const entries = await this.candidateHistoryService.findByCandidate(candidateId);
            const company = hit.ctx.analysis.company_infos?.name;
            const entry = company ? entries.find((e) => e.description?.includes(`contrat avec ${company}`)) : undefined;
            since = entry?.created_at ? new Date(entry.created_at).toISOString() : null;
        }

        return {
            companyName: hit.ctx.analysis.company_infos?.name ?? null,
            kind,
            since,
            immersionEndDate: kind === 'IMMERSING' ? hit.pc.immersion_end_date ?? null : null,
        };
    }

    async updateMatchedCandidateStatus(offerId: string, candidateId: string, status: string): Promise<object | null> {
        const ctx = await this.needsAnalysisRepository.setMatchedCandidateStatus(
            offerId,
            candidateId,
            status as MatchedCandidateStatus,
        );
        if (!ctx) return null;

        const entry = this.candidateHistoryService.buildMatchedStatusHistoryEntry(
            status as MatchedCandidateStatus,
            ctx.analysis.company_infos?.name,
        );
        if (entry) await this.candidateHistoryService.recordAuto(candidateId, entry.type, entry.description);

        const synced = await this.syncDerivedStatus(offerId, ctx);
        return toGql(synced);
    }

    async addManualProposedCandidate(
        offerId: string,
        candidateId: string,
        interviewDate: string,
        interviewHour: string,
        interviewLocation: string,
        ownerEmail: string,
    ): Promise<object | null> {
        const ctx = await this.needsAnalysisRepository.findOfferById(offerId);
        if (!ctx) return null;

        const candidate = await this.candidateRepository.findById(candidateId);
        if (!candidate) throw new Error('Candidat introuvable');

        const proposed: MatchingCandidate = {
            ...candidateToMatchingCandidate(candidate),
            answer: ProposedCandidateAnswer.ACCEPTED,
            booked_interview_slot: new Date(`${interviewDate}T${interviewHour}`).toISOString(),
            interview_location: interviewLocation,
        };

        const updated = await this.needsAnalysisRepository.addProposedCandidate(offerId, proposed);
        if (!updated) return null;

        await this.candidateHistoryService.recordManual(
            candidateId,
            `Le candidat.e a un entretien avec ${
                ctx.analysis.company_infos?.name ?? ''
            } le ${interviewDate} à ${interviewLocation}`,
            ownerEmail,
        );

        return toGql(updated);
    }

    async addManualProposedCandidateForImmersion(
        offerId: string,
        candidateId: string,
        immersionStartDate: string,
        immersionEndDate: string,
        immersionLocation: string,
        ownerEmail: string,
    ): Promise<object | null> {
        const ctx = await this.needsAnalysisRepository.findOfferById(offerId);
        if (!ctx) return null;

        const candidate = await this.candidateRepository.findById(candidateId);
        if (!candidate) throw new Error('Candidat introuvable');

        const proposed: MatchingCandidate = {
            ...candidateToMatchingCandidate(candidate),
            answer: ProposedCandidateAnswer.ACCEPTED,
            immersion_start_date: immersionStartDate,
            immersion_end_date: immersionEndDate,
            immersion_location: immersionLocation,
        };

        const updated = await this.needsAnalysisRepository.addProposedCandidate(offerId, proposed);
        if (!updated) return null;

        await this.candidateService.update(candidateId, { status: CandidateStatus.IMMERSING });

        await this.candidateHistoryService.recordManual(
            candidateId,
            `Le candidat.e est en immersion chez ${
                ctx.analysis.company_infos?.name ?? ''
            } du ${immersionStartDate} au ${immersionEndDate}`,
            ownerEmail,
        );

        return toGql(updated);
    }

    async setInterviewConclusion(
        offerId: string,
        candidateId: string,
        conclusion: InterviewConclusion,
        immersionStartDate: string | undefined,
        immersionEndDate: string | undefined,
        ownerEmail: string,
    ): Promise<object | null> {
        const ctx = await this.needsAnalysisRepository.findOfferById(offerId);
        if (!ctx) return null;

        const proposed = ctx.offer.matching?.candidates?.find((c) => c.id === candidateId);
        if (!proposed) throw new Error('Candidat proposé introuvable');

        if (!isInterviewDatePast(proposed.booked_interview_slot)) {
            throw new Error("L'entretien n'a pas encore eu lieu");
        }

        if (conclusion === InterviewConclusion.IMMERSING && (!immersionStartDate || !immersionEndDate)) {
            throw new Error("Les dates d'immersion sont requises pour cette conclusion");
        }

        const updated = await this.needsAnalysisRepository.setProposedCandidateConclusion(
            offerId,
            candidateId,
            conclusion,
            immersionStartDate,
            immersionEndDate,
        );
        if (!updated) return null;

        await this.candidateService.update(candidateId, {
            status: INTERVIEW_CONCLUSION_TO_CANDIDATE_STATUS[conclusion],
        });

        const description = this.buildInterviewConclusionHistoryEntry(
            conclusion,
            proposed.full_name,
            ctx.analysis.company_infos?.name,
            immersionStartDate,
            immersionEndDate,
        );
        await this.candidateHistoryService.recordManual(candidateId, description, ownerEmail);

        return toGql(updated);
    }

    async setImmersionConclusion(
        offerId: string,
        candidateId: string,
        conclusion: ImmersionConclusion,
        ownerEmail: string,
    ): Promise<object | null> {
        const ctx = await this.needsAnalysisRepository.findOfferById(offerId);
        if (!ctx) return null;

        const proposed = ctx.offer.matching?.candidates?.find((c) => c.id === candidateId);
        if (!proposed) throw new Error('Candidat proposé introuvable');

        if (proposed.interview_conclusion !== InterviewConclusion.IMMERSING) {
            throw new Error("Ce candidat n'est pas en immersion");
        }

        const updated = await this.needsAnalysisRepository.setProposedCandidateImmersionConclusion(
            offerId,
            candidateId,
            conclusion,
        );
        if (!updated) return null;

        await this.candidateService.update(candidateId, {
            status: IMMERSION_CONCLUSION_TO_CANDIDATE_STATUS[conclusion],
        });

        const description = this.buildImmersionConclusionHistoryEntry(
            conclusion,
            proposed.full_name,
            ctx.analysis.company_infos?.name,
        );
        await this.candidateHistoryService.recordManual(candidateId, description, ownerEmail);

        return toGql(updated);
    }

    private buildImmersionConclusionHistoryEntry(
        conclusion: ImmersionConclusion,
        candidateName?: string,
        companyName?: string,
    ): string {
        switch (conclusion) {
            case ImmersionConclusion.REJECTED:
                return `L'immersion c'est soldée par un rejet entre ${candidateName} et ${companyName}`;
            case ImmersionConclusion.CONTRACT:
                return `L'immersion c'est soldée par un contrat avec ${companyName}`;
        }
    }

    private buildInterviewConclusionHistoryEntry(
        conclusion: InterviewConclusion,
        candidateName?: string,
        companyName?: string,
        immersionStartDate?: string,
        immersionEndDate?: string,
    ): string {
        switch (conclusion) {
            case InterviewConclusion.REJECTED:
                return `L'entretien c'est soldé par un rejet entre ${candidateName} et ${companyName}`;
            case InterviewConclusion.IMMERSING:
                return `L'entretien c'est soldé par une immersion du ${immersionStartDate} au ${immersionEndDate} avec ${companyName}`;
            case InterviewConclusion.CONTRACT:
                return `L'entretien c'est soldé par un contrat avec ${companyName}`;
        }
    }

    private async syncDerivedStatus(offerId: string, ctx: MatchingOfferContext): Promise<MatchingOfferContext> {
        const candidates = ctx.offer.matching?.candidates ?? [];
        const derived = deriveJobStatus(candidates, ctx.offer.matching?.status);
        if (derived === ctx.offer.matching?.status) return ctx;
        const updated = await this.needsAnalysisRepository.setOfferStatus(offerId, derived);
        return updated ?? ctx;
    }

    offerResponseLinks(offerId: string, candidateId: string): { ouiUrl: string; nonUrl: string } {
        const sigOui = signMatchUrl(offerId, candidateId, 'oui');
        const sigNon = signMatchUrl(offerId, candidateId, 'non');
        return {
            ouiUrl: `${env.APP_BASE_URL}/api/matching/response?offerId=${offerId}&candidateId=${candidateId}&answer=oui&sig=${sigOui}`,
            nonUrl: `${env.APP_BASE_URL}/api/matching/response?offerId=${offerId}&candidateId=${candidateId}&answer=non&sig=${sigNon}`,
        };
    }
}

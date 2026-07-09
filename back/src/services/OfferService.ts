import { OfferRepository } from '../repositories/mongo/OfferRepository';
import { NeedsAnalysisRepository } from '../repositories/mongo/NeedsAnalysisRepository';
import { CandidateRepository } from '../repositories/mongo/CandidateRepository';
import { Offer } from '../types/offer.types';
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

function toGql(offer: Offer, suggestedCandidates?: MatchingCandidate[]): object {
    const ageMin = offer.criteria?.age_min;
    const ageMax = offer.criteria?.age_max;
    const ageRange = ageMin != null && ageMax != null ? `${ageMin}-${ageMax}` : undefined;
    const candidates = offer.matching?.candidates ?? [];

    return {
        id: offer._id,
        companyName: offer.company_infos?.name,
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
    private offerRepository = new OfferRepository();
    private needsAnalysisRepository = new NeedsAnalysisRepository();
    private candidateRepository = new CandidateRepository();
    private candidateService = new CandidateService();
    private candidateHistoryService = new CandidateHistoryService();
    private companiesService = new CompaniesService();

    async findAll(): Promise<object[]> {
        const offers = await this.offerRepository.listMatchingOffers();
        return offers.map((offer) => toGql(offer));
    }

    async getCompanyInfo(offerId: string): Promise<object | null> {
        const offer = await this.offerRepository.findById(offerId);
        if (!offer) return null;

        const companyId = offer.company_infos?.id;
        const companyName = offer.company_infos?.name;
        const company = companyId ? await this.companiesService.findById(companyId) : null;
        const analysis = offer.needs_analysis_id
            ? await this.needsAnalysisRepository.findById(offer.needs_analysis_id)
            : null;
        const ab = analysis ? toNeedsAnalysis(analysis) : null;

        return { companyName: companyName ?? company?.name ?? null, company, ab };
    }

    async find(id: string): Promise<object | null> {
        const offer = await this.offerRepository.findById(id);
        if (!offer) return null;

        const filter: Record<string, any> = {};

        if (offer.tp_type) filter['tp_type'] = offer.tp_type;
        if (offer.criteria?.driving_license) filter['identity.driving_license_b'] = true;

        if (offer.criteria?.age_min != null && offer.criteria?.age_max != null) {
            filter['identity.age'] = { $gte: offer.criteria.age_min, $lte: offer.criteria.age_max };
        }

        if (offer.localisation?.length) filter['job_info.geographic_mobility'] = { $all: offer.localisation };

        const candidates = await this.candidateRepository.findByfilter(filter);
        const suggestedCandidates = candidates.map(candidateToMatchingCandidate);

        return toGql(offer, suggestedCandidates);
    }

    async update(id: string, data: any): Promise<object | null> {
        if (data.status) {
            const offer = await this.offerRepository.setOfferStatus(id, data.status as OfferStatus);
            return offer ? toGql(offer) : null;
        }
        return null;
    }

    async delete(id: string): Promise<boolean> {
        return this.offerRepository.deleteById(id);
    }

    async addCandidate(offerId: string, candidateId: string): Promise<object | null> {
        const candidate = await this.candidateRepository.findById(candidateId);
        if (!candidate) throw new Error('Candidat introuvable');

        const matchingCandidate = candidateToMatchingCandidate(candidate);
        const offer = await this.offerRepository.addMatchedCandidate(offerId, matchingCandidate);
        if (!offer) return null;

        await this.candidateHistoryService.recordAuto(
            candidateId,
            CandidateHistoryType.RH,
            `Le candidat a été retenu pour ${offer.company_infos?.name ?? ''}`,
        );

        const synced = await this.syncDerivedStatus(offerId, offer);
        return toGql(synced);
    }

    async removeCandidate(offerId: string, candidateId: string): Promise<object | null> {
        const offer = await this.offerRepository.removeMatchedCandidate(offerId, candidateId);
        if (!offer) return null;

        const synced = await this.syncDerivedStatus(offerId, offer);
        return toGql(synced);
    }

    async unmatchAll(offerId: string): Promise<object | null> {
        const offer = await this.offerRepository.clearMatchedCandidates(offerId);
        return offer ? toGql(offer) : null;
    }

    async getMatchedOfferIds(candidateId: string): Promise<string[]> {
        return this.offerRepository.findOfferIdsWithCandidate(candidateId);
    }

    async getCandidatePlacement(candidateId: string): Promise<object | null> {
        const placements = await this.offerRepository.findPlacementOffers(candidateId);

        let contract: { offer: Offer; pc: MatchingCandidate } | null = null;
        let immersion: { offer: Offer; pc: MatchingCandidate } | null = null;
        for (const offer of placements) {
            const pc = offer.matching?.candidates?.find((c) => c.id === candidateId);
            if (!pc) continue;
            if (
                pc.interview_conclusion === InterviewConclusion.CONTRACT ||
                pc.immersion_conclusion === ImmersionConclusion.CONTRACT
            ) {
                contract = { offer, pc };
            } else if (
                pc.interview_conclusion === InterviewConclusion.IMMERSING &&
                pc.immersion_conclusion !== ImmersionConclusion.REJECTED
            ) {
                immersion = { offer, pc };
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
            const company = hit.offer.company_infos?.name;
            const entry = company ? entries.find((e) => e.description?.includes(`contrat avec ${company}`)) : undefined;
            since = entry?.created_at ? new Date(entry.created_at).toISOString() : null;
        }

        return {
            companyName: hit.offer.company_infos?.name ?? null,
            kind,
            since,
            immersionEndDate: kind === 'IMMERSING' ? hit.pc.immersion_end_date ?? null : null,
        };
    }

    async updateMatchedCandidateStatus(offerId: string, candidateId: string, status: string): Promise<object | null> {
        const offer = await this.offerRepository.setMatchedCandidateStatus(
            offerId,
            candidateId,
            status as MatchedCandidateStatus,
        );
        if (!offer) return null;

        const entry = this.candidateHistoryService.buildMatchedStatusHistoryEntry(
            status as MatchedCandidateStatus,
            offer.company_infos?.name,
        );
        if (entry) await this.candidateHistoryService.recordAuto(candidateId, entry.type, entry.description);

        const synced = await this.syncDerivedStatus(offerId, offer);
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
        const offer = await this.offerRepository.findById(offerId);
        if (!offer) return null;

        const candidate = await this.candidateRepository.findById(candidateId);
        if (!candidate) throw new Error('Candidat introuvable');

        const proposed: MatchingCandidate = {
            ...candidateToMatchingCandidate(candidate),
            answer: ProposedCandidateAnswer.ACCEPTED,
            booked_interview_slot: new Date(`${interviewDate}T${interviewHour}`).toISOString(),
            interview_location: interviewLocation,
        };

        const updated = await this.offerRepository.addProposedCandidate(offerId, proposed);
        if (!updated) return null;

        await this.candidateHistoryService.recordManual(
            candidateId,
            `Le candidat.e a un entretien avec ${
                offer.company_infos?.name ?? ''
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
        const offer = await this.offerRepository.findById(offerId);
        if (!offer) return null;

        const candidate = await this.candidateRepository.findById(candidateId);
        if (!candidate) throw new Error('Candidat introuvable');

        const proposed: MatchingCandidate = {
            ...candidateToMatchingCandidate(candidate),
            answer: ProposedCandidateAnswer.ACCEPTED,
            immersion_start_date: immersionStartDate,
            immersion_end_date: immersionEndDate,
            immersion_location: immersionLocation,
        };

        const updated = await this.offerRepository.addProposedCandidate(offerId, proposed);
        if (!updated) return null;

        await this.candidateService.update(candidateId, { status: CandidateStatus.IMMERSING });

        await this.candidateHistoryService.recordManual(
            candidateId,
            `Le candidat.e est en immersion chez ${
                offer.company_infos?.name ?? ''
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
        const offer = await this.offerRepository.findById(offerId);
        if (!offer) return null;

        const proposed = offer.matching?.candidates?.find((c) => c.id === candidateId);
        if (!proposed) throw new Error('Candidat proposé introuvable');

        if (!isInterviewDatePast(proposed.booked_interview_slot)) {
            throw new Error("L'entretien n'a pas encore eu lieu");
        }

        if (conclusion === InterviewConclusion.IMMERSING && (!immersionStartDate || !immersionEndDate)) {
            throw new Error("Les dates d'immersion sont requises pour cette conclusion");
        }

        const updated = await this.offerRepository.setProposedCandidateConclusion(
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
            offer.company_infos?.name,
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
        const offer = await this.offerRepository.findById(offerId);
        if (!offer) return null;

        const proposed = offer.matching?.candidates?.find((c) => c.id === candidateId);
        if (!proposed) throw new Error('Candidat proposé introuvable');

        if (proposed.interview_conclusion !== InterviewConclusion.IMMERSING) {
            throw new Error("Ce candidat n'est pas en immersion");
        }

        const updated = await this.offerRepository.setProposedCandidateImmersionConclusion(
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
            offer.company_infos?.name,
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

    private async syncDerivedStatus(offerId: string, offer: Offer): Promise<Offer> {
        const candidates = offer.matching?.candidates ?? [];
        const derived = deriveJobStatus(candidates, offer.matching?.status);
        if (derived === offer.matching?.status) return offer;
        const updated = await this.offerRepository.setOfferStatus(offerId, derived);
        return updated ?? offer;
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

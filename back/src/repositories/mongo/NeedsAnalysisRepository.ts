import { NeedsAnalysisModel } from '../../db/mongo/schemas/needsAnalysis.schema';
import { NeedsAnalysis, NeedsAnalysisStatus, Offer } from '../../types/needsAnalysisNoSql.types';
import {
    ImmersionConclusion,
    InterviewConclusion,
    OfferStatus,
    MatchedCandidateStatus,
    MatchingCandidate,
    ProposedCandidateAnswer,
} from '../../types/matching.types';

// Contexte renvoyé par les opérations de matching : l'offre ciblée et l'AB qui la
// porte (pour le nom d'entreprise, l'AB source, etc.).
export interface MatchingOfferContext {
    analysis: NeedsAnalysis;
    offer: Offer;
}

const PLACEMENT_CONCLUSIONS = [InterviewConclusion.IMMERSING, InterviewConclusion.CONTRACT];

function extractOffer(analysis: NeedsAnalysis | null, offerId: string): MatchingOfferContext | null {
    if (!analysis) return null;
    const offer = analysis.offers?.find((o) => o.id === offerId);
    return offer ? { analysis, offer } : null;
}

// Retire les champs de proposition d'un candidat rebasculé en simple « retenu ».
function resetProposal(candidate: MatchingCandidate): MatchingCandidate {
    const {
        description,
        cv_webview,
        answer,
        comment,
        interview_location,
        booked_interview_slot,
        interview_conclusion,
        immersion_start_date,
        immersion_end_date,
        immersion_location,
        immersion_conclusion,
        ...identity
    } = candidate;
    return { ...identity, status: MatchedCandidateStatus.ACCEPTED };
}

export class NeedsAnalysisRepository {
    async findAll(): Promise<NeedsAnalysis[]> {
        return NeedsAnalysisModel.find().lean();
    }

    async findById(id: string): Promise<NeedsAnalysis | null> {
        return NeedsAnalysisModel.findOne({ _id: id }).lean();
    }

    async findByCompanyId(companyId: number): Promise<NeedsAnalysis[]> {
        return NeedsAnalysisModel.find({ 'company_infos.id': companyId }).lean();
    }

    async findBySignatureRequestId(signatureRequestId: string): Promise<NeedsAnalysis | null> {
        return NeedsAnalysisModel.findOne({ signature_request_id: signatureRequestId }).lean();
    }

    async create(data: NeedsAnalysis): Promise<NeedsAnalysis> {
        const doc = new NeedsAnalysisModel(data);
        await doc.save();
        return doc.toObject() as NeedsAnalysis;
    }

    async update(id: string, data: Partial<NeedsAnalysis>): Promise<NeedsAnalysis | null> {
        const { _id, ...patch } = data;
        return NeedsAnalysisModel.findOneAndUpdate({ _id: id }, { $set: patch }, { new: true }).lean();
    }

    async delete(id: string): Promise<boolean> {
        return (await NeedsAnalysisModel.deleteOne({ _id: id })).deletedCount > 0;
    }

    // ---- Matching (ex-collection jobs, désormais offers[].matching) ----

    /** Offre de matching identifiée par son id stable, avec l'AB qui la porte. */
    async findOfferById(offerId: string): Promise<MatchingOfferContext | null> {
        const analysis = await NeedsAnalysisModel.findOne({ 'offers.id': offerId }).lean();
        return extractOffer(analysis, offerId);
    }

    /** Toutes les offres à matcher : AB déjà envoyées en signature (pas les brouillons). */
    async listMatchingOffers(): Promise<MatchingOfferContext[]> {
        const analyses = await NeedsAnalysisModel.find({ status: { $ne: NeedsAnalysisStatus.BROUILLON } }).lean();
        return analyses.flatMap((analysis) =>
            (analysis.offers ?? []).filter((offer: Offer) => offer.id).map((offer: Offer) => ({ analysis, offer })),
        );
    }

    async addMatchedCandidate(offerId: string, candidate: MatchingCandidate): Promise<MatchingOfferContext | null> {
        const analysis = await NeedsAnalysisModel.findOneAndUpdate(
            { offers: { $elemMatch: { id: offerId, 'matching.candidates.id': { $ne: candidate.id } } } },
            { $push: { 'offers.$[o].matching.candidates': candidate } },
            { arrayFilters: [{ 'o.id': offerId }], new: true },
        ).lean();
        return extractOffer(analysis, offerId);
    }

    async removeMatchedCandidate(offerId: string, candidateId: string): Promise<MatchingOfferContext | null> {
        const analysis = await NeedsAnalysisModel.findOneAndUpdate(
            { 'offers.id': offerId },
            { $pull: { 'offers.$[o].matching.candidates': { id: candidateId } } },
            { arrayFilters: [{ 'o.id': offerId }], new: true },
        ).lean();
        return extractOffer(analysis, offerId);
    }

    async clearMatchedCandidates(offerId: string): Promise<MatchingOfferContext | null> {
        const analysis = await NeedsAnalysisModel.findOneAndUpdate(
            { 'offers.id': offerId },
            {
                $set: {
                    'offers.$[o].matching.candidates': [],
                    'offers.$[o].matching.status': OfferStatus.NOT_MATCHED,
                },
            },
            { arrayFilters: [{ 'o.id': offerId }], new: true },
        ).lean();
        return extractOffer(analysis, offerId);
    }

    async setMatchedCandidateStatus(
        offerId: string,
        candidateId: string,
        status: MatchedCandidateStatus,
    ): Promise<MatchingOfferContext | null> {
        const analysis = await NeedsAnalysisModel.findOneAndUpdate(
            { offers: { $elemMatch: { id: offerId, 'matching.candidates.id': candidateId } } },
            { $set: { 'offers.$[o].matching.candidates.$[c].status': status } },
            { arrayFilters: [{ 'o.id': offerId }, { 'c.id': candidateId }], new: true },
        ).lean();
        return extractOffer(analysis, offerId);
    }

    async setOfferStatus(offerId: string, status: OfferStatus): Promise<MatchingOfferContext | null> {
        const analysis = await NeedsAnalysisModel.findOneAndUpdate(
            { 'offers.id': offerId },
            { $set: { 'offers.$[o].matching.status': status } },
            { arrayFilters: [{ 'o.id': offerId }], new: true },
        ).lean();
        return extractOffer(analysis, offerId);
    }

    /**
     * Marque le sous-ensemble proposé (status OFFER_SEND + champs de proposition) et
     * rebascule les anciens proposés hors liste en simples retenus. Passe l'offre en CV_SEND.
     */
    async setProposedCandidates(offerId: string, proposed: MatchingCandidate[]): Promise<MatchingOfferContext | null> {
        const context = await this.findOfferById(offerId);
        if (!context) return null;

        const proposedById = new Map(proposed.map((candidate) => [candidate.id, candidate]));
        const merged = (context.offer.matching?.candidates ?? []).map((candidate) => {
            const update = proposedById.get(candidate.id);
            if (update) return { ...candidate, ...update, status: MatchedCandidateStatus.OFFER_SEND };
            return candidate.status === MatchedCandidateStatus.OFFER_SEND ? resetProposal(candidate) : candidate;
        });
        for (const candidate of proposed) {
            if (!merged.some((existing) => existing.id === candidate.id)) {
                merged.push({ ...candidate, status: MatchedCandidateStatus.OFFER_SEND });
            }
        }

        const analysis = await NeedsAnalysisModel.findOneAndUpdate(
            { 'offers.id': offerId },
            { $set: { 'offers.$[o].matching.candidates': merged, 'offers.$[o].matching.status': OfferStatus.CV_SEND } },
            { arrayFilters: [{ 'o.id': offerId }], new: true },
        ).lean();
        return extractOffer(analysis, offerId);
    }

    /** Ajoute (ou met à jour) un candidat proposé — utilisé pour la proposition manuelle. */
    async addProposedCandidate(offerId: string, candidate: MatchingCandidate): Promise<MatchingOfferContext | null> {
        const updated = await NeedsAnalysisModel.findOneAndUpdate(
            { offers: { $elemMatch: { id: offerId, 'matching.candidates.id': candidate.id } } },
            { $set: { 'offers.$[o].matching.candidates.$[c]': candidate } },
            { arrayFilters: [{ 'o.id': offerId }, { 'c.id': candidate.id }], new: true },
        ).lean();
        if (updated) return extractOffer(updated, offerId);

        const pushed = await NeedsAnalysisModel.findOneAndUpdate(
            { offers: { $elemMatch: { id: offerId, 'matching.candidates.id': { $ne: candidate.id } } } },
            { $push: { 'offers.$[o].matching.candidates': candidate } },
            { arrayFilters: [{ 'o.id': offerId }], new: true },
        ).lean();
        return extractOffer(pushed, offerId);
    }

    async setProposedCandidateAnswer(
        offerId: string,
        candidateId: string,
        answer: ProposedCandidateAnswer,
        comment?: string,
    ): Promise<MatchingOfferContext | null> {
        const update: Record<string, unknown> = { 'offers.$[o].matching.candidates.$[c].answer': answer };
        if (comment) update['offers.$[o].matching.candidates.$[c].comment'] = comment;
        const analysis = await NeedsAnalysisModel.findOneAndUpdate(
            { offers: { $elemMatch: { id: offerId, 'matching.candidates.id': candidateId } } },
            { $set: update },
            { arrayFilters: [{ 'o.id': offerId }, { 'c.id': candidateId }], new: true },
        ).lean();
        return extractOffer(analysis, offerId);
    }

    async setProposedCandidateConclusion(
        offerId: string,
        candidateId: string,
        conclusion: InterviewConclusion,
        immersionStartDate?: string,
        immersionEndDate?: string,
    ): Promise<MatchingOfferContext | null> {
        const update: Record<string, unknown> = {
            'offers.$[o].matching.candidates.$[c].interview_conclusion': conclusion,
        };
        if (immersionStartDate)
            update['offers.$[o].matching.candidates.$[c].immersion_start_date'] = immersionStartDate;
        if (immersionEndDate) update['offers.$[o].matching.candidates.$[c].immersion_end_date'] = immersionEndDate;
        const analysis = await NeedsAnalysisModel.findOneAndUpdate(
            { offers: { $elemMatch: { id: offerId, 'matching.candidates.id': candidateId } } },
            { $set: update },
            { arrayFilters: [{ 'o.id': offerId }, { 'c.id': candidateId }], new: true },
        ).lean();
        return extractOffer(analysis, offerId);
    }

    async setProposedCandidateImmersionConclusion(
        offerId: string,
        candidateId: string,
        conclusion: ImmersionConclusion,
    ): Promise<MatchingOfferContext | null> {
        const analysis = await NeedsAnalysisModel.findOneAndUpdate(
            { offers: { $elemMatch: { id: offerId, 'matching.candidates.id': candidateId } } },
            { $set: { 'offers.$[o].matching.candidates.$[c].immersion_conclusion': conclusion } },
            { arrayFilters: [{ 'o.id': offerId }, { 'c.id': candidateId }], new: true },
        ).lean();
        return extractOffer(analysis, offerId);
    }

    async setOfferInterviewSlots(
        offerId: string,
        slots: string[],
        location?: string,
    ): Promise<MatchingOfferContext | null> {
        const update: Record<string, unknown> = { 'offers.$[o].matching.interview_slots': slots };
        if (location) update['offers.$[o].matching.interview_location'] = location;
        const analysis = await NeedsAnalysisModel.findOneAndUpdate(
            { 'offers.id': offerId },
            { $set: update },
            { arrayFilters: [{ 'o.id': offerId }], new: true },
        ).lean();
        return extractOffer(analysis, offerId);
    }

    /** Atomique, race-safe : échoue (null) si le créneau est déjà pris ou le candidat déjà placé/invalide. */
    async bookInterviewSlot(offerId: string, candidateId: string, slot: string): Promise<MatchingOfferContext | null> {
        const analysis = await NeedsAnalysisModel.findOneAndUpdate(
            {
                offers: {
                    $elemMatch: {
                        id: offerId,
                        'matching.interview_slots': slot,
                        'matching.candidates.booked_interview_slot': { $ne: slot },
                        'matching.candidates': {
                            $elemMatch: { id: candidateId, booked_interview_slot: { $exists: false } },
                        },
                    },
                },
            },
            { $set: { 'offers.$[o].matching.candidates.$[c].booked_interview_slot': slot } },
            { arrayFilters: [{ 'o.id': offerId }, { 'c.id': candidateId }], new: true },
        ).lean();
        return extractOffer(analysis, offerId);
    }

    /** Offres où le candidat a une conclusion d'entretien immersion ou contrat. */
    async findPlacementOffers(candidateId: string): Promise<MatchingOfferContext[]> {
        const analyses = await NeedsAnalysisModel.find({
            'offers.matching.candidates': {
                $elemMatch: { id: candidateId, interview_conclusion: { $in: PLACEMENT_CONCLUSIONS } },
            },
        }).lean();
        return analyses.flatMap((analysis) =>
            (analysis.offers ?? [])
                .filter(
                    (offer: Offer) =>
                        offer.matching?.candidates?.some(
                            (c: MatchingCandidate) =>
                                c.id === candidateId &&
                                c.interview_conclusion != null &&
                                PLACEMENT_CONCLUSIONS.includes(c.interview_conclusion),
                        ),
                )
                .map((offer: Offer) => ({ analysis, offer })),
        );
    }

    async findOfferIdsWithCandidate(candidateId: string): Promise<string[]> {
        const analyses = await NeedsAnalysisModel.find(
            { 'offers.matching.candidates.id': candidateId },
            { offers: 1 },
        ).lean();
        return analyses.flatMap((analysis) =>
            (analysis.offers ?? [])
                .filter(
                    (offer: Offer) => offer.matching?.candidates?.some((c: MatchingCandidate) => c.id === candidateId),
                )
                .map((offer: Offer) => offer.id!)
                .filter(Boolean),
        );
    }

    /** Initialise l'état de matching sur toutes les offres d'une AB (statut NOT_MATCHED, liste vide). */
    async initializeOfferMatching(analysisId: string): Promise<void> {
        await NeedsAnalysisModel.updateOne(
            { _id: analysisId },
            {
                $set: {
                    'offers.$[o].matching': {
                        status: OfferStatus.NOT_MATCHED,
                        candidates: [],
                        interview_slots: [],
                    },
                },
            },
            { arrayFilters: [{ 'o.id': { $exists: true } }] },
        );
    }

    /** Supprime une offre du tableau `offers` par son id. */
    async deleteOffer(offerId: string): Promise<boolean> {
        const result = await NeedsAnalysisModel.updateOne(
            { 'offers.id': offerId },
            { $pull: { offers: { id: offerId } } },
        );
        return result.modifiedCount > 0;
    }

    /** Vide le tableau `offers` de l'AB identifiée par `analysisId`. */
    async clearOffersByNeedsAnalysisId(analysisId: string): Promise<number> {
        const result = await NeedsAnalysisModel.updateOne({ _id: analysisId }, { $set: { offers: [] } });
        return result.modifiedCount;
    }
}

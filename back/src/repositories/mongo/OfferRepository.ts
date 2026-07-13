import { OfferModel } from '../../db/mongo/schemas/offer.schema';
import { Offer } from '../../types/offer.types';
import {
    ImmersionConclusion,
    InterviewConclusion,
    OfferStatus,
    MatchedCandidateStatus,
    MatchingCandidate,
} from '../../types/matching.types';

const PLACEMENT_CONCLUSIONS = [InterviewConclusion.IMMERSING, InterviewConclusion.CONTRACT];

// Retire les champs de proposition d'un candidat rebasculé en simple « retenu ».
function resetProposal(candidate: MatchingCandidate): MatchingCandidate {
    const {
        description,
        cv_webview,
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

export class OfferRepository {
    async findById(offerId: string): Promise<Offer | null> {
        return OfferModel.findOne({ _id: offerId }).lean();
    }

    async findByNeedsAnalysisId(needsAnalysisId: string): Promise<Offer[]> {
        return OfferModel.find({ needs_analysis_id: needsAnalysisId }).lean();
    }

    /** Toutes les offres à matcher : une offre n'existe qu'une fois l'AB envoyée en signature. */
    async listMatchingOffers(): Promise<Offer[]> {
        return OfferModel.find().lean();
    }

    /** Remplace le contenu (poste, entreprise, référents, saler) d'une offre sans toucher à `matching`. */
    async updateContent(offerId: string, offer: Partial<Offer>): Promise<Offer | null> {
        const { _id, matching, ...patch } = offer;
        return OfferModel.findOneAndUpdate({ _id: offerId }, { $set: patch }, { new: true }).lean();
    }

    async createMany(offers: Offer[]): Promise<Offer[]> {
        if (offers.length === 0) return [];
        const docs = await OfferModel.insertMany(offers);
        return docs.map((doc) => doc.toObject() as Offer);
    }

    async addMatchedCandidate(offerId: string, candidate: MatchingCandidate): Promise<Offer | null> {
        return OfferModel.findOneAndUpdate(
            { _id: offerId, 'matching.candidates.id': { $ne: candidate.id } },
            { $push: { 'matching.candidates': candidate } },
            { new: true },
        ).lean();
    }

    async removeMatchedCandidate(offerId: string, candidateId: string): Promise<Offer | null> {
        return OfferModel.findOneAndUpdate(
            { _id: offerId },
            { $pull: { 'matching.candidates': { id: candidateId } } },
            { new: true },
        ).lean();
    }

    async clearMatchedCandidates(offerId: string): Promise<Offer | null> {
        return OfferModel.findOneAndUpdate(
            { _id: offerId },
            { $set: { 'matching.candidates': [], 'matching.status': OfferStatus.NOT_MATCHED } },
            { new: true },
        ).lean();
    }

    async setMatchedCandidateStatus(
        offerId: string,
        candidateId: string,
        status: MatchedCandidateStatus,
    ): Promise<Offer | null> {
        return OfferModel.findOneAndUpdate(
            { _id: offerId, 'matching.candidates.id': candidateId },
            { $set: { 'matching.candidates.$.status': status } },
            { new: true },
        ).lean();
    }

    async setOfferStatus(offerId: string, status: OfferStatus): Promise<Offer | null> {
        return OfferModel.findOneAndUpdate(
            { _id: offerId },
            { $set: { 'matching.status': status } },
            { new: true },
        ).lean();
    }

    /**
     * Marque le sous-ensemble proposé (status SEND + champs de proposition) et
     * rebascule les anciens proposés hors liste en simples retenus. Passe l'offre en CV_SEND.
     */
    async setProposedCandidates(offerId: string, proposed: MatchingCandidate[]): Promise<Offer | null> {
        const offer = await this.findById(offerId);
        if (!offer) return null;

        const proposedById = new Map(proposed.map((candidate) => [candidate.id, candidate]));
        const merged = (offer.matching?.candidates ?? []).map((candidate: MatchingCandidate) => {
            const update = proposedById.get(candidate.id);
            if (update) return { ...candidate, ...update, status: MatchedCandidateStatus.SEND };
            return candidate.status === MatchedCandidateStatus.SEND ? resetProposal(candidate) : candidate;
        });
        for (const candidate of proposed) {
            if (!merged.some((existing: MatchingCandidate) => existing.id === candidate.id)) {
                merged.push({ ...candidate, status: MatchedCandidateStatus.SEND });
            }
        }

        return OfferModel.findOneAndUpdate(
            { _id: offerId },
            { $set: { 'matching.candidates': merged, 'matching.status': OfferStatus.CV_SEND } },
            { new: true },
        ).lean();
    }

    /** Ajoute (ou met à jour) un candidat proposé — utilisé pour la proposition manuelle. */
    async addProposedCandidate(offerId: string, candidate: MatchingCandidate): Promise<Offer | null> {
        const updated = await OfferModel.findOneAndUpdate(
            { _id: offerId, 'matching.candidates.id': candidate.id },
            { $set: { 'matching.candidates.$': candidate } },
            { new: true },
        ).lean();
        if (updated) return updated;

        return OfferModel.findOneAndUpdate(
            { _id: offerId, 'matching.candidates.id': { $ne: candidate.id } },
            { $push: { 'matching.candidates': candidate } },
            { new: true },
        ).lean();
    }

    async setProposedCandidateStatus(
        offerId: string,
        candidateId: string,
        status: MatchedCandidateStatus,
        comment?: string,
    ): Promise<Offer | null> {
        const update: Record<string, unknown> = { 'matching.candidates.$.status': status };
        if (comment) update['matching.candidates.$.comment'] = comment;
        return OfferModel.findOneAndUpdate(
            { _id: offerId, 'matching.candidates.id': candidateId },
            { $set: update },
            { new: true },
        ).lean();
    }

    async setProposedCandidateConclusion(
        offerId: string,
        candidateId: string,
        conclusion: InterviewConclusion,
        immersionStartDate?: string,
        immersionEndDate?: string,
    ): Promise<Offer | null> {
        const update: Record<string, unknown> = { 'matching.candidates.$.interview_conclusion': conclusion };
        if (immersionStartDate) update['matching.candidates.$.immersion_start_date'] = immersionStartDate;
        if (immersionEndDate) update['matching.candidates.$.immersion_end_date'] = immersionEndDate;
        return OfferModel.findOneAndUpdate(
            { _id: offerId, 'matching.candidates.id': candidateId },
            { $set: update },
            { new: true },
        ).lean();
    }

    async setProposedCandidateImmersionConclusion(
        offerId: string,
        candidateId: string,
        conclusion: ImmersionConclusion,
    ): Promise<Offer | null> {
        return OfferModel.findOneAndUpdate(
            { _id: offerId, 'matching.candidates.id': candidateId },
            { $set: { 'matching.candidates.$.immersion_conclusion': conclusion } },
            { new: true },
        ).lean();
    }

    async setOfferInterviewSlots(offerId: string, slots: string[], location?: string): Promise<Offer | null> {
        const update: Record<string, unknown> = { 'matching.interview_slots': slots };
        if (location) update['matching.interview_location'] = location;
        return OfferModel.findOneAndUpdate({ _id: offerId }, { $set: update }, { new: true }).lean();
    }

    /** Atomique, race-safe : échoue (null) si le créneau est déjà pris ou le candidat déjà placé/invalide. */
    async bookInterviewSlot(offerId: string, candidateId: string, slot: string): Promise<Offer | null> {
        return OfferModel.findOneAndUpdate(
            {
                _id: offerId,
                'matching.interview_slots': slot,
                'matching.candidates.booked_interview_slot': { $ne: slot },
                'matching.candidates': {
                    $elemMatch: { id: candidateId, booked_interview_slot: { $exists: false } },
                },
            },
            { $set: { 'matching.candidates.$.booked_interview_slot': slot } },
            { new: true },
        ).lean();
    }

    /** Offres où le candidat a une conclusion d'entretien immersion ou contrat. */
    async findPlacementOffers(candidateId: string): Promise<Offer[]> {
        return OfferModel.find({
            'matching.candidates': {
                $elemMatch: { id: candidateId, interview_conclusion: { $in: PLACEMENT_CONCLUSIONS } },
            },
        }).lean();
    }

    async findOfferIdsWithCandidate(candidateId: string): Promise<string[]> {
        const offers = await OfferModel.find({ 'matching.candidates.id': candidateId }, { _id: 1 }).lean();
        return offers.map((offer) => String(offer._id)).filter(Boolean);
    }

    async deleteById(offerId: string): Promise<boolean> {
        return (await OfferModel.deleteOne({ _id: offerId })).deletedCount > 0;
    }

    async deleteByNeedsAnalysisId(needsAnalysisId: string): Promise<number> {
        return (await OfferModel.deleteMany({ needs_analysis_id: needsAnalysisId })).deletedCount;
    }
}

import { OfferModel } from '../../db/mongo/schemas/offer.schema';
import { NeedsAnalysisModel } from '../../db/mongo/schemas/needsAnalysis.schema';
import { Offer, OfferAbFilter, AbStatus } from '../../types/offer.types';
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
        description: _description,
        cv_webview: _cv_webview,
        comment: _comment,
        interview_location: _interview_location,
        booked_interview_slot: _booked_interview_slot,
        interview_conclusion: _interview_conclusion,
        immersion_start_date: _immersion_start_date,
        immersion_end_date: _immersion_end_date,
        immersion_location: _immersion_location,
        immersion_conclusion: _immersion_conclusion,
        ...identity
    } = candidate;
    return { ...identity, status: MatchedCandidateStatus.ACCEPTED };
}

function buildOfferAbMongoFilter(filter: OfferAbFilter): Record<string, unknown> {
    const mongo: Record<string, unknown> = {};
    if (filter.statuses?.length) mongo['matching.status'] = { $in: filter.statuses };
    if (filter.desiredTp?.length) mongo['desired_tp.tp_type'] = { $in: filter.desiredTp };
    if (filter.sectors?.length) mongo['company_infos.activities'] = { $in: filter.sectors };
    if (filter.localisations?.length) mongo['localisation'] = { $in: filter.localisations };
    if (filter.search) {
        mongo['company_infos.name'] = { $regex: escapeRegExp(filter.search), $options: 'i' };
    }
    return mongo;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class OfferRepository {
    /** Ids des AB dont au moins une offre correspond au filtre. */
    async findNeedsAnalysisIdsByFilter(filter: OfferAbFilter): Promise<string[]> {
        const mongoFilter = buildOfferAbMongoFilter(filter);
        return OfferModel.distinct('needs_analysis_id', mongoFilter);
    }

    /**
     * Ids des AB selon leur statut dérivé des offres (hors AB supprimées) :
     * - ARCHIVED : toutes les offres de l'AB sont en contrat,
     * - ACTIVE   : au moins une offre n'est pas encore en contrat.
     * Une offre est « en contrat » quand matching.status = CONTRACT ou qu'un de ses
     * candidats a un statut CONTRACT (miroir de listMatchingOffers).
     */
    async findNeedsAnalysisIdsByAbStatus(abStatus: AbStatus): Promise<string[]> {
        const contractStatus = OfferStatus.CONTRACT;
        const contractCandidate = MatchedCandidateStatus.CONTRACT;
        const contractConditions = [
            { 'matching.status': contractStatus },
            { 'matching.candidates.status': contractCandidate },
        ];

        if (abStatus === 'ARCHIVED') {
            const rows = await OfferModel.aggregate([
                { $match: { needs_analysis_id: { $exists: true, $ne: null } } },
                {
                    $group: {
                        _id: '$needs_analysis_id',
                        total: { $sum: 1 },
                        contracted: {
                            $sum: {
                                $cond: [
                                    {
                                        $or: [
                                            { $eq: ['$matching.status', contractStatus] },
                                            { $in: [contractCandidate, { $ifNull: ['$matching.candidates.status', []] }] },
                                        ],
                                    },
                                    1,
                                    0,
                                ],
                            },
                        },
                    },
                },
                { $match: { $expr: { $eq: ['$contracted', '$total'] } } },
                { $project: { _id: 1 } },
            ]);
            return rows.map((row) => String(row._id));
        }

        // ACTIVE : au moins une offre pas encore en contrat.
        return OfferModel.distinct('needs_analysis_id', {
            needs_analysis_id: { $exists: true, $ne: null },
            $nor: contractConditions,
        });
    }

    async findById(offerId: string): Promise<Offer | null> {
        return OfferModel.findOne({ _id: offerId }).lean();
    }

    /** Statut dérivé d'une AB à partir de ses offres (miroir de findNeedsAnalysisIdsByAbStatus). */
    async findDerivedAbStatus(needsAnalysisId: string): Promise<AbStatus> {
        const offers = await OfferModel.find({ needs_analysis_id: needsAnalysisId }).lean();
        if (offers.length === 0) return 'ACTIVE';
        const contractStatus = OfferStatus.CONTRACT;
        const contractCandidate = MatchedCandidateStatus.CONTRACT;
        const allContracted = offers.every(
            (offer) =>
                offer.matching?.status === contractStatus ||
                (offer.matching?.candidates ?? []).some((c: MatchingCandidate) => c.status === contractCandidate),
        );
        return allContracted ? 'ARCHIVED' : 'ACTIVE';
    }

    async findByNeedsAnalysisId(needsAnalysisId: string): Promise<Offer[]> {
        return OfferModel.find({ needs_analysis_id: needsAnalysisId }).lean();
    }

    /** Toutes les offres à matcher (hors offres déjà contractualisées et hors AB inactives). */
    async listMatchingOffers(): Promise<Offer[]> {
        const inactiveIds: string[] = await NeedsAnalysisModel.distinct('_id', {
            $or: [{ is_deleted: true }, { ab_status: 'INACTIVE' }],
        });
        const filter: Record<string, unknown> = {
            $nor: [
                { 'matching.status': OfferStatus.CONTRACT },
                { 'matching.candidates': { $elemMatch: { status: MatchedCandidateStatus.CONTRACT } } },
            ],
        };
        if (inactiveIds.length) {
            (filter as Record<string, unknown>)['needs_analysis_id'] = { $nin: inactiveIds };
        }
        return OfferModel.find(filter).lean();
    }

    /** Remplace le contenu (poste, entreprise, référents, saler) d'une offre sans toucher à `matching`. */
    async updateContent(offerId: string, offer: Partial<Offer>): Promise<Offer | null> {
        const { _id, matching: _matching, ...patch } = offer;
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
        status?: MatchedCandidateStatus,
    ): Promise<Offer | null> {
        const update: Record<string, unknown> = { 'matching.candidates.$.interview_conclusion': conclusion };
        if (immersionStartDate) update['matching.candidates.$.immersion_start_date'] = immersionStartDate;
        if (immersionEndDate) update['matching.candidates.$.immersion_end_date'] = immersionEndDate;
        if (status) update['matching.candidates.$.status'] = status;
        return OfferModel.findOneAndUpdate(
            { _id: offerId, 'matching.candidates.id': candidateId },
            { $set: update },
            { returnDocument: 'after' },
        ).lean();
    }

    async setProposedCandidateImmersionConclusion(
        offerId: string,
        candidateId: string,
        conclusion: ImmersionConclusion,
        status?: MatchedCandidateStatus,
    ): Promise<Offer | null> {
        const update: Record<string, unknown> = { 'matching.candidates.$.immersion_conclusion': conclusion };
        if (status) update['matching.candidates.$.status'] = status;
        return OfferModel.findOneAndUpdate(
            { _id: offerId, 'matching.candidates.id': candidateId },
            { $set: update },
            { returnDocument: 'after' },
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

    async findWithCandidate(candidateId: string): Promise<Offer[]> {
        return OfferModel.find({ 'matching.candidates.id': candidateId }).lean();
    }

    async deleteById(offerId: string): Promise<boolean> {
        return (await OfferModel.deleteOne({ _id: offerId })).deletedCount > 0;
    }

    async deleteByNeedsAnalysisId(needsAnalysisId: string): Promise<number> {
        return (await OfferModel.deleteMany({ needs_analysis_id: needsAnalysisId })).deletedCount;
    }

    /**
     * Réassigne (ou détache) le commercial porteur de toutes les offres liées à
     * un user supprimé. `saler = null` détache l'offre (elle vit sans commercial).
     * Renvoie le nombre d'offres modifiées.
     */
    async reassignSaler(fromUserId: number, saler: { id: number; email: string } | null): Promise<number> {
        const update = saler
            ? { $set: { saler_info: { id: saler.id, email: saler.email } } }
            : { $unset: { saler_info: '' } };
        const res = await OfferModel.updateMany({ 'saler_info.id': fromUserId }, update);
        return res.modifiedCount;
    }
}

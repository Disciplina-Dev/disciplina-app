import { getModels } from '../../db/mongo/tenant';
import { Offer, OfferAbFilter, AbStatus } from '../../types/offer.types';
import { expandTpFilter } from '../../types/candidate.types';
import {
    ImmersionConclusion,
    InterviewConclusion,
    OfferStatus,
    MatchedCandidateStatus,
    MatchingCandidate,
} from '../../types/matching.types';

const PLACEMENT_CONCLUSIONS = [InterviewConclusion.IMMERSING, InterviewConclusion.CONTRACT];

function buildOfferAbMongoFilter(filter: OfferAbFilter): Record<string, unknown> {
    const mongo: Record<string, unknown> = {};
    if (filter.statuses?.length) mongo['matching.status'] = { $in: filter.statuses };
    if (filter.desiredTp?.length) mongo['desired_tp.tp_type'] = { $in: expandTpFilter(filter.desiredTp) };
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
        return getModels().Offer.distinct('needs_analysis_id', mongoFilter);
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
            const rows = await getModels().Offer.aggregate([
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
        return getModels().Offer.distinct('needs_analysis_id', {
            needs_analysis_id: { $exists: true, $ne: null },
            $nor: contractConditions,
        });
    }

    async findById(offerId: string): Promise<Offer | null> {
        return getModels().Offer.findOne({ _id: offerId }).lean();
    }

    /** Statut dérivé d'une AB à partir de ses offres (miroir de findNeedsAnalysisIdsByAbStatus). */
    async findDerivedAbStatus(needsAnalysisId: string): Promise<AbStatus> {
        const offers = await getModels().Offer.find({ needs_analysis_id: needsAnalysisId }).lean();
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
        return getModels().Offer.find({ needs_analysis_id: needsAnalysisId }).lean();
    }

    /** Toutes les offres, y compris celles déjà contractualisées (hors AB inactives). */
    async listAllOffers(): Promise<Offer[]> {
        const inactiveIds: string[] = await getModels().NeedsAnalysis.distinct('_id', {
            $or: [{ is_deleted: true }, { ab_status: 'INACTIVE' }],
        });
        const filter: Record<string, unknown> = {};
        if (inactiveIds.length) {
            (filter as Record<string, unknown>)['needs_analysis_id'] = { $nin: inactiveIds };
        }
        return getModels().Offer.find(filter).lean();
    }

    /** Toutes les offres à matcher (hors offres déjà contractualisées, désactivées et hors AB inactives). */
    async listMatchingOffers(): Promise<Offer[]> {
        const inactiveIds: string[] = await getModels().NeedsAnalysis.distinct('_id', {
            $or: [{ is_deleted: true }, { ab_status: 'INACTIVE' }],
        });
        const filter: Record<string, unknown> = {
            // Statut actif/inactif propre à l'offre (annuaire entreprises) : une offre
            // désactivée ne doit plus être proposée côté candidat. `null`/absent =
            // l'offre hérite du statut de son AB (filtrée ci-dessous).
            is_active: { $ne: false },
            $nor: [
                { 'matching.status': OfferStatus.CONTRACT },
                { 'matching.candidates': { $elemMatch: { status: MatchedCandidateStatus.CONTRACT } } },
            ],
        };
        if (inactiveIds.length) {
            (filter as Record<string, unknown>)['needs_analysis_id'] = { $nin: inactiveIds };
        }
        return getModels().Offer.find(filter).lean();
    }

    /** Remplace le contenu (poste, entreprise, référents, saler) d'une offre sans toucher à `matching`. */
    async updateContent(offerId: string, offer: Partial<Offer>): Promise<Offer | null> {
        const { _id, matching: _matching, ...patch } = offer;
        return getModels().Offer.findOneAndUpdate({ _id: offerId }, { $set: patch }, { new: true }).lean();
    }

    async createMany(offers: Offer[]): Promise<Offer[]> {
        if (offers.length === 0) return [];
        const docs = await getModels().Offer.insertMany(offers);
        return docs.map((doc) => doc.toObject() as Offer);
    }

    async addMatchedCandidate(offerId: string, candidate: MatchingCandidate): Promise<Offer | null> {
        return getModels().Offer.findOneAndUpdate(
            { _id: offerId, 'matching.candidates.id': { $ne: candidate.id } },
            {
                $push: { 'matching.candidates': candidate },
                // Un candidat retenu manuellement ne doit plus être marqué comme écarté.
                $pull: { 'matching.dismissed_candidate_ids': candidate.id },
            },
            { new: true },
        ).lean();
    }

    /** Écarte un candidat des suggestions automatiques (bouton « Non »), de façon persistante. */
    async dismissSuggestedCandidate(offerId: string, candidateId: string): Promise<Offer | null> {
        return getModels().Offer.findOneAndUpdate(
            { _id: offerId },
            { $addToSet: { 'matching.dismissed_candidate_ids': candidateId } },
            { new: true },
        ).lean();
    }

    async removeMatchedCandidate(offerId: string, candidateId: string): Promise<Offer | null> {
        return getModels().Offer.findOneAndUpdate(
            { _id: offerId },
            { $pull: { 'matching.candidates': { id: candidateId } } },
            { new: true },
        ).lean();
    }

    /** Effacement candidat : retire le candidat du matching de toutes les offres. */
    async removeCandidateFromAllMatchings(candidateId: string): Promise<number> {
        const result = await getModels().Offer.updateMany(
            { 'matching.candidates.id': candidateId },
            { $pull: { 'matching.candidates': { id: candidateId } } },
        );
        return result.modifiedCount;
    }

    async clearMatchedCandidates(offerId: string): Promise<Offer | null> {
        return getModels().Offer.findOneAndUpdate(
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
        return getModels().Offer.findOneAndUpdate(
            { _id: offerId, 'matching.candidates.id': candidateId },
            { $set: { 'matching.candidates.$.status': status } },
            { new: true },
        ).lean();
    }

    async setOfferStatus(offerId: string, status: OfferStatus): Promise<Offer | null> {
        return getModels().Offer.findOneAndUpdate(
            { _id: offerId },
            { $set: { 'matching.status': status } },
            { new: true },
        ).lean();
    }

    /** Override actif/inactif d'une offre ; `null` rétablit l'héritage du statut de l'AB. */
    async setOfferActive(offerId: string, active: boolean | null): Promise<Offer | null> {
        return getModels().Offer.findOneAndUpdate(
            { _id: offerId },
            { $set: { is_active: active } },
            { new: true },
        ).lean();
    }

    /**
     * Marque le sous-ensemble proposé (status SEND + champs de proposition) et
     * passe l'offre en CV_SEND. Les candidats déjà envoyés lors d'un envoi
     * précédent restent SEND : les envois successifs s'ajoutent au lieu de se remplacer.
     */
    async setProposedCandidates(offerId: string, proposed: MatchingCandidate[]): Promise<Offer | null> {
        const offer = await this.findById(offerId);
        if (!offer) return null;

        const proposedById = new Map(proposed.map((candidate) => [candidate.id, candidate]));
        const merged = (offer.matching?.candidates ?? []).map((candidate: MatchingCandidate) => {
            const update = proposedById.get(candidate.id);
            return update ? { ...candidate, ...update, status: MatchedCandidateStatus.SEND } : candidate;
        });
        for (const candidate of proposed) {
            if (!merged.some((existing: MatchingCandidate) => existing.id === candidate.id)) {
                merged.push({ ...candidate, status: MatchedCandidateStatus.SEND });
            }
        }

        return getModels().Offer.findOneAndUpdate(
            { _id: offerId },
            { $set: { 'matching.candidates': merged, 'matching.status': OfferStatus.CV_SEND } },
            { new: true },
        ).lean();
    }

    /** Ajoute (ou met à jour) un candidat proposé — utilisé pour la proposition manuelle. */
    async addProposedCandidate(offerId: string, candidate: MatchingCandidate): Promise<Offer | null> {
        const updated = await getModels().Offer.findOneAndUpdate(
            { _id: offerId, 'matching.candidates.id': candidate.id },
            { $set: { 'matching.candidates.$': candidate } },
            { new: true },
        ).lean();
        if (updated) return updated;

        return getModels().Offer.findOneAndUpdate(
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
        return getModels().Offer.findOneAndUpdate(
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
        return getModels().Offer.findOneAndUpdate(
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
        return getModels().Offer.findOneAndUpdate(
            { _id: offerId, 'matching.candidates.id': candidateId },
            { $set: update },
            { returnDocument: 'after' },
        ).lean();
    }

    async setOfferInterviewSlots(offerId: string, slots: string[], location?: string): Promise<Offer | null> {
        const update: Record<string, unknown> = { 'matching.interview_slots': slots };
        if (location) update['matching.interview_location'] = location;
        return getModels().Offer.findOneAndUpdate({ _id: offerId }, { $set: update }, { new: true }).lean();
    }

    /** Atomique, race-safe : échoue (null) si le créneau est déjà pris ou le candidat déjà placé/invalide. */
    async bookInterviewSlot(offerId: string, candidateId: string, slot: string): Promise<Offer | null> {
        return getModels().Offer.findOneAndUpdate(
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
        return getModels().Offer.find({
            'matching.candidates': {
                $elemMatch: { id: candidateId, interview_conclusion: { $in: PLACEMENT_CONCLUSIONS } },
            },
        }).lean();
    }

    async findOfferIdsWithCandidate(candidateId: string): Promise<string[]> {
        const offers = await getModels().Offer.find({ 'matching.candidates.id': candidateId }, { _id: 1 }).lean();
        return offers.map((offer) => String(offer._id)).filter(Boolean);
    }

    async findWithCandidate(candidateId: string): Promise<Offer[]> {
        return getModels().Offer.find({ 'matching.candidates.id': candidateId }).lean();
    }

    async deleteById(offerId: string): Promise<boolean> {
        return (await getModels().Offer.deleteOne({ _id: offerId })).deletedCount > 0;
    }

    async deleteByNeedsAnalysisId(needsAnalysisId: string): Promise<number> {
        return (await getModels().Offer.deleteMany({ needs_analysis_id: needsAnalysisId })).deletedCount;
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
        const res = await getModels().Offer.updateMany({ 'saler_info.id': fromUserId }, update);
        return res.modifiedCount;
    }
}

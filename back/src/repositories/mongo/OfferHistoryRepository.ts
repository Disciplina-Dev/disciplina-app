import { getModels } from '../../db/mongo/tenant';
import { OfferHistoryEntry } from '../../types/offer.types';

export class OfferHistoryRepository {
    async create(data: Partial<OfferHistoryEntry>): Promise<OfferHistoryEntry> {
        const doc = new (getModels().OfferHistory)(data);
        await doc.save();
        return doc.toObject() as OfferHistoryEntry;
    }

    async findByOfferId(offerId: string): Promise<OfferHistoryEntry[]> {
        return getModels().OfferHistory.find({ offer_id: offerId }).sort({ created_at: -1 }).lean();
    }

    async findById(id: string): Promise<OfferHistoryEntry | null> {
        return getModels().OfferHistory.findById(id).lean();
    }

    async delete(id: string): Promise<boolean> {
        return (await getModels().OfferHistory.deleteOne({ _id: id })).deletedCount > 0;
    }
}

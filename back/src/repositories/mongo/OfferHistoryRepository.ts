import { OfferHistoryModel } from '../../db/mongo/schemas/offer.schema';
import { OfferHistoryEntry } from '../../types/offer.types';

export class OfferHistoryRepository {
    async create(data: Partial<OfferHistoryEntry>): Promise<OfferHistoryEntry> {
        const doc = new OfferHistoryModel(data);
        await doc.save();
        return doc.toObject() as OfferHistoryEntry;
    }

    async findByOfferId(offerId: string): Promise<OfferHistoryEntry[]> {
        return OfferHistoryModel.find({ offer_id: offerId }).sort({ created_at: -1 }).lean();
    }

    async findById(id: string): Promise<OfferHistoryEntry | null> {
        return OfferHistoryModel.findById(id).lean();
    }

    async delete(id: string): Promise<boolean> {
        return (await OfferHistoryModel.deleteOne({ _id: id })).deletedCount > 0;
    }
}

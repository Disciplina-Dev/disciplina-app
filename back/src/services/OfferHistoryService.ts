import { randomUUID } from 'crypto';
import { OfferHistoryRepository } from '../repositories/mongo/OfferHistoryRepository';
import { OfferHistoryEntry } from '../types/offer.types';
import { logger } from '../external/logger';

export class OfferHistoryService {
    private repository = new OfferHistoryRepository();

    async recordAuto(offerId: string, text: string): Promise<void> {
        try {
            await this.repository.create({
                _id: randomUUID(),
                offer_id: offerId,
                first_name: null,
                last_name: null,
                text,
                owner_email: null,
                created_at: new Date(),
            });
        } catch (error) {
            logger.error({ error, offerId }, 'Failed to record offer history entry');
        }
    }

    async recordManual(
        offerId: string,
        firstName: string,
        lastName: string,
        text: string,
        ownerEmail: string,
    ): Promise<OfferHistoryEntry> {
        return this.repository.create({
            _id: randomUUID(),
            offer_id: offerId,
            first_name: firstName,
            last_name: lastName,
            text,
            owner_email: ownerEmail,
            created_at: new Date(),
        });
    }

    async findByOffer(offerId: string): Promise<OfferHistoryEntry[]> {
        return this.repository.findByOfferId(offerId);
    }

    async deleteOwnedEntry(id: string, ownerEmail: string): Promise<boolean> {
        const entry = await this.repository.findById(id);
        if (!entry) throw new Error('History entry not found');
        if (entry.owner_email === null) throw new Error('Cannot delete an automatic history entry');
        if (entry.owner_email !== ownerEmail) throw new Error('Only the owner can delete this history entry');
        return this.repository.delete(id);
    }
}

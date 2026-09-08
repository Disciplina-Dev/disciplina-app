import { CommercialSignatureModel } from '../db/mongo/schemas/commercialSignature.schema';
import { DEFAULT_COMMERCIAL_SIGNATURE } from './commercialSignatureTemplate';

export class CommercialSignatureService {
    async getForUser(userId: number): Promise<string> {
        const doc = await CommercialSignatureModel.findOne({ user_id: userId }).lean<{ body: string }>();
        return doc?.body ?? DEFAULT_COMMERCIAL_SIGNATURE;
    }

    async getRawForUser(userId: number): Promise<{ body: string; isDefault: boolean }> {
        const doc = await CommercialSignatureModel.findOne({ user_id: userId }).lean<{ body: string }>();
        if (!doc) return { body: DEFAULT_COMMERCIAL_SIGNATURE, isDefault: true };
        return { body: doc.body, isDefault: false };
    }

    async setForUser(userId: number, body: string): Promise<string> {
        const now = new Date();
        const doc = await CommercialSignatureModel.findOneAndUpdate(
            { _id: `${userId}` },
            { $set: { user_id: userId, body, updated_at: now } },
            { upsert: true, new: true },
        ).lean<{ body: string }>();
        return doc!.body;
    }
}

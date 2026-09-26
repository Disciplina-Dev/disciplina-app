import { getModels } from '../db/mongo/tenant';
import { DEFAULT_COMMERCIAL_SIGNATURE } from './commercialSignatureTemplate';

export class CommercialSignatureService {
    async getForUser(userId: number): Promise<string> {
        const doc = await getModels().CommercialSignature.findOne({ user_id: userId }).lean<{ body: string }>();
        return doc?.body ?? DEFAULT_COMMERCIAL_SIGNATURE;
    }

    async getRawForUser(userId: number): Promise<{ body: string; isDefault: boolean }> {
        const doc = await getModels().CommercialSignature.findOne({ user_id: userId }).lean<{ body: string }>();
        if (!doc) return { body: DEFAULT_COMMERCIAL_SIGNATURE, isDefault: true };
        return { body: doc.body, isDefault: false };
    }

    async setForUser(userId: number, body: string): Promise<string> {
        const now = new Date();
        const doc = await getModels().CommercialSignature.findOneAndUpdate(
            { _id: `${userId}` },
            { $set: { user_id: userId, body, updated_at: now } },
            { upsert: true, new: true },
        ).lean<{ body: string }>();
        return doc!.body;
    }
}

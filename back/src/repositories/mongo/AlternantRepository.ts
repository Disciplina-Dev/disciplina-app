import { randomUUID } from 'crypto';
import { getModels } from '../../db/mongo/tenant';
import { Alternant } from '../../types/alternant.types';

export class AlternantRepository {
    async findAll(search?: string): Promise<Alternant[]> {
        const filter = search?.trim()
            ? {
                  $or: [
                      { first_name: { $regex: search.trim(), $options: 'i' } },
                      { last_name: { $regex: search.trim(), $options: 'i' } },
                      { session: { $regex: search.trim(), $options: 'i' } },
                      { 'company.name': { $regex: search.trim(), $options: 'i' } },
                  ],
              }
            : {};
        return getModels().Alternant.find(filter).sort({ created_at: -1 }).lean();
    }

    async count(search?: string): Promise<number> {
        const filter = search?.trim()
            ? {
                  $or: [
                      { first_name: { $regex: search.trim(), $options: 'i' } },
                      { last_name: { $regex: search.trim(), $options: 'i' } },
                      { session: { $regex: search.trim(), $options: 'i' } },
                      { 'company.name': { $regex: search.trim(), $options: 'i' } },
                  ],
              }
            : {};
        return getModels().Alternant.countDocuments(filter);
    }

    async findById(id: string): Promise<Alternant | null> {
        return getModels().Alternant.findOne({ _id: id }).lean();
    }

    async findByIds(ids: string[]): Promise<Alternant[]> {
        if (ids.length === 0) return [];
        return getModels()
            .Alternant.find({ _id: { $in: ids } })
            .lean();
    }

    async findBySessionId(sessionId: string): Promise<Alternant[]> {
        return getModels().Alternant.find({ session_id: sessionId }).sort({ last_name: 1, first_name: 1 }).lean();
    }

    /** Recherche par email (exact, insensible à la casse + espaces) pour la détection de doublons. */
    async findByEmail(email: string): Promise<Alternant | null> {
        const normalized = email.trim();
        if (!normalized) return null;
        const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return getModels()
            .Alternant.findOne({ email: { $regex: `^${escaped}$`, $options: 'i' } })
            .lean();
    }

    async create(data: Omit<Alternant, '_id' | 'created_at' | 'updated_at'>): Promise<Alternant> {
        const now = new Date();
        const doc = new (getModels().Alternant)({
            _id: randomUUID(),
            ...data,
            created_at: now,
            updated_at: now,
        });
        await doc.save();
        return doc.toObject() as Alternant;
    }

    async update(id: string, patch: Record<string, unknown>): Promise<Alternant | null> {
        const { _id, ...rest } = patch;
        return getModels()
            .Alternant.findOneAndUpdate(
                { _id: id },
                { $set: { ...rest, updated_at: new Date() } },
                { returnDocument: 'after', runValidators: true, context: 'query' },
            )
            .lean();
    }

    async setCompany(id: string, company: Alternant['company']): Promise<Alternant | null> {
        return getModels()
            .Alternant.findOneAndUpdate(
                { _id: id },
                { $set: { company, updated_at: new Date() } },
                { returnDocument: 'after', runValidators: true, context: 'query' },
            )
            .lean();
    }

    async delete(id: string): Promise<boolean> {
        return (await getModels().Alternant.deleteOne({ _id: id })).deletedCount > 0;
    }
}

import { randomUUID } from 'crypto';
import { getModels } from '../../db/mongo/tenant';
import { Session } from '../../types/session.types';

export class SessionRepository {
    async findAll(search?: string): Promise<Session[]> {
        const filter = search?.trim()
            ? {
                  $or: [
                      { nom: { $regex: search.trim(), $options: 'i' } },
                      { filiere: { $regex: search.trim(), $options: 'i' } },
                  ],
              }
            : {};
        return getModels().Session.find(filter).sort({ date_debut: 1 }).lean();
    }

    async findById(id: string): Promise<Session | null> {
        return getModels().Session.findOne({ _id: id }).lean();
    }

    async findByIds(ids: string[]): Promise<Session[]> {
        if (ids.length === 0) return [];
        return getModels()
            .Session.find({ _id: { $in: ids } })
            .lean();
    }

    /** Recherche par nom exact (insensible à la casse) pour l'unicité. */
    async findByNom(nom: string): Promise<Session | null> {
        const normalized = nom.trim();
        if (!normalized) return null;
        const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return getModels()
            .Session.findOne({ nom: { $regex: `^${escaped}$`, $options: 'i' } })
            .lean();
    }

    async create(data: Omit<Session, '_id' | 'created_at' | 'updated_at'>): Promise<Session> {
        const now = new Date();
        const doc = new (getModels().Session)({
            _id: randomUUID(),
            ...data,
            created_at: now,
            updated_at: now,
        });
        await doc.save();
        return doc.toObject() as Session;
    }

    async update(id: string, patch: Record<string, unknown>): Promise<Session | null> {
        const { _id, ...rest } = patch;
        return getModels()
            .Session.findOneAndUpdate(
                { _id: id },
                { $set: { ...rest, updated_at: new Date() } },
                { returnDocument: 'after', runValidators: true, context: 'query' },
            )
            .lean();
    }

    async delete(id: string): Promise<boolean> {
        return (await getModels().Session.deleteOne({ _id: id })).deletedCount > 0;
    }
}

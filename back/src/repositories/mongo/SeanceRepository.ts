import { randomUUID } from 'crypto';
import { getModels } from '../../db/mongo/tenant';
import { Seance } from '../../types/emargement.types';

export interface SeanceListFilter {
    sessionId?: string;
    /** Borne basse incluse, `YYYY-MM-DD`. */
    from?: string;
    /** Borne haute incluse, `YYYY-MM-DD`. */
    to?: string;
}

export class SeanceRepository {
    async findAll(filter: SeanceListFilter = {}): Promise<Seance[]> {
        const query: Record<string, unknown> = {};
        if (filter.sessionId) query.session_id = filter.sessionId;
        if (filter.from || filter.to) {
            const range: Record<string, string> = {};
            if (filter.from) range.$gte = filter.from;
            if (filter.to) range.$lte = filter.to;
            query.date = range;
        }
        return getModels()
            .Seance.find(query)
            .select('-signature_image')
            .sort({ date: -1, start_time: -1 })
            .limit(200)
            .lean() as unknown as Promise<Seance[]>;
    }

    async findById(id: string): Promise<Seance | null> {
        return getModels().Seance.findOne({ _id: id }).lean() as unknown as Promise<Seance | null>;
    }

    async create(data: Omit<Seance, '_id' | 'created_at' | 'updated_at'>): Promise<Seance> {
        const now = new Date();
        const doc = new (getModels().Seance)({
            _id: randomUUID(),
            ...data,
            created_at: now,
            updated_at: now,
        });
        await doc.save();
        return doc.toObject() as Seance;
    }

    async update(id: string, patch: Record<string, unknown>): Promise<Seance | null> {
        const { _id, ...rest } = patch;
        return getModels()
            .Seance.findOneAndUpdate(
                { _id: id },
                { $set: { ...rest, updated_at: new Date() } },
                { returnDocument: 'after', runValidators: true, context: 'query' },
            )
            .lean() as unknown as Promise<Seance | null>;
    }

    async delete(id: string): Promise<boolean> {
        return (await getModels().Seance.deleteOne({ _id: id })).deletedCount > 0;
    }
}

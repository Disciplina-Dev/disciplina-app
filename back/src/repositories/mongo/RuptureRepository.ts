import { randomUUID } from 'crypto';
import { getModels } from '../../db/mongo/tenant';
import { Rupture } from '../../types/rupture.types';

export class RuptureRepository {
    async findById(id: string): Promise<Rupture | null> {
        return getModels().Rupture.findOne({ _id: id }).lean();
    }

    async findByAlternantId(alternantId: string): Promise<Rupture[]> {
        return getModels().Rupture.find({ alternant_id: alternantId }).sort({ date_rupture: -1 }).lean();
    }

    /** Toutes les ruptures dont la date tombe dans le mois calendaire donné. */
    async findByMonth(year: number, month: number): Promise<Rupture[]> {
        const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
        const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
        return getModels()
            .Rupture.find({ date_rupture: { $gte: start, $lt: end } })
            .sort({ date_rupture: 1 })
            .lean();
    }

    async create(data: Omit<Rupture, '_id' | 'created_at' | 'updated_at'>): Promise<Rupture> {
        const now = new Date();
        const doc = new (getModels().Rupture)({
            _id: randomUUID(),
            ...data,
            created_at: now,
            updated_at: now,
        });
        await doc.save();
        return doc.toObject() as Rupture;
    }

    async update(id: string, patch: Record<string, unknown>): Promise<Rupture | null> {
        const { _id, ...rest } = patch;
        return getModels()
            .Rupture.findOneAndUpdate(
                { _id: id },
                { $set: { ...rest, updated_at: new Date() } },
                { returnDocument: 'after', runValidators: true, context: 'query' },
            )
            .lean();
    }

    async delete(id: string): Promise<boolean> {
        return (await getModels().Rupture.deleteOne({ _id: id })).deletedCount > 0;
    }

    async deleteByAlternantId(alternantId: string): Promise<void> {
        await getModels().Rupture.deleteMany({ alternant_id: alternantId });
    }
}

import { randomUUID } from 'crypto';
import { getModels } from '../../db/mongo/tenant';
import { AlternantSequence } from '../../types/alternant.types';

export class AlternantSequenceRepository {
    async findByAlternantId(alternantId: string): Promise<AlternantSequence[]> {
        return getModels().AlternantSequence.find({ alternant_id: alternantId }).sort({ numero: 1 }).lean();
    }

    async findById(id: string): Promise<AlternantSequence | null> {
        return getModels().AlternantSequence.findOne({ _id: id }).lean();
    }

    async nextNumero(alternantId: string): Promise<number> {
        const latest = await getModels()
            .AlternantSequence.find({ alternant_id: alternantId })
            .sort({ numero: -1 })
            .limit(1)
            .select({ numero: 1 })
            .lean();
        return (latest[0]?.numero ?? 0) + 1;
    }

    async create(data: Omit<AlternantSequence, '_id' | 'created_at' | 'updated_at'>): Promise<AlternantSequence> {
        const now = new Date();
        const doc = new (getModels().AlternantSequence)({
            _id: randomUUID(),
            ...data,
            created_at: now,
            updated_at: now,
        });
        await doc.save();
        return doc.toObject() as AlternantSequence;
    }

    async update(id: string, patch: Record<string, unknown>): Promise<AlternantSequence | null> {
        const { _id, ...rest } = patch;
        return getModels()
            .AlternantSequence.findOneAndUpdate(
                { _id: id },
                { $set: { ...rest, updated_at: new Date() } },
                { returnDocument: 'after', runValidators: true, context: 'query' },
            )
            .lean();
    }
    /** Supprime les SA auto-générées encore en attente (régénération du planning). */
    async deleteAutoPending(alternantId: string): Promise<number> {
        const res = await getModels().AlternantSequence.deleteMany({
            alternant_id: alternantId,
            auto_generated: true,
            status: 'pending',
        });
        return res.deletedCount ?? 0;
    }

    /**
     * Décale les SA auto-générées à venir (numéro supérieur, encore en attente)
     * de `deltaMs` millisecondes. Sert à reprogrammer la suite du planning
     * quand une SA est réalisée en avance ou en retard. Les SA manuelles et
     * celles déjà traitées gardent leur date.
     */
    async shiftLaterPending(alternantId: string, afterNumero: number, deltaMs: number): Promise<number> {
        if (deltaMs === 0) return 0;
        const later = await getModels()
            .AlternantSequence.find({
                alternant_id: alternantId,
                numero: { $gt: afterNumero },
                auto_generated: true,
                status: 'pending',
            })
            .select({ _id: 1, prevue_le: 1 })
            .lean();
        if (later.length === 0) return 0;
        await getModels().AlternantSequence.bulkWrite(
            later.map((doc) => ({
                updateOne: {
                    filter: { _id: doc._id },
                    update: {
                        $set: {
                            prevue_le: new Date(new Date(doc.prevue_le).getTime() + deltaMs),
                            updated_at: new Date(),
                        },
                    },
                },
            })),
        );
        return later.length;
    }

    /**
     * SA en attente entrées dans la fenêtre « En cours » et pas encore notifiées.
     * Fenêtre alignée sur le dashboard Peda : [startOfToday, startOfToday + 14 jours[.
     */
    async findSoonUnnotified(startOfToday: Date, soonUpper: Date): Promise<AlternantSequence[]> {
        return getModels()
            .AlternantSequence.find({
                status: 'pending',
                archived_at: null,
                prevue_le: { $gte: startOfToday, $lt: soonUpper },
                soon_notified_at: null,
            })
            .lean();
    }

    /** SA en attente dont la date prévue est dépassée et pas encore notifiées. */
    async findLateUnnotified(startOfToday: Date): Promise<AlternantSequence[]> {
        return getModels()
            .AlternantSequence.find({
                status: 'pending',
                archived_at: null,
                prevue_le: { $lt: startOfToday },
                late_notified_at: null,
            })
            .lean();
    }

    /** Marque la notification « SA en cours » comme émise (dédup scheduler). */
    async markSoonNotified(id: string, at: Date): Promise<void> {
        await getModels().AlternantSequence.updateOne({ _id: id }, { $set: { soon_notified_at: at } });
    }

    /** Marque la notification « SA en retard » comme émise (dédup scheduler). */
    async markLateNotified(id: string, at: Date): Promise<void> {
        await getModels().AlternantSequence.updateOne({ _id: id }, { $set: { late_notified_at: at } });
    }

    /** Supprime toutes les SA d'un alternant (ex. perte d'entreprise). */
    async deleteByAlternantId(alternantId: string): Promise<number> {
        const res = await getModels().AlternantSequence.deleteMany({ alternant_id: alternantId });
        return res.deletedCount ?? 0;
    }

    /** Archive (`date` non nulle) ou désarchive (`null`) toutes les SA d'un alternant. */
    async setArchivedByAlternantId(alternantId: string, date: Date | null): Promise<number> {
        const res = await getModels().AlternantSequence.updateMany(
            { alternant_id: alternantId },
            { $set: { archived_at: date, updated_at: new Date() } },
        );
        return res.modifiedCount ?? 0;
    }

    async delete(id: string): Promise<boolean> {
        return (await getModels().AlternantSequence.deleteOne({ _id: id })).deletedCount > 0;
    }
}

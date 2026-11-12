import { randomUUID } from 'crypto';
import { getModels } from '../../db/mongo/tenant';
import { AlternantDocumentTemplate } from '../../types/alternantDocumentTemplate.types';
import { AlternantSequenceType } from '../../types/alternant.types';

export class AlternantDocumentTemplateRepository {
    async findAll(type?: AlternantSequenceType): Promise<AlternantDocumentTemplate[]> {
        const filter = type ? { type } : {};
        return getModels().AlternantDocumentTemplate.find(filter).sort({ label: 1 }).lean();
    }

    async findById(id: string): Promise<AlternantDocumentTemplate | null> {
        return getModels().AlternantDocumentTemplate.findOne({ _id: id }).lean();
    }

    async findSystemTemplate(
        type: AlternantSequenceType.J15 | AlternantSequenceType.J10W | AlternantSequenceType.SA_FINALE,
    ) {
        return getModels().AlternantDocumentTemplate.findOne({ type }).lean();
    }

    async exists(filter: Record<string, unknown>): Promise<boolean> {
        return (await getModels().AlternantDocumentTemplate.exists(filter)) !== null;
    }

    async create(
        data: Omit<AlternantDocumentTemplate, '_id' | 'created_at' | 'updated_at'>,
    ): Promise<AlternantDocumentTemplate> {
        const now = new Date();
        const doc = new (getModels().AlternantDocumentTemplate)({
            _id: randomUUID(),
            ...data,
            created_at: now,
            updated_at: now,
        });
        await doc.save();
        return doc.toObject() as AlternantDocumentTemplate;
    }

    async update(id: string, patch: Record<string, unknown>): Promise<AlternantDocumentTemplate | null> {
        return getModels()
            .AlternantDocumentTemplate.findOneAndUpdate(
                { _id: id },
                { $set: { ...patch, updated_at: new Date() } },
                { returnDocument: 'after', runValidators: true, context: 'query' },
            )
            .lean();
    }

    async delete(id: string): Promise<boolean> {
        return (await getModels().AlternantDocumentTemplate.deleteOne({ _id: id })).deletedCount > 0;
    }
}

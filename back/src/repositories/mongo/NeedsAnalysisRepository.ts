import { NeedsAnalysisModel } from '../../db/mongo/schemas/needsAnalysis.schema';
import { NeedsAnalysis, NeedsAnalysisStatus } from '../../types/needsAnalysisNoSql.types';
import { decodeCursor } from '../../services/pagination';

/**
 * Curseur de keyset pour le tri (created_at DESC, _id ASC) : date de création ISO
 * (vide si absente) et _id séparés par « | ». Pagination déterministe et indexable.
 */
export function encodeNeedsAnalysisCursor(doc: Pick<NeedsAnalysis, '_id' | 'created_at'>): string {
    const iso = doc.created_at ? new Date(doc.created_at).toISOString() : '';
    return `${iso}|${doc._id}`;
}

function parseNeedsAnalysisCursor(raw: string): { createdAt: Date | null; id: string } {
    const sep = raw.indexOf('|');
    const isoPart = sep >= 0 ? raw.slice(0, sep) : '';
    const idPart = sep >= 0 ? raw.slice(sep + 1) : raw;
    return { createdAt: isoPart ? new Date(isoPart) : null, id: idPart };
}

export class NeedsAnalysisRepository {
    async findAll(): Promise<NeedsAnalysis[]> {
        return NeedsAnalysisModel.find().lean();
    }

    async findPage(first: number, after?: string, restrictIds?: string[]): Promise<NeedsAnalysis[]> {
        const conditions: Record<string, any>[] = [];
        if (restrictIds) {
            conditions.push({ _id: { $in: restrictIds } });
        }
        if (after) {
            const { createdAt, id } = parseNeedsAnalysisCursor(decodeCursor(after));
            if (createdAt) {
                conditions.push({
                    $or: [
                        { created_at: { $lt: createdAt } },
                        { created_at: createdAt, _id: { $gt: id } },
                        // Les non datées suivent toujours n'importe quelle fiche datée.
                        { created_at: null },
                    ],
                });
            } else {
                conditions.push({ created_at: null, _id: { $gt: id } });
            }
        }
        const filter = conditions.length ? { $and: conditions } : {};
        return NeedsAnalysisModel.find(filter)
            .sort({ created_at: -1, _id: 1 })
            .limit(first + 1)
            .lean();
    }

    async findById(id: string): Promise<NeedsAnalysis | null> {
        return NeedsAnalysisModel.findOne({ _id: id }).lean();
    }

    async findByCompanyId(companyId: number): Promise<NeedsAnalysis[]> {
        return NeedsAnalysisModel.find({ 'company_infos.id': companyId }).lean();
    }

    async findBySignatureRequestId(signatureRequestId: string): Promise<NeedsAnalysis | null> {
        return NeedsAnalysisModel.findOne({ signature_request_id: signatureRequestId }).lean();
    }

    async create(data: NeedsAnalysis): Promise<NeedsAnalysis> {
        const doc = new NeedsAnalysisModel(data);
        await doc.save();
        return doc.toObject() as NeedsAnalysis;
    }

    async update(id: string, data: Partial<NeedsAnalysis>): Promise<NeedsAnalysis | null> {
        const { _id, ...patch } = data;
        return NeedsAnalysisModel.findOneAndUpdate({ _id: id }, { $set: patch }, { new: true }).lean();
    }

    async delete(id: string): Promise<boolean> {
        return (await NeedsAnalysisModel.deleteOne({ _id: id })).deletedCount > 0;
    }

    async findByStatusNotBrouillon(limit: number = 10, regions?: string[]): Promise<NeedsAnalysis[]> {
        const filter: Record<string, any> = { status: { $ne: NeedsAnalysisStatus.BROUILLON } };
        if (regions?.length) {
            filter['company_infos.sector'] = { $in: regions };
        }
        return NeedsAnalysisModel.find(filter)
            .sort({ created_at: -1 })
            .limit(limit)
            .lean();
    }

    async countByStatusNotBrouillon(regions?: string[]): Promise<number> {
        const filter: Record<string, any> = { status: { $ne: NeedsAnalysisStatus.BROUILLON } };
        if (regions?.length) {
            filter['company_infos.sector'] = { $in: regions };
        }
        return NeedsAnalysisModel.countDocuments(filter);
    }
}

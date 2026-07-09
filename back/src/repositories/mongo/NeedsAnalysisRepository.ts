import { NeedsAnalysisModel } from '../../db/mongo/schemas/needsAnalysis.schema';
import { NeedsAnalysis } from '../../types/needsAnalysisNoSql.types';

export class NeedsAnalysisRepository {
    async findAll(): Promise<NeedsAnalysis[]> {
        return NeedsAnalysisModel.find().lean();
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
}

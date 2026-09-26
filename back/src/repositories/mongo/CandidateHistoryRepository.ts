import { getModels } from '../../db/mongo/tenant';
import { CandidateHistoryEntry } from '../../types/candidate.types';

export class CandidateHistoryRepository {
    async create(data: Partial<CandidateHistoryEntry>): Promise<CandidateHistoryEntry> {
        const doc = new (getModels().CandidateHistory)(data);
        await doc.save();
        return doc.toObject() as CandidateHistoryEntry;
    }

    async findByCandidateId(candidateId: string): Promise<CandidateHistoryEntry[]> {
        return getModels().CandidateHistory.find({ candidate_id: candidateId }).sort({ created_at: -1 }).lean();
    }

    async findById(id: string): Promise<CandidateHistoryEntry | null> {
        return getModels().CandidateHistory.findById(id).lean();
    }

    async delete(id: string): Promise<boolean> {
        return (await getModels().CandidateHistory.deleteOne({ _id: id })).deletedCount > 0;
    }
}

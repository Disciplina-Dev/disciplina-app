import { CandidateHistoryModel } from '../../db/mongo/schemas/candidateHistory.schema';
import { CandidateHistoryEntry } from '../../types/candidate.types';

export class CandidateHistoryRepository {
    async create(data: Partial<CandidateHistoryEntry>): Promise<CandidateHistoryEntry> {
        const doc = new CandidateHistoryModel(data);
        await doc.save();
        return doc.toObject() as CandidateHistoryEntry;
    }

    async findByCandidateId(candidateId: string): Promise<CandidateHistoryEntry[]> {
        return CandidateHistoryModel.find({ candidate_id: candidateId }).sort({ created_at: -1 }).lean();
    }

    async findById(id: string): Promise<CandidateHistoryEntry | null> {
        return CandidateHistoryModel.findById(id).lean();
    }

    async delete(id: string): Promise<boolean> {
        return (await CandidateHistoryModel.deleteOne({ _id: id })).deletedCount > 0;
    }
}

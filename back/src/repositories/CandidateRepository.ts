import { CandidateModel } from '../db/mongodb/schema';
import { Candidate } from '../db/mongodb/interface';

export class CandidateRepository {
    async findAll(): Promise<Candidate[]> {
        return CandidateModel.find().lean();
    }

    async create(data: Partial<Candidate>): Promise<Candidate> {
        const doc = new CandidateModel(data);
        await doc.save();
        return doc.toObject() as Candidate;
    }
}

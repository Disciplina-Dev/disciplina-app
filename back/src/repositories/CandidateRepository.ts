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

    async update(id: string, data: Partial<Candidate>): Promise<Candidate | null> {
        return CandidateModel.findOneAndUpdate({ _id: id }, { $set: data }, { new: true }).lean();
    }
}

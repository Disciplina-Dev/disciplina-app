import { CandidateModel } from '../db/mongodb/schema';
import { Candidate } from '../db/mongodb/interface';

export class CandidateRepository {
    async findAll(): Promise<Candidate[]> {
        return CandidateModel.find().lean();
    }
}

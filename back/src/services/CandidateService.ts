import { CandidateRepository } from '../repositories/CandidateRepository';
import { Candidate } from '../db/mongodb/interface';

export class CandidateService {
    private repository = new CandidateRepository();

    async findAll(): Promise<Candidate[]> {
        return this.repository.findAll();
    }
}

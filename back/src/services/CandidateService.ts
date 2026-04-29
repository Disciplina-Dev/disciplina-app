import { CandidateRepository } from '../repositories/CandidateRepository';
import { Candidate } from '../db/mongodb/interface';

export class CandidateService {
    private repository = new CandidateRepository();

    async findAll(): Promise<Candidate[]> {
        return this.repository.findAll();
    }

    async findById(id: string): Promise<Candidate | null> {
        return this.repository.findById(id);
    }

    async create(data: Partial<Candidate>): Promise<Candidate> {
        return this.repository.create(data);
    }

    async update(id: string, data: Partial<Candidate>): Promise<Candidate | null> {
        return this.repository.update(id, data);
    }

    async delete(id: string) {
        return await this.repository.delete(id);
    }
}

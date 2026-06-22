import { CandidateRepository, CandidateFilters, CandidateStats } from '../repositories/mongo/CandidateRepository';
import { JobRepository } from '../repositories/mongo/JobRepository';
import { Candidate, CandidateHistoryType } from '../types/candidate.types';
import { Job, Sector } from '../types/job.types';
import { computeAge } from '../utils/age';
import { CandidateHistoryService } from './CandidateHistoryService';
import { buildFieldChangeEntries } from './mappers/candidateFieldDiff';

export class CandidateService {
    private repository = new CandidateRepository();
    private jobRepository = new JobRepository();
    private candidateHistoryService = new CandidateHistoryService();

    async findAll(): Promise<Candidate[]> {
        return this.repository.findAll();
    }

    async findPage(first: number, after?: string, search?: string, filters?: CandidateFilters): Promise<Candidate[]> {
        return this.repository.findPage(first, after, search, filters);
    }

    async findById(id: string): Promise<Candidate | null> {
        return this.repository.findById(id);
    }

    async stats(): Promise<CandidateStats> {
        return this.repository.stats();
    }

    async create(data: Partial<Candidate>): Promise<Candidate> {
        return this.repository.create(data);
    }

    async update(id: string, data: Partial<Candidate>): Promise<Candidate | null> {
        const previous = await this.repository.findById(id);
        const updated = await this.repository.update(id, data);
        if (updated && previous) {
            for (const { description } of buildFieldChangeEntries(previous, data)) {
                await this.candidateHistoryService.recordAuto(id, CandidateHistoryType.RH, description);
            }
        }
        return updated;
    }

    async delete(id: string): Promise<boolean> {
        return this.repository.delete(id);
    }

    async matchJobs(id: string): Promise<Job[]> {
        const candidate = await this.repository.findById(id);
        if (!candidate) return [];

        const jobs = await this.jobRepository.findAll();
        return jobs.filter((job) => this.jobMatchesCandidate(job, candidate));
    }

    private jobMatchesCandidate(job: Job, candidate: Candidate): boolean {
        if (job.desired_tp && job.desired_tp !== candidate.tp_type) return false;
        if (job.driving_license_b && !candidate.identity.driving_license_b) return false;
        if (job.desired_sex && job.desired_sex !== 'MIXTE' && job.desired_sex !== candidate.identity.sex) return false;

        const candidateAge = computeAge(candidate.identity.date_of_birth) ?? candidate.identity.age;
        if (job.age_range && candidateAge != null) {
            const [min, max] = job.age_range.split('-').map(Number);
            if (!isNaN(min) && !isNaN(max) && (candidateAge < min || candidateAge > max)) return false;
        }

        if (job.localisation?.length) {
            const mobility = candidate.job_info?.geographic_mobility ?? [];
            if (!job.localisation.every((loc) => mobility.includes(loc))) return false;
        }

        if (job.sector && job.sector !== Sector.NONE && !(candidate.desired_sectors ?? []).includes(job.sector))
            return false;

        return true;
    }
}

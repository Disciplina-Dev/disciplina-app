import { CandidateRepository, CandidateFilters, CandidateStats } from '../repositories/mongo/CandidateRepository';
import { JobRepository } from '../repositories/mongo/JobRepository';
import { Candidate, CandidateHistoryType, CandidateStatus } from '../types/candidate.types';
import { Job, Sector } from '../types/job.types';
import { computeAge } from '../utils/age';
import { CandidateHistoryService } from './CandidateHistoryService';
import { buildFieldChangeEntries } from './mappers/candidateFieldDiff';

export class CandidateService {
    private repository = new CandidateRepository();
    private jobRepository = new JobRepository();
    private candidateHistoryService = new CandidateHistoryService();

    async findAll(): Promise<Candidate[]> {
        const candidates = await this.repository.findAll();
        return Promise.all(candidates.map((candidate) => this.refreshAvailability(candidate)));
    }

    async findPage(first: number, after?: string, search?: string, filters?: CandidateFilters): Promise<Candidate[]> {
        const candidates = await this.repository.findPage(first, after, search, filters);
        return Promise.all(candidates.map((candidate) => this.refreshAvailability(candidate)));
    }

    async findById(id: string): Promise<Candidate | null> {
        const candidate = await this.repository.findById(id);
        return candidate ? this.refreshAvailability(candidate) : null;
    }

    // Un candidat indisponible redevient automatiquement en recherche une fois sa date passée.
    private async refreshAvailability(candidate: Candidate): Promise<Candidate> {
        if (candidate.status !== CandidateStatus.UNAVAILABLE) return candidate;
        const availabilityDate = candidate.job_info?.availability_date;
        if (!availabilityDate || new Date(availabilityDate) > new Date()) return candidate;

        const updated = await this.repository.update(candidate._id, { status: CandidateStatus.SEEKING });
        return updated ?? { ...candidate, status: CandidateStatus.SEEKING };
    }

    async stats(sectors?: string[]): Promise<CandidateStats> {
        return this.repository.stats(sectors);
    }

    async findByEmail(email: string): Promise<Candidate | null> {
        return this.repository.findByEmail(email);
    }

    async create(data: Partial<Candidate>): Promise<Candidate> {
        return this.repository.create(data);
    }

    /**
     * Renseigne `created_at` pour un candidat créé avant l'introduction du champ,
     * à partir de sa plus ancienne entrée d'historique. Écriture directe (pas de
     * diff/historique) et une seule fois : self-healing au premier accès à la fiche.
     */
    async backfillCreatedAt(id: string): Promise<Date | null> {
        const entries = await this.candidateHistoryService.findByCandidate(id);
        if (entries.length === 0) return null;
        // findByCandidate trie par created_at décroissant → la plus ancienne est la dernière.
        const oldest = entries[entries.length - 1].created_at;
        if (!oldest) return null;
        await this.repository.update(id, { created_at: new Date(oldest) });
        return new Date(oldest);
    }

    async update(id: string, data: Partial<Candidate>): Promise<Candidate | null> {
        const updated = await this.repository.update(id, data);
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

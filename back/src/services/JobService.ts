import { JobRepository } from '../repositories/mongo/JobRepository';
import { CandidateRepository } from '../repositories/mongo/CandidateRepository';
import { CandidateService } from './CandidateService';
import { Candidate, CandidateStatus } from '../types/candidate.types';
import { Job, Localisation, MatchingCandidate, Sector, Sex } from '../types/job.types';
import { signMatchUrl } from '../external/crypto';
import { env } from '../config/env';

function matchingCandidateToGql(mc: MatchingCandidate): object {
    return {
        id: mc.id,
        fullName: mc.full_name,
        age: mc.age,
        sex: mc.sex,
        city: mc.city,
        email: mc.email,
        phone: mc.phone,
    };
}

export function toGql(job: Job & { suggestedCandidates?: MatchingCandidate[] }): object {
    return {
        id: job._id,
        companyName: job.company_name,
        ageRange: job.age_range,
        desiredTP: job.desired_tp,
        desiredSex: job.desired_sex,
        drivingLicencseB: job.driving_license_b,
        professionalExperience: job.professional_experience,
        status: job.status,
        localisation: job.localisation,
        sector: job.sector,
        matched: job.matched,
        matchedCandidate: job.matched_candidate?.map(matchingCandidateToGql),
        suggestedCandidates: job.suggestedCandidates?.map(matchingCandidateToGql),
    };
}

function fromGql(data: any): Partial<Job> {
    return {
        ...(data.companyName !== undefined && { company_name: data.companyName }),
        ...(data.ageRange !== undefined && { age_range: data.ageRange }),
        ...(data.desiredTP !== undefined && { desired_tp: data.desiredTP }),
        ...(data.desiredSex !== undefined && { desired_sex: data.desiredSex }),
        ...(data.drivingLicencseB !== undefined && { driving_license_b: data.drivingLicencseB }),
        ...(data.professionalExperience !== undefined && { professional_experience: data.professionalExperience }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.localisation !== undefined && { localisation: data.localisation }),
        ...(data.sector !== undefined && { sector: data.sector }),
        ...(data.matchedCandidate !== undefined && { matched_candidate: data.matchedCandidate }),
    };
}

function candidateToMatchingCandidate(c: Candidate): MatchingCandidate {
    const loc = c.identity.city as keyof typeof Localisation;
    return {
        id: c._id,
        full_name: c.identity.full_name,
        age: c.identity.age,
        city: Localisation[loc],
        email: c.identity.email,
        phone: c.identity.phone,
        sex: c.identity.sex as Sex,
    };
}

export class JobService {
    private repository = new JobRepository();
    private candidateRepository = new CandidateRepository();
    private candidateService = new CandidateService();

    async findAll(): Promise<object[]> {
        const jobs = await this.repository.findAll();
        return jobs.map(toGql);
    }

    async find(id: string): Promise<object | null> {
        const job = await this.repository.find(id);
        if (!job) return null;

        const filter: Record<string, any> = {};
        if (job.desired_tp) filter['tp_type'] = job.desired_tp;
        if (job.driving_license_b) filter['identity.driving_license_b'] = true;
        if (job.desired_sex !== 'MIXTE') filter['identity.sex'] = job.desired_sex;

        if (job.age_range) {
            const [min, max] = job.age_range.split('-').map(Number);
            if (!isNaN(min) && !isNaN(max)) filter['identity.age'] = { $gte: min, $lte: max };
        }

        if (job.localisation?.length) filter['job_info.geographic_mobility'] = { $all: job.localisation };
        if (job.sector !== Sector.NONE) filter['desired_sectors'] = { $all: [job.sector] };

        const candidates = await this.candidateRepository.findByfilter(filter);
        const suggestedCandidates = candidates.map(candidateToMatchingCandidate);

        return toGql({ ...job, suggestedCandidates });
    }

    async create(data: any): Promise<object> {
        const job = await this.repository.create(fromGql(data));
        return toGql(job);
    }

    async update(id: string, data: any): Promise<object | null> {
        const job = await this.repository.update(id, fromGql(data));
        return job ? toGql(job) : null;
    }

    async delete(id: string): Promise<boolean> {
        return this.repository.delete(id);
    }

    async addCandidate(jobId: string, candidateId: string): Promise<object | null> {
        const candidate = await this.candidateRepository.findById(candidateId);
        if (!candidate) throw new Error('Candidat introuvable');

        const matchingCandidate = candidateToMatchingCandidate(candidate);
        const job = await this.repository.addMatchedCandidate(jobId, matchingCandidate);
        if (!job) return null;

        await this.candidateService.update(candidateId, { status: CandidateStatus.MATCHED });
        return toGql(job);
    }

    offerResponseLinks(jobId: string, candidateId: string): { ouiUrl: string; nonUrl: string } {
        const sigOui = signMatchUrl(jobId, candidateId, 'oui');
        const sigNon = signMatchUrl(jobId, candidateId, 'non');
        return {
            ouiUrl: `${env.APP_BASE_URL}/api/matching/response?jobId=${jobId}&candidateId=${candidateId}&answer=oui&sig=${sigOui}`,
            nonUrl: `${env.APP_BASE_URL}/api/matching/response?jobId=${jobId}&candidateId=${candidateId}&answer=non&sig=${sigNon}`,
        };
    }
}

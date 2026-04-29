import { JobRepository } from '../repositories/JobRepository';
import { CandidateRepository } from '../repositories/CandidateRepository';
import { Candidate, Job, Localisation, MatchingCandidate } from '../db/mongodb/interface';

function matchingCandidateToGql(mc: MatchingCandidate): object {
    return {
        id: mc.id,
        fullName: mc.full_name,
        age: mc.age,
        sex: mc.sex,
        city: mc.city,
        email: mc.email,
        phone: mc.phone
    };
}

export function toGql(job: Job): object {
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
        matched: job.matched,
        matchedCandidate: job.matched_candidate?.map(matchingCandidateToGql)
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
        ...(data.matched !== undefined && { matched: data.matched }),
    };
}

export class JobService {
    private repository = new JobRepository();
    private externalRepositiry = new CandidateRepository();

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

        if (job.age_range) {
            const [min, max] = job.age_range.split('-').map(Number);
            if (!isNaN(min) && !isNaN(max))
                filter['identity.age'] = { $gte: min, $lte: max };
        }

        if (job.localisation?.length)
            filter['job_info.geographic_mobility'] = { $in: job.localisation };

        const candidates = await this.externalRepositiry.findByfilter(filter);

        const matched: MatchingCandidate[] = candidates.map((c: Candidate) => ({
            id: c._id,
            full_name: c.identity.full_name,
            age: c.identity.age,
            city: c.identity.city as unknown as Localisation,
            email: c.identity.email,
            phone: c.identity.phone
        }));

        console.log(matched)
        return toGql({ ...job, matched_candidate: matched });
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
}

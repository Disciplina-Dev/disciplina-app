import { JobRepository } from '../repositories/mongo/JobRepository';
import { CandidateRepository } from '../repositories/mongo/CandidateRepository';
import { CandidateService } from './CandidateService';
import { Candidate, CandidateHistoryType, CandidateStatus } from '../types/candidate.types';
import { CandidateHistoryService } from './CandidateHistoryService';
import {
    InterviewConclusion,
    ImmersionConclusion,
    Job,
    JobStatus,
    Localisation,
    MatchedCandidateStatus,
    MatchingCandidate,
    ProposedCandidate,
    ProposedCandidateAnswer,
    Sector,
    Sex,
} from '../types/job.types';
import { signMatchUrl } from '../external/crypto';
import { env } from '../config/env';
import { isInterviewDatePast } from '../utils/interview';

const INTERVIEW_CONCLUSION_TO_CANDIDATE_STATUS: Record<InterviewConclusion, CandidateStatus> = {
    [InterviewConclusion.REJECTED]: CandidateStatus.SEEKING,
    [InterviewConclusion.IMMERSING]: CandidateStatus.IMMERSING,
    [InterviewConclusion.CONTRACT]: CandidateStatus.CONTRACT,
};

const IMMERSION_CONCLUSION_TO_CANDIDATE_STATUS: Record<ImmersionConclusion, CandidateStatus> = {
    [ImmersionConclusion.REJECTED]: CandidateStatus.SEEKING,
    [ImmersionConclusion.CONTRACT]: CandidateStatus.CONTRACT,
};

function matchingCandidateToGql(mc: MatchingCandidate): object {
    return {
        id: mc.id,
        fullName: mc.full_name,
        age: mc.age,
        sex: mc.sex,
        city: mc.city,
        email: mc.email,
        phone: mc.phone,
        status: mc.status,
    };
}

function proposedCandidateToGql(pc: ProposedCandidate): object {
    return {
        ...matchingCandidateToGql(pc),
        description: pc.description,
        answer: pc.answer,
        comment: pc.comment,
        interviewLocation: pc.interview_location,
        bookedInterviewSlot: pc.booked_interview_slot,
        interviewConclusion: pc.interview_conclusion,
        immersionStartDate: pc.immersion_start_date,
        immersionEndDate: pc.immersion_end_date,
        immersionConclusion: pc.immersion_conclusion,
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
        proposedCandidate: job.proposed_candidate?.map(proposedCandidateToGql),
        interviewSlots: job.interview_slots,
        interviewLocation: job.interview_location,
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
        status: MatchedCandidateStatus.RETAINED,
    };
}

export function deriveJobStatus(matchedCandidates: MatchingCandidate[], currentStatus?: JobStatus): JobStatus {
    if (matchedCandidates.length === 0) return JobStatus.NOT_MATCHED;

    const manualStages = [JobStatus.CV_SEND, JobStatus.IMMERSING, JobStatus.CONTRACT];
    if (currentStatus && manualStages.includes(currentStatus)) return currentStatus;

    const hasAccepted = matchedCandidates.some((c) => c.status === MatchedCandidateStatus.ACCEPTED);
    return hasAccepted ? JobStatus.MATCHED : JobStatus.NOT_MATCHED;
}

export class JobService {
    private repository = new JobRepository();
    private candidateRepository = new CandidateRepository();
    private candidateService = new CandidateService();
    private candidateHistoryService = new CandidateHistoryService();

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

        await this.candidateHistoryService.recordAuto(
            candidateId,
            CandidateHistoryType.RH,
            `Le candidat a été retenu pour ${job.company_name}`,
        );
        return toGql(await this.syncDerivedStatus(jobId, job));
    }

    async removeCandidate(jobId: string, candidateId: string): Promise<object | null> {
        const job = await this.repository.removeMatchedCandidate(jobId, candidateId);
        if (!job) return null;
        return toGql(await this.syncDerivedStatus(jobId, job));
    }

    async unmatchAll(jobId: string): Promise<object | null> {
        const job = await this.repository.clearMatchedCandidates(jobId);
        return job ? toGql(job) : null;
    }

    async getMatchedJobIds(candidateId: string): Promise<string[]> {
        return this.repository.findJobIdsWithCandidate(candidateId);
    }

    async updateMatchedCandidateStatus(jobId: string, candidateId: string, status: string): Promise<object | null> {
        const job = await this.repository.setMatchedCandidateStatus(
            jobId,
            candidateId,
            status as MatchedCandidateStatus,
        );
        if (!job) return null;

        const entry = this.candidateHistoryService.buildMatchedStatusHistoryEntry(
            status as MatchedCandidateStatus,
            job.company_name,
        );
        if (entry) await this.candidateHistoryService.recordAuto(candidateId, entry.type, entry.description);
        return toGql(await this.syncDerivedStatus(jobId, job));
    }

    async addManualProposedCandidate(
        jobId: string,
        candidateId: string,
        interviewDate: string,
        interviewHour: string,
        interviewLocation: string,
        ownerEmail: string,
    ): Promise<object | null> {
        const job = await this.repository.find(jobId);
        if (!job) return null;

        const candidate = await this.candidateRepository.findById(candidateId);
        if (!candidate) throw new Error('Candidat introuvable');

        const proposed: ProposedCandidate = {
            ...candidateToMatchingCandidate(candidate),
            answer: ProposedCandidateAnswer.ACCEPTED,
            booked_interview_slot: new Date(`${interviewDate}T${interviewHour}`).toISOString(),
            interview_location: interviewLocation,
        };

        const updated = await this.repository.addProposedCandidate(jobId, proposed);
        if (!updated) return null;

        await this.candidateHistoryService.recordManual(
            candidateId,
            `Le candidat.e a un entretien avec ${job.company_name} le ${interviewDate} à ${interviewLocation}`,
            ownerEmail,
        );

        return toGql(updated);
    }

    async setInterviewConclusion(
        jobId: string,
        candidateId: string,
        conclusion: InterviewConclusion,
        immersionStartDate: string | undefined,
        immersionEndDate: string | undefined,
        ownerEmail: string,
    ): Promise<object | null> {
        const job = await this.repository.find(jobId);
        if (!job) return null;

        const proposed = job.proposed_candidate?.find((c) => c.id === candidateId);
        if (!proposed) throw new Error('Candidat proposé introuvable');

        if (!isInterviewDatePast(proposed.booked_interview_slot)) {
            throw new Error("L'entretien n'a pas encore eu lieu");
        }

        if (conclusion === InterviewConclusion.IMMERSING && (!immersionStartDate || !immersionEndDate)) {
            throw new Error("Les dates d'immersion sont requises pour cette conclusion");
        }

        const updated = await this.repository.setProposedCandidateConclusion(
            jobId,
            candidateId,
            conclusion,
            immersionStartDate,
            immersionEndDate,
        );
        if (!updated) return null;

        await this.candidateService.update(candidateId, {
            status: INTERVIEW_CONCLUSION_TO_CANDIDATE_STATUS[conclusion],
        });

        const description = this.buildInterviewConclusionHistoryEntry(
            conclusion,
            proposed.full_name,
            job.company_name,
            immersionStartDate,
            immersionEndDate,
        );
        await this.candidateHistoryService.recordManual(candidateId, description, ownerEmail);

        return toGql(updated);
    }

    async setImmersionConclusion(
        jobId: string,
        candidateId: string,
        conclusion: ImmersionConclusion,
        ownerEmail: string,
    ): Promise<object | null> {
        const job = await this.repository.find(jobId);
        if (!job) return null;

        const proposed = job.proposed_candidate?.find((c) => c.id === candidateId);
        if (!proposed) throw new Error('Candidat proposé introuvable');

        if (proposed.interview_conclusion !== InterviewConclusion.IMMERSING) {
            throw new Error("Ce candidat n'est pas en immersion");
        }

        const updated = await this.repository.setProposedCandidateImmersionConclusion(jobId, candidateId, conclusion);
        if (!updated) return null;

        await this.candidateService.update(candidateId, {
            status: IMMERSION_CONCLUSION_TO_CANDIDATE_STATUS[conclusion],
        });

        const description = this.buildImmersionConclusionHistoryEntry(conclusion, proposed.full_name, job.company_name);
        await this.candidateHistoryService.recordManual(candidateId, description, ownerEmail);

        return toGql(updated);
    }

    private buildImmersionConclusionHistoryEntry(
        conclusion: ImmersionConclusion,
        candidateName?: string,
        companyName?: string,
    ): string {
        switch (conclusion) {
            case ImmersionConclusion.REJECTED:
                return `L'immersion c'est soldée par un rejet entre ${candidateName} et ${companyName}`;
            case ImmersionConclusion.CONTRACT:
                return `L'immersion c'est soldée par un contrat avec ${companyName}`;
        }
    }

    private buildInterviewConclusionHistoryEntry(
        conclusion: InterviewConclusion,
        candidateName?: string,
        companyName?: string,
        immersionStartDate?: string,
        immersionEndDate?: string,
    ): string {
        switch (conclusion) {
            case InterviewConclusion.REJECTED:
                return `L'entretien c'est soldé par un rejet entre ${candidateName} et ${companyName}`;
            case InterviewConclusion.IMMERSING:
                return `L'entretien c'est soldé par une immersion du ${immersionStartDate} au ${immersionEndDate} avec ${companyName}`;
            case InterviewConclusion.CONTRACT:
                return `L'entretien c'est soldé par un contrat avec ${companyName}`;
        }
    }

    private async syncDerivedStatus(jobId: string, job: Job): Promise<Job> {
        const derived = deriveJobStatus(job.matched_candidate ?? [], job.status);
        if (derived === job.status) return job;
        const updated = await this.repository.update(jobId, { status: derived });
        return updated ?? job;
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

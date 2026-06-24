import { JobModel } from '../../db/mongo/schemas/job.schema';
import {
    Job,
    JobStatus,
    MatchedCandidateStatus,
    MatchingCandidate,
    ProposedCandidate,
    ProposedCandidateAnswer,
} from '../../types/job.types';

type FlattenedObject = Record<string, any>;

function flattenObject(obj: any, parentKey: string = ''): FlattenedObject {
    const result: FlattenedObject = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            if (key.startsWith('$') || key.startsWith('__')) continue;
            const value = obj[key];
            const newKey = parentKey ? `${parentKey}.${key}` : key;
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                Object.assign(result, flattenObject(value, newKey));
            } else if (value) {
                result[newKey] = value;
            }
        }
    }
    return result;
}

export class JobRepository {
    async findAll(): Promise<Job[]> {
        return JobModel.find().lean();
    }

    async find(id: string): Promise<Job | null> {
        return JobModel.findOne({ _id: id }).lean();
    }

    async create(data: Partial<Job>): Promise<Job> {
        const doc = new JobModel(data);
        await doc.save();
        return doc.toObject() as Job;
    }

    async update(id: string, data: Partial<Job>): Promise<Job | null> {
        return JobModel.findOneAndUpdate({ _id: id }, { $set: flattenObject(data) }, { new: true }).lean();
    }

    async delete(id: string): Promise<boolean> {
        return (await JobModel.deleteOne({ _id: id })).deletedCount > 0;
    }

    async addMatchedCandidate(jobId: string, candidate: MatchingCandidate): Promise<Job | null> {
        return JobModel.findOneAndUpdate(
            { _id: jobId, 'matched_candidate.id': { $ne: candidate.id } },
            { $push: { matched_candidate: candidate } },
            { new: true },
        ).lean();
    }

    async removeMatchedCandidate(jobId: string, candidateId: string): Promise<Job | null> {
        return JobModel.findOneAndUpdate(
            { _id: jobId },
            { $pull: { matched_candidate: { id: candidateId } } },
            { new: true },
        ).lean();
    }

    async clearMatchedCandidates(jobId: string): Promise<Job | null> {
        return JobModel.findOneAndUpdate(
            { _id: jobId },
            { $set: { matched_candidate: [], status: JobStatus.NOT_MATCHED } },
            { new: true },
        ).lean();
    }

    async setMatchedCandidateStatus(
        jobId: string,
        candidateId: string,
        status: MatchedCandidateStatus,
    ): Promise<Job | null> {
        return JobModel.findOneAndUpdate(
            { _id: jobId, 'matched_candidate.id': candidateId },
            { $set: { 'matched_candidate.$.status': status } },
            { new: true },
        ).lean();
    }

    async addProposedCandidate(jobId: string, candidate: ProposedCandidate): Promise<Job | null> {
        return JobModel.findOneAndUpdate(
            { _id: jobId, 'proposed_candidate.id': { $ne: candidate.id } },
            { $push: { proposed_candidate: candidate } },
            { new: true },
        ).lean();
    }

    async setProposedCandidates(jobId: string, proposed: ProposedCandidate[]): Promise<Job | null> {
        return JobModel.findOneAndUpdate(
            { _id: jobId },
            { $set: { proposed_candidate: proposed, status: JobStatus.CV_SEND } },
            { new: true },
        ).lean();
    }

    async setProposedCandidateAnswer(
        jobId: string,
        candidateId: string,
        answer: ProposedCandidateAnswer,
        comment?: string,
    ): Promise<Job | null> {
        const update: Record<string, unknown> = { 'proposed_candidate.$.answer': answer };
        if (comment) update['proposed_candidate.$.comment'] = comment;
        return JobModel.findOneAndUpdate(
            { _id: jobId, 'proposed_candidate.id': candidateId },
            { $set: update },
            { new: true },
        ).lean();
    }

    async setJobInterviewSlots(jobId: string, slots: string[], location?: string): Promise<Job | null> {
        const update: Record<string, unknown> = { interview_slots: slots };
        if (location) update.interview_location = location;
        return JobModel.findOneAndUpdate({ _id: jobId }, { $set: update }, { new: true }).lean();
    }

    /** Atomic, race-safe: fails (returns null) if the slot was already taken by anyone, or the candidate is invalid/already booked. */
    async bookInterviewSlot(jobId: string, candidateId: string, slot: string): Promise<Job | null> {
        return JobModel.findOneAndUpdate(
            {
                _id: jobId,
                interview_slots: slot,
                'proposed_candidate.booked_interview_slot': { $ne: slot },
                proposed_candidate: { $elemMatch: { id: candidateId, booked_interview_slot: { $exists: false } } },
            },
            { $set: { 'proposed_candidate.$[c].booked_interview_slot': slot } },
            { arrayFilters: [{ 'c.id': candidateId }], new: true },
        ).lean();
    }

    async findJobIdsWithCandidate(candidateId: string): Promise<string[]> {
        const jobs = await JobModel.find({ 'matched_candidate.id': candidateId }, { _id: 1 }).lean();
        return jobs.map((j) => String(j._id));
    }
}

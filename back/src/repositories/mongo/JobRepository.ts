import { JobModel } from '../../db/mongo/schemas/job.schema';
import { Job, JobStatus, MatchingCandidate } from '../../types/job.types';

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
            { $push: { matched_candidate: candidate }, $set: { status: JobStatus.MATCHED } },
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

    async findJobIdsWithCandidate(candidateId: string): Promise<string[]> {
        const jobs = await JobModel.find({ 'matched_candidate.id': candidateId }, { _id: 1 }).lean();
        return jobs.map((j) => String(j._id));
    }
}

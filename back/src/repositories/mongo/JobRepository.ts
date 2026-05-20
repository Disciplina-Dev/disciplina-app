import { JobModel } from '../../db/mongo/schemas/job.schema';
import { Job } from '../../types/job.types';

type FlattenedObject = Record<string, any>;

function flattenObject(obj: any, parentKey: string = ''): FlattenedObject {
    const result: FlattenedObject = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
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
}

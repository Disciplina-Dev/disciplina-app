import { CandidateModel } from '../db/mongodb/schema';
import { Candidate } from '../db/mongodb/interface';
type FlattenedObject = Record<string, any>;

function flattenObject(obj: any, parentKey: string = ''): FlattenedObject {
    const result: FlattenedObject = {};

    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const value = obj[key];
            const newKey = parentKey ? `${parentKey}.${key}` : key;

            if (value && typeof value === 'object' && !Array.isArray(value)) {
                Object.assign(result, flattenObject(value, newKey));
            } else {
                result[newKey] = value;
            }
        }
    }

    return result;
}

export class CandidateRepository {
    async findAll(): Promise<Candidate[]> {
        return CandidateModel.find().lean();
    }

    async create(data: Partial<Candidate>): Promise<Candidate> {
        const doc = new CandidateModel(data);
        await doc.save();
        return doc.toObject() as Candidate;
    }

    async update(id: string, data: Partial<Candidate>): Promise<Candidate | null> {
        return CandidateModel.findOneAndUpdate({ _id: id }, { $set: flattenObject(data) }, { new: true }).lean();
    }
}

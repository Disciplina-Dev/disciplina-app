import { CandidateModel } from '../../db/mongo/schemas/candidate.schema';
import { Candidate } from '../../types/candidate.types';
import { decodeCursor } from '../../services/pagination';

export interface CandidateFilters {
    trainingSite?: string;
    status?: string;
    schoolLevel?: string;
    drivingLicenseB?: boolean;
    ageMin?: number;
    ageMax?: number;
    tpType?: string;
}

function escapeRegexSpecialChars(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

type FlattenedObject = Record<string, any>;

function flattenObject(obj: any, parentKey: string = ''): FlattenedObject {
    const result: FlattenedObject = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            if (key.startsWith('$') || key.startsWith('__')) continue;
            const value = obj[key];
            const newKey = parentKey ? `${parentKey}.${key}` : key;
            if (value instanceof Date) {
                result[newKey] = value;
            } else if (value && typeof value === 'object' && !Array.isArray(value)) {
                Object.assign(result, flattenObject(value, newKey));
            } else if (value) {
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

    async findPage(first: number, after?: string, search?: string, filters?: CandidateFilters): Promise<Candidate[]> {
        const conditions: Record<string, any>[] = [];

        const trimmedSearch = search?.trim();
        if (trimmedSearch) {
            conditions.push({
                'identity.full_name': { $regex: escapeRegexSpecialChars(trimmedSearch), $options: 'i' },
            });
        }
        if (filters?.trainingSite) conditions.push({ training_site: filters.trainingSite });
        if (filters?.status) conditions.push({ status: filters.status });
        if (filters?.schoolLevel) conditions.push({ 'education.school_level': filters.schoolLevel });
        if (filters?.drivingLicenseB !== undefined)
            conditions.push({ 'identity.driving_license_b': filters.drivingLicenseB });
        if (filters?.tpType) conditions.push({ tp_type: filters.tpType });
        if (filters?.ageMin != null || filters?.ageMax != null) {
            const ageCondition: Record<string, number> = {};
            if (filters.ageMin != null) ageCondition.$gte = filters.ageMin;
            if (filters.ageMax != null) ageCondition.$lte = filters.ageMax;
            conditions.push({ 'identity.age': ageCondition });
        }

        if (after && !trimmedSearch) {
            conditions.push({ _id: { $gt: decodeCursor(after) } });
        }

        const filter = conditions.length ? { $and: conditions } : {};
        const query = CandidateModel.find(filter).sort({ _id: 1 });
        if (!trimmedSearch) {
            query.limit(first + 1);
        }
        return query.lean();
    }

    async findById(id: string): Promise<Candidate | null> {
        return CandidateModel.findById(id).lean();
    }

    async findByfilter(filter: Record<string, any>): Promise<Candidate[]> {
        return CandidateModel.find(filter).lean();
    }

    async create(data: Partial<Candidate>): Promise<Candidate> {
        const doc = new CandidateModel(data);
        await doc.save();
        return doc.toObject() as Candidate;
    }

    async update(id: string, data: Partial<Candidate>): Promise<Candidate | null> {
        return CandidateModel.findOneAndUpdate({ _id: id }, { $set: flattenObject(data) }, { new: true }).lean();
    }

    async delete(id: string): Promise<boolean> {
        return (await CandidateModel.deleteOne({ _id: id })).deletedCount > 0;
    }
}

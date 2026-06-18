import { CandidateModel } from '../../db/mongo/schemas/candidate.schema';
import { Candidate } from '../../types/candidate.types';
import { decodeCursor } from '../../services/pagination';
import { after } from 'cheerio/dist/commonjs/api/manipulation';

export interface StatBucket {
    key: string;
    count: number;
}

export interface TpStatusBucket {
    tpType: string;
    status: string;
    count: number;
}

export interface CandidateStats {
    total: number;
    byStatus: StatBucket[];
    byTpType: StatBucket[];
    byTrainingSite: StatBucket[];
    byTpAndStatus: TpStatusBucket[];
}

interface RawStats {
    total: { count: number }[];
    byStatus: { _id: unknown; count: number }[];
    byTpType: { _id: unknown; count: number }[];
    byTrainingSite: { _id: unknown; count: number }[];
    byTpAndStatus: { _id: { tpType: unknown; status: unknown }; count: number }[];
}

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

/** Date à laquelle un candidat né aurait exactement `years` ans aujourd'hui. */
function yearsAgo(years: number): Date {
    const d = new Date();
    d.setFullYear(d.getFullYear() - years);
    return d;
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
            } else if (value || value === '') {
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
            // Âge dérivé de la date de naissance (toujours à jour). Fallback sur l'âge
            // stocké pour les candidats sans date de naissance.
            const dobCondition: Record<string, Date> = {};
            const ageCondition: Record<string, number> = {};
            if (filters.ageMin != null) {
                // âge >= ageMin → né au plus tard il y a ageMin ans
                dobCondition.$lte = yearsAgo(filters.ageMin);
                ageCondition.$gte = filters.ageMin;
            }
            if (filters.ageMax != null) {
                // âge <= ageMax → né au plus tôt il y a (ageMax + 1) ans + 1 jour
                const earliest = yearsAgo(filters.ageMax + 1);
                earliest.setDate(earliest.getDate() + 1);
                dobCondition.$gte = earliest;
                ageCondition.$lte = filters.ageMax;
            }
            conditions.push({
                $or: [
                    { 'identity.date_of_birth': dobCondition },
                    { 'identity.date_of_birth': null, 'identity.age': ageCondition },
                ],
            });
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

    /**
     * Statistiques agrégées des candidats, calculées côté MongoDB via un seul
     * pipeline `$facet` (aucun document n'est rapatrié dans Node). Renvoie les
     * répartitions par statut, par type de TP, par site de formation, ainsi que
     * le croisement statut × TP pour les graphiques empilés.
     */
    async stats(): Promise<CandidateStats> {
        const [result] = await CandidateModel.aggregate<RawStats>([
            {
                $facet: {
                    total: [{ $count: 'count' }],
                    byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
                    byTpType: [{ $group: { _id: '$tp_type', count: { $sum: 1 } } }],
                    byTrainingSite: [{ $group: { _id: '$training_site', count: { $sum: 1 } } }],
                    byTpAndStatus: [{ $group: { _id: { tpType: '$tp_type', status: '$status' }, count: { $sum: 1 } } }],
                },
            },
        ]);

        const toBuckets = (rows: { _id: unknown; count: number }[]) =>
            rows.filter((r) => r._id != null).map((r) => ({ key: String(r._id), count: r.count }));

        return {
            total: result?.total[0]?.count ?? 0,
            byStatus: toBuckets(result?.byStatus ?? []),
            byTpType: toBuckets(result?.byTpType ?? []),
            byTrainingSite: toBuckets(result?.byTrainingSite ?? []),
            byTpAndStatus: (result?.byTpAndStatus ?? [])
                .filter((r) => r._id?.tpType != null && r._id?.status != null)
                .map((r) => ({ tpType: String(r._id.tpType), status: String(r._id.status), count: r.count })),
        };
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
        return CandidateModel.findOneAndUpdate(
            { _id: id },
            { $set: flattenObject(data) },
            { returnDocument: 'after' },
        ).lean();
    }

    async delete(id: string): Promise<boolean> {
        return (await CandidateModel.deleteOne({ _id: id })).deletedCount > 0;
    }
}

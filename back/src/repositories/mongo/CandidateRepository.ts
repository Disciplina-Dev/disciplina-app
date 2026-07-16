import { CandidateModel } from '../../db/mongo/schemas/candidate.schema';
import { Candidate, CandidateStatus } from '../../types/candidate.types';
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
    /** Villes de mobilité géographique souhaitées (OR). */
    geographicMobility?: string[];
    /** Secteurs d'activité souhaités (OR). */
    desiredSectors?: string[];
    /** Bornes sur la date de création (incluses). */
    createdAfter?: Date;
    createdBefore?: Date;
    /** Ne renvoyer que les fiches sans date de création (héritées). */
    createdMissing?: boolean;
}

/**
 * Curseur de keyset pour le tri (created_at DESC, _id ASC). Encode la date de
 * création (ISO, vide si absente) et l'_id, séparés par « | » (absent des UUID
 * et des dates ISO). Permet une pagination déterministe et indexable.
 */
export function encodeCandidateCursor(candidate: Pick<Candidate, '_id' | 'created_at'>): string {
    const iso = candidate.created_at ? new Date(candidate.created_at).toISOString() : '';
    return `${iso}|${candidate._id}`;
}

function parseCandidateCursor(raw: string): { createdAt: Date | null; id: string } {
    const sep = raw.indexOf('|');
    const isoPart = sep >= 0 ? raw.slice(0, sep) : '';
    const idPart = sep >= 0 ? raw.slice(sep + 1) : raw;
    return { createdAt: isoPart ? new Date(isoPart) : null, id: idPart };
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
            } else if (value !== undefined && value !== null) {
                // Garde les valeurs falsy légitimes (false, 0, '') — seuls undefined/null sont ignorés.
                result[newKey] = value;
            }
        }
    }
    return result;
}

export class CandidateRepository {
    async findAll(): Promise<Candidate[]> {
        return CandidateModel.find().sort({ created_at: -1, _id: 1 }).lean();
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
        // Mobilité et secteurs sont des tableaux côté document : `$in` matche si
        // l'un des choix du candidat figure parmi les valeurs sélectionnées (OR).
        if (filters?.geographicMobility?.length)
            conditions.push({ 'job_info.geographic_mobility': { $in: filters.geographicMobility } });
        if (filters?.desiredSectors?.length) conditions.push({ desired_sectors: { $in: filters.desiredSectors } });
        if (filters?.createdMissing) {
            // `null` matche aussi le champ absent en Mongo → couvre les fiches héritées.
            conditions.push({ created_at: null });
        } else {
            if (filters?.createdAfter) conditions.push({ created_at: { $gte: filters.createdAfter } });
            if (filters?.createdBefore) conditions.push({ created_at: { $lte: filters.createdBefore } });
        }
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

        // Keyset sur (created_at DESC, _id ASC) : les fiches datées les plus récentes
        // d'abord, les non datées (created_at absent) en dernier.
        if (after && !trimmedSearch) {
            const { createdAt, id } = parseCandidateCursor(decodeCursor(after));
            if (createdAt) {
                conditions.push({
                    $or: [
                        { created_at: { $lt: createdAt } },
                        { created_at: createdAt, _id: { $gt: id } },
                        // Les non datées suivent toujours n'importe quelle fiche datée.
                        { created_at: null },
                    ],
                });
            } else {
                // Déjà dans la zone non datée : on avance uniquement sur l'_id.
                conditions.push({ created_at: null, _id: { $gt: id } });
            }
        }

        const filter = conditions.length ? { $and: conditions } : {};
        const query = CandidateModel.find(filter).sort({ created_at: -1, _id: 1 });
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
    async stats(sectors?: string[]): Promise<CandidateStats> {
        // Filtre optionnel par secteur du créateur du dossier (owner.sector).
        const match = sectors && sectors.length > 0 ? [{ $match: { 'owner.sector': { $in: sectors } } }] : [];
        const [result] = await CandidateModel.aggregate<RawStats>([
            ...match,
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

    // Candidats dont l'immersion s'est terminée (date de fin passée) et pour
    // lesquels la notification « immersion terminée » n'a pas encore été émise.
    // Sert au scheduler de notification d'immersion.
    async findImmersionEndedUnnotified(now: Date): Promise<Candidate[]> {
        return CandidateModel.find({
            immersion_end_date: { $ne: null, $lte: now },
            immersion_end_notified_at: null,
        }).lean();
    }

    // Marque la notification « immersion terminée » comme émise (dédup scheduler).
    async markImmersionEndNotified(id: string, at: Date): Promise<void> {
        await CandidateModel.updateOne({ _id: id }, { $set: { immersion_end_notified_at: at } });
    }

    // Candidats indisponibles dont la date de disponibilité est atteinte (fin
    // d'indisponibilité). Sert au scheduler de retour en recherche.
    async findExpiredUnavailable(now: Date): Promise<Candidate[]> {
        return CandidateModel.find({
            status: CandidateStatus.UNAVAILABLE,
            'job_info.availability_date': { $ne: null, $lte: now },
        }).lean();
    }

    // Repasse un candidat indisponible en recherche, de façon atomique : la mise à
    // jour n'a lieu que si le statut est encore UNAVAILABLE. Retourne true si ce
    // candidat vient d'être basculé (⇒ un seul appelant notifie, dédup lecture/scheduler).
    async revertUnavailableToSeeking(id: string): Promise<boolean> {
        const res = await CandidateModel.updateOne(
            { _id: id, status: CandidateStatus.UNAVAILABLE },
            { $set: { status: CandidateStatus.SEEKING } },
        );
        return res.modifiedCount > 0;
    }

    // Recherche par email (exact, insensible à la casse + espaces) pour la
    // détection de doublons à la création.
    async findByEmail(email: string): Promise<Candidate | null> {
        const normalized = email.trim();
        if (!normalized) return null;
        const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return CandidateModel.findOne({ 'identity.email': { $regex: `^${escaped}$`, $options: 'i' } }).lean();
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

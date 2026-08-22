import { CandidateModel } from '../../db/mongo/schemas/candidate.schema';
import { Candidate, CandidateStatus } from '../../types/candidate.types';
import { decodeCursor } from '../../services/pagination';

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

/** Champ ciblé par la recherche libre (candidatesPage → search + searchField). */
export type CandidateSearchField = 'NAME' | 'PHONE' | 'EMAIL';

export interface CandidateFilters {
    trainingSite?: string;
    status?: string;
    statusIn?: string[];
    schoolLevel?: string;
    drivingLicenseB?: boolean;
    /** Sexe du candidat (FILLE / GARCON), exclusif. */
    sex?: string;
    ageMin?: number;
    ageMax?: number;
    /** Titres professionnels visés (OR). */
    tpType?: string[];
    /** Villes de mobilité géographique souhaitées (OR). */
    geographicMobility?: string[];
    /** Secteurs d'activité souhaités (OR). */
    desiredSectors?: string[];
    /** Bornes sur la date de création (incluses). */
    createdAfter?: Date;
    createdBefore?: Date;
    /** Ne renvoyer que les fiches sans date de création (héritées). */
    createdMissing?: boolean;
    /** Filtrer par le RH qui a mené l'entretien (nom complet). */
    interviewedBy?: string;
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

/** Limites défensives pour la recherche libre (évite `$regex` démesuré / ReDoS). */
const MAX_SEARCH_LENGTH = 100;
const MAX_SEARCH_TOKENS = 10;

/** Normalise l'entrée utilisateur : trim, collapse whitespace, tronque. */
function normalizeSearchInput(raw: string): string {
    return raw.trim().replace(/\s+/g, ' ').slice(0, MAX_SEARCH_LENGTH);
}

/** Découpe une recherche déjà normalisée en tokens (max `MAX_SEARCH_TOKENS`). */
function tokenizeSearch(normalized: string): string[] {
    if (!normalized) return [];
    return normalized.split(' ').filter(Boolean).slice(0, MAX_SEARCH_TOKENS);
}

/** Collation insensible à la casse et aux accents (français, strength 1). */
const SEARCH_COLLATION = { locale: 'fr', strength: 1 } as const;

/** Classes insensibles aux accents pour le `$regex` (symétrique : « Solene » ↔ « Solène »).
 *  Chaque voyelle/consonne accentuée est ramenée à sa base puis élargie à un bracket
 *  qui matche toutes les variantes. Sans cela, collation seule est asymétrique selon
 *  que le pattern porte l'accent ou non (« Solène » trouvait les deux, « Solene »
 *  ne trouvait que « Solene »). */
const ACCENT_CLASSES: Record<string, string> = {
    a: '[aàáâãäåæ]',
    e: '[eèéêë]',
    i: '[iìíîï]',
    o: '[oòóôõöø]',
    u: '[uùúûü]',
    c: '[cç]',
    n: '[nñ]',
    y: '[yÿ]',
};

function diacriticInsensitivePattern(token: string): string {
    let out = '';
    for (const ch of token) {
        if (/[.*+?^${}()|[\]\\]/.test(ch)) {
            out += `\\${ch}`;
            continue;
        }
        const base = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        if (ACCENT_CLASSES[base]) {
            out += ACCENT_CLASSES[base];
        } else {
            out += escapeRegexSpecialChars(ch);
        }
    }
    return out;
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

    /** Construit les conditions Mongo dérivées des filtres (hors recherche et curseur). */
    private buildConditions(filters?: CandidateFilters): Record<string, any>[] {
        const conditions: Record<string, any>[] = [];

        if (filters?.trainingSite) conditions.push({ training_site: filters.trainingSite });
        if (filters?.statusIn?.length) conditions.push({ status: { $in: filters.statusIn } });
        else if (filters?.status) conditions.push({ status: filters.status });
        if (filters?.schoolLevel) conditions.push({ 'education.school_level': filters.schoolLevel });
        if (filters?.drivingLicenseB !== undefined)
            conditions.push({ 'identity.driving_license_b': filters.drivingLicenseB });
        if (filters?.sex) conditions.push({ 'identity.sex': filters.sex });
        // tp_type legacy encore présent sur d'anciens documents non nettoyés (cf.
        // scripts/cleanup_candidate_tp_type.py) : $or transitoire, à retirer une fois
        // la migration terminée et le script de nettoyage passé.
        if (filters?.tpType?.length)
            conditions.push({
                $or: [{ tp_types: { $in: filters.tpType } }, { tp_type: { $in: filters.tpType } }],
            });
        // Mobilité et secteurs sont des tableaux côté document : `$in` matche si
        // l'un des choix du candidat figure parmi les valeurs sélectionnées (OR).
        if (filters?.geographicMobility?.length)
            conditions.push({ 'job_info.geographic_mobility': { $in: filters.geographicMobility } });
        if (filters?.desiredSectors?.length) conditions.push({ desired_sectors: { $in: filters.desiredSectors } });
        if (filters?.interviewedBy) conditions.push({ 'synthesis.interviewed_by': filters.interviewedBy });
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
        return conditions;
    }

    /**
     * Construit le filtre de recherche libre pour un champ ciblé (NAME / PHONE /
     * EMAIL). Pour NAME, on conserve la double branche historique `$text` ∪
     * `$regex` (description + nom) ; pour PHONE / EMAIL on ne cible que le champ
     * correspondant via `$regex` (les emails/téléphones ne figurent pas dans
     * l'index full-text). La branche `$regex` est désormais tokenisée (AND
     * ordonné-indépendant) pour que « Test Example » matche « Example Test »,
     * préserve le préfixe/sous-chaîne par token (ex. « jea » → « Jean ») et reste
     * insensible à la casse/aux accents via collation `fr` strength 1.
     */
    private buildSearchFilter(
        trimmedSearch: string,
        conditions: Record<string, any>[],
        searchField?: CandidateSearchField,
    ): { textFilter?: Record<string, any>; regexFilter: Record<string, any> } {
        const normalized = normalizeSearchInput(trimmedSearch);
        const tokens = tokenizeSearch(normalized);

        if (searchField === 'PHONE') {
            const regexPattern = escapeRegexSpecialChars(normalized);
            return {
                regexFilter: { $and: [...conditions, { 'identity.phone': { $regex: regexPattern, $options: 'i' } }] },
            };
        }

        if (searchField === 'EMAIL') {
            const regexPattern = escapeRegexSpecialChars(normalized);
            return {
                regexFilter: { $and: [...conditions, { 'identity.email': { $regex: regexPattern, $options: 'i' } }] },
            };
        }

        // Recherche par défaut / nom : combinaison `$text` (français, stemming) ∪ `$regex` tokenisé.
        const quotedPhrase = `"${normalized.replace(/"/g, "'")}"`;
        const textFilter = { $and: [...conditions, { $text: { $search: quotedPhrase, $language: 'french' } }] };

        // Tokenisation : chaque token doit apparaître (AND) dans `full_name` OU `description`
        // (par token), indépendamment de l'ordre — corrige « Test Example » vs « Example Test ».
        // Les patterns sont insensibles aux accents dans les deux sens (Solene ↔ Solène)
        // via `diacriticInsensitivePattern`, car la collation seule est asymétrique.
        if (tokens.length <= 1) {
            const singlePattern = diacriticInsensitivePattern(tokens[0] ?? normalized);
            return {
                textFilter,
                regexFilter: {
                    $and: [
                        ...conditions,
                        {
                            $or: [
                                { 'identity.description': { $regex: singlePattern, $options: 'i' } },
                                { 'identity.full_name': { $regex: singlePattern, $options: 'i' } },
                            ],
                        },
                    ],
                },
            };
        }

        const diacriticTokens = tokens.map(diacriticInsensitivePattern);
        const tokenClauses = diacriticTokens.map((t) => ({
            $or: [
                { 'identity.description': { $regex: t, $options: 'i' } },
                { 'identity.full_name': { $regex: t, $options: 'i' } },
            ],
        }));

        return {
            textFilter,
            regexFilter: { $and: [...conditions, ...tokenClauses] },
        };
    }

    async findPage(
        first: number,
        after?: string,
        search?: string,
        filters?: CandidateFilters,
        searchField?: CandidateSearchField,
    ): Promise<Candidate[]> {
        const conditions = this.buildConditions(filters);

        const normalizedSearch = search ? normalizeSearchInput(search) : '';
        const trimmedSearch = normalizedSearch || undefined;
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

        if (!trimmedSearch) {
            const filter = conditions.length ? { $and: conditions } : {};
            return CandidateModel.find(filter)
                .sort({ created_at: -1, _id: 1 })
                .limit(first + 1)
                .lean();
        }

        const { textFilter, regexFilter } = this.buildSearchFilter(trimmedSearch, conditions, searchField);

        // `$text` ne matche que des tokens entiers (avec stemming), pas de sous-chaîne.
        // On combine une requête `$text` (pertinence, portée élargie à identity.description)
        // et une requête `$regex` (préserve la recherche par préfixe/sous-chaîne, ex. "jea" → "Jean"),
        // exécutées en parallèle puis fusionnées par _id (un `$text` ne peut pas être imbriqué
        // dans le même `$or` qu'un autre opérateur au niveau racine).
        const sort = { created_at: -1 as const, _id: 1 as const };
        const [textResults, regexResults] = await Promise.all([
            textFilter
                ? CandidateModel.find(textFilter).collation(SEARCH_COLLATION).sort(sort).lean()
                : Promise.resolve([]),
            CandidateModel.find(regexFilter).collation(SEARCH_COLLATION).sort(sort).lean(),
        ]);

        const uniqueById = new Map<string, Candidate>();
        for (const candidate of [...textResults, ...regexResults]) {
            uniqueById.set(String(candidate._id), candidate);
        }
        return Array.from(uniqueById.values()).sort((a, b) => {
            const aTime = a.created_at ? new Date(a.created_at).getTime() : -Infinity;
            const bTime = b.created_at ? new Date(b.created_at).getTime() : -Infinity;
            if (aTime !== bTime) return bTime - aTime;
            return String(a._id).localeCompare(String(b._id));
        });
    }

    /** Compte les candidats correspondant à la recherche + filtres (même logique que findPage). */
    async countPage(search?: string, filters?: CandidateFilters, searchField?: CandidateSearchField): Promise<number> {
        const conditions = this.buildConditions(filters);
        const normalizedSearch = search ? normalizeSearchInput(search) : '';
        const trimmedSearch = normalizedSearch || undefined;

        if (!trimmedSearch) {
            const filter = conditions.length ? { $and: conditions } : {};
            return CandidateModel.countDocuments(filter);
        }

        const { textFilter, regexFilter } = this.buildSearchFilter(trimmedSearch, conditions, searchField);

        // Même combinaison `$text` ∪ `$regex` que findPage : on déduplique par _id (collation fr strength 1).
        const [textIds, regexIds] = await Promise.all([
            textFilter
                ? CandidateModel.distinct('_id', textFilter, { collation: SEARCH_COLLATION } as any)
                : Promise.resolve([]),
            CandidateModel.distinct('_id', regexFilter, { collation: SEARCH_COLLATION } as any),
        ]);
        return new Set([...textIds.map(String), ...regexIds.map(String)]).size;
    }

    async findById(id: string): Promise<Candidate | null> {
        return CandidateModel.findById(id).lean();
    }

    /** Documents candidats (uniquement le lien CV) pour les ids demandés. */
    async findCvLinksByIds(ids: string[]): Promise<Array<{ _id: string; cv_link?: string }>> {
        return CandidateModel.find({ _id: { $in: ids } })
            .select({ cv_link: 1, _id: 1 })
            .lean();
    }

    /** Documents candidats (uniquement le consentement) pour les ids demandés. */
    async findConsentmentsByIds(
        ids: string[],
    ): Promise<Array<{ _id: string; consentments?: Candidate['consentments'] }>> {
        return CandidateModel.find({ _id: { $in: ids } })
            .select({ consentments: 1, _id: 1 })
            .lean();
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
        // tp_type legacy encore présent sur d'anciens documents non nettoyés (cf.
        // scripts/cleanup_candidate_tp_type.py) : fallback vers [tp_type] tant que
        // tp_types est absent. Un candidat multi-TP compte dans chacun de ses buckets
        // (changement de cardinalité assumé par rapport à l'ancien group-by single-value).
        const withTpTypes = [
            {
                $addFields: {
                    _tp_types: {
                        $cond: [
                            { $gt: [{ $size: { $ifNull: ['$tp_types', []] } }, 0] },
                            '$tp_types',
                            { $cond: [{ $ifNull: ['$tp_type', false] }, ['$tp_type'], []] },
                        ],
                    },
                },
            },
            { $unwind: '$_tp_types' },
        ];
        const [result] = await CandidateModel.aggregate<RawStats>([
            ...match,
            {
                $facet: {
                    total: [{ $count: 'count' }],
                    byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
                    byTpType: [...withTpTypes, { $group: { _id: '$_tp_types', count: { $sum: 1 } } }],
                    byTrainingSite: [{ $group: { _id: '$training_site', count: { $sum: 1 } } }],
                    byTpAndStatus: [
                        ...withTpTypes,
                        { $group: { _id: { tpType: '$_tp_types', status: '$status' }, count: { $sum: 1 } } },
                    ],
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
            { returnDocument: 'after', runValidators: true, context: 'query' },
        ).lean();
    }

    async delete(id: string): Promise<boolean> {
        return (await CandidateModel.deleteOne({ _id: id })).deletedCount > 0;
    }
}

import { randomUUID } from 'crypto';
import { getModels } from '../../db/mongo/tenant';
import { searchNeedle } from './searchRegex';
import { Alternant, AlternantFiliz, AlternantArchiveReason } from '../../types/alternant.types';

export class AlternantRepository {
    /**
     * Par défaut seuls les actifs sont retournés (`archived_at: null`) pour que
     * le dashboard, les sessions et les recherches n'incluent pas les archivés.
     * `includeArchived = true` retourne actifs + archivés (onglet « Archivé »).
     */
    async findAll(search?: string, includeArchived = false): Promise<Alternant[]> {
        const clauses: Record<string, unknown>[] = [];
        if (search?.trim()) {
            const needle = searchNeedle(search);
            clauses.push({
                $or: [
                    { first_name: { $regex: needle, $options: 'i' } },
                    { last_name: { $regex: needle, $options: 'i' } },
                    { session: { $regex: needle, $options: 'i' } },
                    { 'company.name': { $regex: needle, $options: 'i' } },
                ],
            });
        }
        if (!includeArchived) clauses.push({ archived_at: null });
        const filter = clauses.length === 0 ? {} : clauses.length === 1 ? clauses[0] : { $and: clauses };
        return getModels().Alternant.find(filter).sort({ created_at: -1 }).lean();
    }

    async count(search?: string, includeArchived = false): Promise<number> {
        const clauses: Record<string, unknown>[] = [];
        if (search?.trim()) {
            const needle = searchNeedle(search);
            clauses.push({
                $or: [
                    { first_name: { $regex: needle, $options: 'i' } },
                    { last_name: { $regex: needle, $options: 'i' } },
                    { session: { $regex: needle, $options: 'i' } },
                    { 'company.name': { $regex: needle, $options: 'i' } },
                ],
            });
        }
        if (!includeArchived) clauses.push({ archived_at: null });
        const filter = clauses.length === 0 ? {} : clauses.length === 1 ? clauses[0] : { $and: clauses };
        return getModels().Alternant.countDocuments(filter);
    }

    async findById(id: string): Promise<Alternant | null> {
        return getModels().Alternant.findOne({ _id: id }).lean();
    }

    async findByIds(ids: string[]): Promise<Alternant[]> {
        if (ids.length === 0) return [];
        return getModels()
            .Alternant.find({ _id: { $in: ids } })
            .lean();
    }

    async findBySessionId(sessionId: string, includeArchived = false): Promise<Alternant[]> {
        const filter: Record<string, unknown> = { session_id: sessionId };
        if (!includeArchived) filter.archived_at = null;
        return getModels().Alternant.find(filter).sort({ last_name: 1, first_name: 1 }).lean();
    }

    /**
     * Membres d'une session : le rattachement local (`session_id`) prime, sinon on retombe sur la
     * classe Filiz d'origine (cas des alternants importés, dont `session_id` reste null).
     */
    async findBySessionOrFilizClassId(sessionId: string, includeArchived = false): Promise<Alternant[]> {
        const filter: Record<string, unknown> = {
            $or: [{ session_id: sessionId }, { session_id: null, 'filiz.class_id': sessionId }],
        };
        if (!includeArchived) filter.archived_at = null;
        return getModels().Alternant.find(filter).sort({ last_name: 1, first_name: 1 }).lean();
    }

    async findByFilizFolderId(folderId: string): Promise<Alternant | null> {
        return getModels().Alternant.findOne({ 'filiz.folder_id': folderId }).lean();
    }

    /** Alternant issu d'un candidat, pas encore rattaché à un folder Filiz. */
    async findUnlinkedByCandidateId(candidateId: string): Promise<Alternant | null> {
        return getModels()
            .Alternant.findOne({ candidate_id: candidateId, filiz: { $exists: false } })
            .lean();
    }

    async findByFilizClassId(classId: string, includeArchived = false): Promise<Alternant[]> {
        const filter: Record<string, unknown> = { 'filiz.class_id': classId };
        if (!includeArchived) filter.archived_at = null;
        return getModels().Alternant.find(filter).sort({ last_name: 1, first_name: 1 }).lean();
    }

    async findByFilizDegreeId(degreeId: string): Promise<Alternant[]> {
        return getModels().Alternant.find({ 'filiz.degree_id': degreeId }).sort({ last_name: 1, first_name: 1 }).lean();
    }

    /** Remplace le miroir Filiz sans toucher aux champs saisis par la péda. */
    async setFiliz(id: string, filiz: AlternantFiliz): Promise<Alternant | null> {
        return getModels()
            .Alternant.findOneAndUpdate(
                { _id: id },
                { $set: { filiz, updated_at: new Date() } },
                { returnDocument: 'after', runValidators: true, context: 'query' },
            )
            .lean();
    }

    /** Recherche par email (exact, insensible à la casse + espaces) pour la détection de doublons. */
    async findByEmail(email: string): Promise<Alternant | null> {
        const normalized = email.trim();
        if (!normalized) return null;
        const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return getModels()
            .Alternant.findOne({ email: { $regex: `^${escaped}$`, $options: 'i' } })
            .lean();
    }

    async create(data: Omit<Alternant, '_id' | 'created_at' | 'updated_at'>): Promise<Alternant> {
        const now = new Date();
        const doc = new (getModels().Alternant)({
            _id: randomUUID(),
            ...data,
            created_at: now,
            updated_at: now,
        });
        await doc.save();
        return doc.toObject() as Alternant;
    }

    async update(id: string, patch: Record<string, unknown>): Promise<Alternant | null> {
        const { _id, ...rest } = patch;
        return getModels()
            .Alternant.findOneAndUpdate(
                { _id: id },
                { $set: { ...rest, updated_at: new Date() } },
                { returnDocument: 'after', runValidators: true, context: 'query' },
            )
            .lean();
    }

    async setCompany(id: string, company: Alternant['company']): Promise<Alternant | null> {
        return getModels()
            .Alternant.findOneAndUpdate(
                { _id: id },
                { $set: { company, updated_at: new Date() } },
                { returnDocument: 'after', runValidators: true, context: 'query' },
            )
            .lean();
    }

    /** Archive (`date` non nulle) ou désarchive (`null`) un alternant. */
    async setArchived(
        id: string,
        date: Date | null,
        reason: AlternantArchiveReason | null = null,
    ): Promise<Alternant | null> {
        return getModels()
            .Alternant.findOneAndUpdate(
                { _id: id },
                {
                    $set: {
                        archived_at: date,
                        archive_reason: date ? (reason ?? 'rupture') : null,
                        updated_at: new Date(),
                    },
                },
                { returnDocument: 'after', runValidators: true, context: 'query' },
            )
            .lean();
    }

    async delete(id: string): Promise<boolean> {
        return (await getModels().Alternant.deleteOne({ _id: id })).deletedCount > 0;
    }
}

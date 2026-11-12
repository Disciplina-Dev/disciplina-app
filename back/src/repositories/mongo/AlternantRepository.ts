import { randomUUID } from 'crypto';
import { getModels } from '../../db/mongo/tenant';
import { searchNeedle } from './searchRegex';
import { Alternant, AlternantCompanyDefaillance } from '../../types/alternant.types';

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
    async setArchived(id: string, date: Date | null): Promise<Alternant | null> {
        return getModels()
            .Alternant.findOneAndUpdate(
                { _id: id },
                { $set: { archived_at: date, updated_at: new Date() } },
                { returnDocument: 'after', runValidators: true, context: 'query' },
            )
            .lean();
    }

    async delete(id: string): Promise<boolean> {
        return (await getModels().Alternant.deleteOne({ _id: id })).deletedCount > 0;
    }

    /** Déclare/résout une entreprise défaillante (remplacement en bloc, #961). */
    async setDefaillance(id: string, defaillance: AlternantCompanyDefaillance | null): Promise<Alternant | null> {
        return getModels()
            .Alternant.findOneAndUpdate(
                { _id: id },
                { $set: { defaillance, updated_at: new Date() } },
                { returnDocument: 'after', runValidators: true, context: 'query' },
            )
            .lean();
    }

    /** Marque le courrier d'alerte de la Responsable comme envoyé (dédup scheduler, #961). */
    async markDefaillanceAlertSent(id: string, at: Date): Promise<void> {
        await getModels().Alternant.updateOne({ _id: id }, { $set: { 'defaillance.alert_sent_at': at } });
    }

    /** Marque l'escalade Direction/Commercial comme envoyée (dédup scheduler, #961). */
    async markDefaillanceEscalated(id: string, at: Date): Promise<void> {
        await getModels().Alternant.updateOne({ _id: id }, { $set: { 'defaillance.escalated_at': at } });
    }

    /** Entreprises défaillantes non résolues, signalées depuis au moins `alertCutoff`, pas encore alertées. */
    async findDefaillanceAlertCandidates(alertCutoff: Date): Promise<Alternant[]> {
        return getModels()
            .Alternant.find({
                archived_at: null,
                'defaillance.reported_at': { $lte: alertCutoff },
                'defaillance.alert_sent_at': null,
                'defaillance.resolved_at': null,
            })
            .lean();
    }

    /** Entreprises défaillantes non résolues, signalées depuis au moins `escalationCutoff`, pas encore escaladées. */
    async findDefaillanceEscalationCandidates(escalationCutoff: Date): Promise<Alternant[]> {
        return getModels()
            .Alternant.find({
                archived_at: null,
                'defaillance.reported_at': { $lte: escalationCutoff },
                'defaillance.escalated_at': null,
                'defaillance.resolved_at': null,
            })
            .lean();
    }
}

import { getModels } from '../../db/mongo/tenant';
import {
    AttemptAnswer,
    AttemptStatus,
    Questionnaire,
    QuestionnaireAttempt,
    QuestionnaireStatus,
} from '../../types/questionnaire.types';

export interface AttemptFilters {
    questionnaireId?: string;
    candidateId?: string;
    status?: AttemptStatus;
    passed?: boolean;
    from?: Date;
    to?: Date;
    includeTestRuns?: boolean;
}

export class QuestionnaireRepository {
    // ── Questionnaires ──

    async list(): Promise<Questionnaire[]> {
        return getModels().Questionnaire.find().sort({ updated_at: -1 }).lean<Questionnaire[]>();
    }

    async findById(id: string): Promise<Questionnaire | null> {
        return getModels().Questionnaire.findById(id).lean<Questionnaire>();
    }

    async findByIds(ids: string[]): Promise<Questionnaire[]> {
        if (!ids.length) return [];
        return getModels()
            .Questionnaire.find({ _id: { $in: ids } })
            .select('title duration_minutes questions')
            .lean<Questionnaire[]>();
    }

    async listActive(): Promise<Questionnaire[]> {
        return getModels()
            .Questionnaire.find({ status: 'active' })
            .select('title description tp_types duration_minutes questions._id')
            .sort({ title: 1 })
            .lean<Questionnaire[]>();
    }

    async create(doc: Questionnaire): Promise<Questionnaire> {
        const created = await getModels().Questionnaire.create(doc);
        return created.toObject() as Questionnaire;
    }

    /** Mise à jour refusée (null) si le questionnaire a été verrouillé entre-temps. */
    async updateUnlocked(id: string, fields: Partial<Questionnaire>): Promise<Questionnaire | null> {
        return getModels()
            .Questionnaire.findOneAndUpdate({ _id: id, locked: false }, { $set: fields }, { returnDocument: 'after' })
            .lean<Questionnaire>();
    }

    async setStatus(id: string, status: QuestionnaireStatus): Promise<Questionnaire | null> {
        return getModels()
            .Questionnaire.findByIdAndUpdate(id, { $set: { status } }, { returnDocument: 'after' })
            .lean<Questionnaire>();
    }

    async lock(id: string): Promise<void> {
        await getModels().Questionnaire.updateOne({ _id: id, locked: false }, { $set: { locked: true } });
    }

    async deleteUnlocked(id: string): Promise<boolean> {
        return (await getModels().Questionnaire.deleteOne({ _id: id, locked: false })).deletedCount > 0;
    }

    // ── Tentatives ──

    async countAttemptsByQuestionnaire(): Promise<Map<string, number>> {
        const rows = await getModels().QuestionnaireAttempt.aggregate<{ _id: string; count: number }>([
            { $match: { is_test_run: false, status: { $in: ['in_progress', 'completed'] } } },
            { $group: { _id: '$questionnaire_id', count: { $sum: 1 } } },
        ]);
        return new Map(rows.map((r) => [r._id, r.count]));
    }

    async createAttempt(doc: QuestionnaireAttempt): Promise<QuestionnaireAttempt> {
        const created = await getModels().QuestionnaireAttempt.create(doc);
        return created.toObject() as QuestionnaireAttempt;
    }

    async findAttemptById(id: string): Promise<QuestionnaireAttempt | null> {
        return getModels().QuestionnaireAttempt.findById(id).lean<QuestionnaireAttempt>();
    }

    async findAttemptByTokenHash(tokenHash: string): Promise<QuestionnaireAttempt | null> {
        return getModels().QuestionnaireAttempt.findOne({ token_hash: tokenHash }).lean<QuestionnaireAttempt>();
    }

    async listAttempts(
        filters: AttemptFilters,
        limit: number,
        skip: number,
    ): Promise<{ items: QuestionnaireAttempt[]; total: number }> {
        const q: Record<string, unknown> = {};
        if (!filters.includeTestRuns) q.is_test_run = false;
        if (filters.questionnaireId) q.questionnaire_id = filters.questionnaireId;
        if (filters.candidateId) q.candidate_id = filters.candidateId;
        if (filters.status) q.status = filters.status;
        if (typeof filters.passed === 'boolean') q['score.passed'] = filters.passed;
        if (filters.from || filters.to) {
            q.created_at = {
                ...(filters.from ? { $gte: filters.from } : {}),
                ...(filters.to ? { $lte: filters.to } : {}),
            };
        }
        const model = getModels().QuestionnaireAttempt;
        const [items, total] = await Promise.all([
            // Liste : pas de réponses détaillées ni de secrets (token/device).
            model
                .find(q)
                .select('-answers -token_hash -device_hash -choice_order')
                .sort({ created_at: -1 })
                .skip(skip)
                .limit(limit)
                .lean<QuestionnaireAttempt[]>(),
            model.countDocuments(q),
        ]);
        return { items, total };
    }

    /** Transition atomique d'état : null si l'état courant ne correspond plus. */
    async transitionAttempt(
        id: string,
        fromStatuses: AttemptStatus[],
        set: Partial<QuestionnaireAttempt>,
        unset: string[] = [],
    ): Promise<QuestionnaireAttempt | null> {
        const update: Record<string, unknown> = { $set: set };
        if (unset.length) update.$unset = Object.fromEntries(unset.map((k) => [k, '']));
        return getModels()
            .QuestionnaireAttempt.findOneAndUpdate({ _id: id, status: { $in: fromStatuses } }, update, {
                returnDocument: 'after',
            })
            .lean<QuestionnaireAttempt>();
    }

    /**
     * Enregistre la réponse à la question `index` : n'aboutit que si la tentative est
     * toujours en cours ET sur cette question. Garantit l'absence de retour arrière et
     * de double réponse, même en cas de requêtes concurrentes.
     */
    async pushAnswer(id: string, index: number, answer: AttemptAnswer): Promise<QuestionnaireAttempt | null> {
        return getModels()
            .QuestionnaireAttempt.findOneAndUpdate(
                { _id: id, status: 'in_progress', current_index: index },
                { $push: { answers: answer }, $inc: { current_index: 1 } },
                { returnDocument: 'after' },
            )
            .lean<QuestionnaireAttempt>();
    }

    async incrementTabSwitch(id: string): Promise<void> {
        await getModels().QuestionnaireAttempt.updateOne(
            { _id: id, status: 'in_progress' },
            { $inc: { tab_switch_count: 1 } },
        );
    }

    async invalidateOpenInvitations(candidateId: string, questionnaireId: string): Promise<void> {
        await getModels().QuestionnaireAttempt.updateMany(
            { candidate_id: candidateId, questionnaire_id: questionnaireId, status: 'invited' },
            { $set: { status: 'cancelled' } },
        );
    }

    /** Droit à l'effacement : suppression en cascade avec le candidat. */
    async deleteAttemptsByCandidate(candidateId: string): Promise<number> {
        return (await getModels().QuestionnaireAttempt.deleteMany({ candidate_id: candidateId })).deletedCount;
    }

    // ── Candidats (lecture minimale : nom / email uniquement) ──

    async findCandidateIdentity(
        id: string,
    ): Promise<{ _id: string; full_name: string; email?: string; owner_id?: number } | null> {
        const doc = await getModels()
            .Candidate.findById(id)
            .select('identity.full_name identity.email owner.user_id')
            .lean<{ _id: string; identity?: { full_name?: string; email?: string }; owner?: { user_id?: number } }>();
        if (!doc) return null;
        return {
            _id: String(doc._id),
            full_name: doc.identity?.full_name ?? '',
            email: doc.identity?.email,
            owner_id: doc.owner?.user_id,
        };
    }

    async findCandidateNames(ids: string[]): Promise<Map<string, string>> {
        if (!ids.length) return new Map();
        const docs = await getModels()
            .Candidate.find({ _id: { $in: ids } })
            .select('identity.full_name')
            .lean<Array<{ _id: string; identity?: { full_name?: string } }>>();
        return new Map(docs.map((d) => [String(d._id), d.identity?.full_name ?? '']));
    }
}

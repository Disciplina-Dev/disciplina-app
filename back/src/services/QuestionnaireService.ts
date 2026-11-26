import { randomUUID } from 'node:crypto';
import { logger } from '../external/logger';
import { generateSignature, sha256Hex } from '../external/crypto';
import { appendRegion } from '../db/tenant';
import { env } from '../config/env';
import { CandidateRepository } from '../repositories/mongo/CandidateRepository';
import { AttemptFilters, QuestionnaireRepository } from '../repositories/mongo/QuestionnaireRepository';
import { QuestionnaireAttemptService } from './QuestionnaireAttemptService';
import { httpError } from './httpError';
import { TestResultService } from './TestResultService';
import { parseQuestionnaireInput } from './questionnaireValidation';
import { correctChoiceIds, toClassMarkerResult } from './questionnaireScoring';
import { PdfService } from './PdfService';
import { Candidate } from '../types/candidate.types';
import { AttemptStatus, Questionnaire, QuestionnaireAttempt, QuestionnaireStatus } from '../types/questionnaire.types';

export const DEFAULT_INVITE_MINUTES = 15;
const MAX_INVITE_MINUTES = 7 * 24 * 60;
const TEST_RUN_MINUTES = 60;
const STATUSES: QuestionnaireStatus[] = ['draft', 'active', 'archived'];
const ATTEMPT_STATUSES: AttemptStatus[] = ['invited', 'in_progress', 'completed', 'expired', 'cancelled'];

export interface Invitation {
    attempt_id: string;
    url: string;
    expires_at: Date;
}

export class QuestionnaireService {
    private repository = new QuestionnaireRepository();
    private attempts = new QuestionnaireAttemptService();

    // ── Questionnaires ──

    async list() {
        const [questionnaires, counts] = await Promise.all([
            this.repository.list(),
            this.repository.countAttemptsByQuestionnaire(),
        ]);
        return questionnaires.map(({ questions, ...q }) => ({
            ...q,
            question_count: questions.length,
            attempt_count: counts.get(q._id) ?? 0,
        }));
    }

    async get(id: string): Promise<Questionnaire> {
        const q = await this.repository.findById(id);
        if (!q) throw httpError(404, 'not_found', 'Questionnaire introuvable');
        return q;
    }

    /** Questionnaires proposés au RH depuis la fiche candidat (sans les questions). */
    async listActive() {
        const rows = await this.repository.listActive();
        return rows.map(({ questions, ...q }) => ({ ...q, question_count: questions.length }));
    }

    async create(body: unknown, userId: number | undefined): Promise<Questionnaire> {
        const input = parseQuestionnaireInput(body);
        const created = await this.repository.create({
            _id: randomUUID(),
            ...input,
            status: 'draft',
            version: 1,
            locked: false,
            created_by: userId,
        });
        logger.info({ questionnaireId: created._id, userId }, 'Questionnaire created');
        return created;
    }

    async update(id: string, body: unknown): Promise<Questionnaire> {
        const existing = await this.get(id);
        if (existing.locked) throw httpError(409, 'locked', 'Questionnaire déjà passé : dupliquez-le pour le modifier');
        const input = parseQuestionnaireInput(body);
        if (existing.status === 'active' && input.questions.length === 0) {
            throw httpError(400, 'empty', 'Un questionnaire actif doit contenir au moins une question');
        }
        const updated = await this.repository.updateUnlocked(id, input);
        if (!updated) throw httpError(409, 'locked', 'Questionnaire déjà passé : dupliquez-le pour le modifier');
        return updated;
    }

    async duplicate(id: string, userId: number | undefined): Promise<Questionnaire> {
        const source = await this.get(id);
        const { _id: _sourceId, created_at: _createdAt, updated_at: _updatedAt, ...rest } = source;
        const copy = await this.repository.create({
            ...rest,
            _id: randomUUID(),
            title: `${source.title} (v${source.version + 1})`.slice(0, 200),
            version: source.version + 1,
            status: 'draft',
            locked: false,
            created_by: userId,
        });
        logger.info({ questionnaireId: copy._id, sourceId: id, userId }, 'Questionnaire duplicated');
        return copy;
    }

    async setStatus(id: string, status: unknown): Promise<Questionnaire> {
        if (!STATUSES.includes(status as QuestionnaireStatus)) throw httpError(400, 'status', 'Statut invalide');
        const q = await this.get(id);
        if (status === 'active' && q.questions.length === 0) {
            throw httpError(400, 'empty', 'Ajoutez au moins une question avant d’activer');
        }
        return (await this.repository.setStatus(id, status as QuestionnaireStatus))!;
    }

    /** Suppression dure uniquement d'un questionnaire jamais passé ; sinon archiver. */
    async remove(id: string): Promise<void> {
        if (!(await this.repository.deleteUnlocked(id))) {
            throw httpError(409, 'locked', 'Questionnaire déjà passé : archivez-le plutôt');
        }
    }

    /** Export au format d'import (README §8bis) : sauvegarde ou copie vers l'autre région. */
    async exportJson(id: string) {
        const q = await this.get(id);
        return {
            title: q.title,
            description: q.description,
            tp_types: q.tp_types,
            duration_minutes: q.duration_minutes,
            pass_threshold: q.pass_threshold,
            immediate_feedback: q.immediate_feedback,
            allow_skip: q.allow_skip,
            shuffle_choices: q.shuffle_choices,
            questions: q.questions.map((qq) =>
                qq.type === 'text'
                    ? { type: qq.type, text: qq.text, points: qq.points, accepted_answers: qq.accepted_answers ?? [] }
                    : {
                          type: qq.type,
                          text: qq.text,
                          points: qq.points,
                          choices: qq.choices.map((c) => ({ text: c.text, correct: c.correct })),
                      },
            ),
        };
    }

    // ── Invitations ──

    private buildUrl(secret: string): string {
        return `${env.FRONTEND_BASE_URL.replace(/\/$/, '')}/test/${appendRegion(secret)}`;
    }

    /**
     * Lien unique par candidat : jeton aléatoire 256 bits, seul son haché est stocké.
     * Régénérer invalide les invitations encore ouvertes du même candidat/questionnaire.
     */
    async invite(
        questionnaireId: string,
        candidateId: unknown,
        validityMinutes: unknown,
        userId: number | undefined,
    ): Promise<Invitation> {
        if (typeof candidateId !== 'string' || !candidateId) throw httpError(400, 'candidate', 'Candidat requis');
        const minutes =
            validityMinutes === undefined || validityMinutes === null
                ? DEFAULT_INVITE_MINUTES
                : Number(validityMinutes);
        if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_INVITE_MINUTES) {
            throw httpError(400, 'validity', `Durée de validité entre 1 et ${MAX_INVITE_MINUTES} minutes`);
        }
        const q = await this.get(questionnaireId);
        if (q.status !== 'active') throw httpError(409, 'inactive', 'Questionnaire non actif');
        if (!(await this.repository.findCandidateIdentity(candidateId))) {
            throw httpError(404, 'candidate', 'Candidat introuvable');
        }

        await this.repository.invalidateOpenInvitations(candidateId, questionnaireId);
        const invitation = await this.createAttempt(q, minutes, { candidate_id: candidateId, invited_by: userId });
        logger.info(
            { attemptId: invitation.attempt_id, questionnaireId, candidateId, userId },
            'Questionnaire invitation created',
        );
        return invitation;
    }

    /** « Tester le questionnaire » : vrai passage, sans candidat ni écriture de résultat. */
    async testRun(questionnaireId: string, userId: number | undefined): Promise<Invitation> {
        const q = await this.get(questionnaireId);
        if (q.status === 'archived') throw httpError(409, 'archived', 'Questionnaire archivé');
        if (q.questions.length === 0) throw httpError(400, 'empty', 'Ajoutez au moins une question');
        return this.createAttempt(q, TEST_RUN_MINUTES, { invited_by: userId, is_test_run: true });
    }

    private async createAttempt(
        q: Questionnaire,
        minutes: number,
        extra: Partial<QuestionnaireAttempt>,
    ): Promise<Invitation> {
        const secret = generateSignature();
        const expiresAt = new Date(Date.now() + minutes * 60 * 1000);
        const attempt = await this.repository.createAttempt({
            _id: randomUUID(),
            questionnaire_id: q._id,
            questionnaire_version: q.version,
            token_hash: sha256Hex(secret),
            expires_at: expiresAt,
            purge_at: expiresAt,
            status: 'invited',
            current_index: 0,
            tab_switch_count: 0,
            is_test_run: false,
            identity_confirmed: false,
            answers: [],
            ...extra,
        });
        this.attempts.notifyProgress(attempt, q);
        return { attempt_id: attempt._id, url: this.buildUrl(secret), expires_at: expiresAt };
    }

    // ── Résultats ──

    parseFilters(query: Record<string, unknown>): AttemptFilters {
        const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
        const date = (v: unknown) => {
            const d = str(v) ? new Date(v as string) : undefined;
            return d && !Number.isNaN(d.getTime()) ? d : undefined;
        };
        const status = str(query.status) as AttemptStatus | undefined;
        return {
            questionnaireId: str(query.questionnaireId),
            candidateId: str(query.candidateId),
            status: status && ATTEMPT_STATUSES.includes(status) ? status : undefined,
            passed: query.passed === 'true' ? true : query.passed === 'false' ? false : undefined,
            from: date(query.from),
            to: date(query.to),
            includeTestRuns: query.includeTestRuns === 'true',
        };
    }

    async listAttempts(filters: AttemptFilters, page: number, pageSize: number) {
        const limit = Math.min(Math.max(pageSize, 1), 100);
        const skip = Math.max(page - 1, 0) * limit;
        const { items, total } = await this.repository.listAttempts(filters, limit, skip);
        // Lecture groupée (pas de N+1) des titres et noms.
        const [questionnaires, names] = await Promise.all([
            this.repository.findByIds([...new Set(items.map((a) => a.questionnaire_id))]),
            this.repository.findCandidateNames([
                ...new Set(items.map((a) => a.candidate_id).filter((id): id is string => !!id)),
            ]),
        ]);
        const qById = new Map(questionnaires.map((q) => [q._id, q]));
        // Expiration paresseuse vue côté liste (sans écriture) : statut affiché à jour.
        const now = Date.now();
        return {
            total,
            page: Math.max(page, 1),
            page_size: limit,
            items: items.map((a) => {
                const q = qById.get(a.questionnaire_id);
                let status = a.status;
                if (status === 'invited' && new Date(a.expires_at).getTime() < now) status = 'expired';
                return {
                    _id: a._id,
                    questionnaire_id: a.questionnaire_id,
                    questionnaire_title: q?.title ?? '—',
                    question_count: q?.questions.length ?? 0,
                    candidate_id: a.candidate_id ?? null,
                    candidate_name: a.candidate_id ? (names.get(a.candidate_id) ?? null) : null,
                    status,
                    is_test_run: a.is_test_run,
                    created_at: a.created_at,
                    expires_at: a.expires_at,
                    started_at: a.started_at ?? null,
                    deadline: a.deadline ?? null,
                    completed_at: a.completed_at ?? null,
                    current_index: a.current_index,
                    tab_switch_count: a.tab_switch_count,
                    score: a.score ?? null,
                };
            }),
        };
    }

    async getAttemptDetail(id: string) {
        let attempt = await this.repository.findAttemptById(id);
        if (!attempt) throw httpError(404, 'not_found', 'Passage introuvable');
        const q = await this.get(attempt.questionnaire_id);
        attempt = await this.attempts.applyExpiry(attempt, q);
        const name = attempt.candidate_id
            ? (await this.repository.findCandidateNames([attempt.candidate_id])).get(attempt.candidate_id)
            : null;
        const byQuestion = new Map(attempt.answers.map((a) => [a.question_id, a]));
        const { token_hash: _t, device_hash: _d, choice_order: _c, answers: _a, ...safe } = attempt;
        return {
            ...safe,
            candidate_name: name ?? null,
            questionnaire: { _id: q._id, title: q.title, pass_threshold: q.pass_threshold, version: q.version },
            questions: q.questions.map((qq, i) => {
                const answer = byQuestion.get(qq._id);
                const prev = i > 0 ? byQuestion.get(q.questions[i - 1]._id)?.answered_at : attempt!.started_at;
                return {
                    id: qq._id,
                    type: qq.type,
                    text: qq.text,
                    points_available: qq.points,
                    choices: qq.choices.map((c) => ({ id: c._id, text: c.text, correct: c.correct })),
                    correct_choice_ids: correctChoiceIds(qq),
                    accepted_answers: qq.accepted_answers ?? [],
                    answer: answer
                        ? {
                              choice_ids: answer.choice_ids,
                              text_answer: answer.text_answer ?? null,
                              skipped: answer.skipped,
                              correct: answer.correct,
                              points: answer.points,
                              answered_at: answer.answered_at,
                              time_spent_seconds: prev
                                  ? Math.max(
                                        0,
                                        Math.round(
                                            (new Date(answer.answered_at).getTime() - new Date(prev).getTime()) / 1000,
                                        ),
                                    )
                                  : null,
                          }
                        : null,
                };
            }),
        };
    }

    async candidateAttempts(candidateId: string) {
        return (await this.listAttempts({ candidateId }, 1, 20)).items;
    }

    /** Invalide un passage (problème technique) : le RH génère ensuite un nouveau lien. */
    async cancelAttempt(id: string): Promise<void> {
        const attempt = await this.repository.findAttemptById(id);
        if (!attempt) throw httpError(404, 'not_found', 'Passage introuvable');
        const cancelled = await this.repository.transitionAttempt(id, ['invited', 'in_progress'], {
            status: 'cancelled',
        });
        if (!cancelled) throw httpError(409, 'status', 'Seul un passage invité ou en cours peut être annulé');
        const q = await this.repository.findById(attempt.questionnaire_id);
        if (q) this.attempts.notifyProgress(cancelled, q);
        logger.info({ attemptId: id }, 'Questionnaire attempt cancelled');
    }

    /**
     * Bouton « Télécharger le PDF » : même rendu que le PDF déposé sur Drive, généré à la
     * volée depuis le passage (aucun compte Google requis). Couvre aussi les passages de test.
     */
    async downloadPdf(id: string): Promise<{ buffer: Buffer; fileName: string }> {
        const attempt = await this.repository.findAttemptById(id);
        if (!attempt) throw httpError(404, 'not_found', 'Passage introuvable');
        if (attempt.status !== 'completed') throw httpError(409, 'status', 'Seul un passage terminé a un PDF');
        const q = await this.get(attempt.questionnaire_id);
        const result = toClassMarkerResult(q, attempt);

        let identity: Partial<Candidate['identity']> & { full_name: string } = { full_name: 'Passage de test' };
        if (attempt.candidate_id) {
            const candidate = await new CandidateRepository().findById(attempt.candidate_id);
            if (!candidate) throw httpError(404, 'candidate', 'Candidat introuvable');
            identity = candidate.identity;
        }
        // Le rendu ne lit que identity + classmarker.
        const buffer = await PdfService.generateClassMarkerPdf({ identity, classmarker: result } as Candidate);
        return { buffer, fileName: TestResultService.resultPdfFileName(identity.full_name, result) };
    }

    /** Bouton « Envoyer / renvoyer le PDF sur Google Drive ». */
    async resendPdf(id: string): Promise<void> {
        const attempt = await this.repository.findAttemptById(id);
        if (!attempt) throw httpError(404, 'not_found', 'Passage introuvable');
        if (attempt.status !== 'completed' || attempt.is_test_run || !attempt.candidate_id) {
            throw httpError(409, 'status', 'Seul un passage candidat terminé a un PDF');
        }
        const candidate = await new CandidateRepository().findById(attempt.candidate_id);
        if (!candidate) throw httpError(404, 'candidate', 'Candidat introuvable');
        if (!candidate.classmarker_history?.some((h) => h.attempt_id === id)) {
            throw httpError(409, 'missing', 'Résultat absent de la fiche candidat');
        }
        const uploaded = await TestResultService.uploadResultPdf(candidate, id);
        if (!uploaded) throw httpError(503, 'google', 'Aucun compte Google connecté pour déposer le PDF');
    }
}

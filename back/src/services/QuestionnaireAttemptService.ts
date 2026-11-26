import { logger } from '../external/logger';
import { httpError } from './httpError';
import { generateSignature, sha256Hex, timingSafeEqualString } from '../external/crypto';
import { QuestionnaireRepository } from '../repositories/mongo/QuestionnaireRepository';
import { notifyCandidate } from '../rest/classmarker/sse';
import { TestResultService } from './TestResultService';
import { computeScore, correctChoiceIds, gradeAnswer, toClassMarkerResult } from './questionnaireScoring';
import { QUESTIONNAIRE_LIMITS } from './questionnaireValidation';
import { Questionnaire, QuestionnaireAttempt, QuestionnaireQuestion } from '../types/questionnaire.types';

// Marge réseau acceptée après la fin du chrono serveur.
export const DEADLINE_GRACE_MS = 10 * 1000;

/** Le jeton d'URL est `<secret>:<region>` : seul le secret est haché en base. */
export function tokenSecret(token: string): string {
    const idx = token.lastIndexOf(':');
    return idx === -1 ? token : token.slice(0, idx);
}

function maskEmail(email: string | undefined): string | null {
    if (!email || !email.includes('@')) return null;
    const [local, domain] = email.split('@');
    return `${local.slice(0, 1)}${'•'.repeat(Math.max(1, Math.min(local.length - 1, 6)))}@${domain}`;
}

function shuffle<T>(items: T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

export interface AnswerFeedback {
    correct: boolean;
    correct_choice_ids: string[];
    // Question `text` : réponses acceptées, montrées après validation.
    accepted_answers?: string[];
}

export interface OpenedAttempt {
    attempt: QuestionnaireAttempt;
    questionnaire: Questionnaire;
    // Cookie d'appareil reçu (réutilisé au démarrage s'il est bien formé).
    deviceCookie?: string;
}

export class QuestionnaireAttemptService {
    private repository = new QuestionnaireRepository();

    /**
     * Résout le lien, applique l'expiration paresseuse puis le verrouillage appareil :
     * le premier appareil qui ouvre le lien le garde, tout autre est refusé.
     */
    async open(token: string, deviceCookie: string | undefined): Promise<OpenedAttempt> {
        const secret = tokenSecret(token);
        if (!/^[a-f0-9]{64}$/.test(secret)) throw httpError(404, 'not_found', 'Lien invalide');
        let attempt = await this.repository.findAttemptByTokenHash(sha256Hex(secret));
        if (!attempt) throw httpError(404, 'not_found', 'Lien invalide');
        const questionnaire = await this.repository.findById(attempt.questionnaire_id);
        if (!questionnaire) throw httpError(404, 'not_found', 'Lien invalide');

        attempt = await this.applyExpiry(attempt, questionnaire);

        // Lien expiré / annulé : rien à protéger, on affiche juste l'état.
        if (attempt.status === 'expired' || attempt.status === 'cancelled') return { attempt, questionnaire };

        // Pas encore commencé : aucun appareil lié. La liaison se fait au clic « Commencer »
        // (start), dans la même écriture atomique que le démarrage : deux chargements
        // simultanés de la page (onglets, StrictMode) ne peuvent pas se voler le lien.
        if (!attempt.device_hash) {
            if (attempt.status !== 'invited') throw httpError(403, 'device', 'Lien ouvert sur un autre appareil');
            return { attempt, questionnaire, deviceCookie };
        }
        if (!deviceCookie || !timingSafeEqualString(attempt.device_hash, sha256Hex(deviceCookie))) {
            throw httpError(403, 'device', 'Lien ouvert sur un autre appareil');
        }
        return { attempt, questionnaire, deviceCookie };
    }

    /** Vue publique : jamais de bonne réponse, jamais d'identifiant candidat. */
    async publicView(attempt: QuestionnaireAttempt, questionnaire: Questionnaire) {
        const identity =
            attempt.candidate_id && attempt.status === 'invited'
                ? await this.repository.findCandidateIdentity(attempt.candidate_id)
                : null;
        const base = {
            status: attempt.status,
            title: questionnaire.title,
            description: questionnaire.description ?? null,
            duration_minutes: questionnaire.duration_minutes,
            question_count: questionnaire.questions.length,
            allow_skip: questionnaire.allow_skip,
            immediate_feedback: questionnaire.immediate_feedback,
            is_test_run: attempt.is_test_run,
            server_now: new Date().toISOString(),
            expires_at: attempt.expires_at,
        };
        if (attempt.status === 'invited') {
            return {
                ...base,
                candidate: identity ? { full_name: identity.full_name, email_masked: maskEmail(identity.email) } : null,
            };
        }
        if (attempt.status === 'in_progress') {
            return {
                ...base,
                deadline: attempt.deadline,
                current_index: attempt.current_index,
                question: this.questionView(attempt, questionnaire.questions[attempt.current_index]),
            };
        }
        if (attempt.status === 'completed') {
            return { ...base, percentage: attempt.score?.percentage ?? 0 };
        }
        return base;
    }

    private questionView(attempt: QuestionnaireAttempt, question: QuestionnaireQuestion | undefined) {
        if (!question) return null;
        const order = attempt.choice_order?.[question._id];
        const byId = new Map(question.choices.map((c) => [c._id, c]));
        const choices = order ? order.map((id) => byId.get(id)).filter((c) => c !== undefined) : question.choices;
        return {
            id: question._id,
            type: question.type,
            text: question.text,
            points: question.points,
            choices: choices.map((c) => ({ id: c._id, text: c.text })),
        };
    }

    /** Démarre le chrono et lie la tentative à l'appareil ; renvoie le jeton d'appareil à poser en cookie. */
    async start(
        opened: OpenedAttempt,
        confirmIdentity: boolean,
    ): Promise<{ attempt: QuestionnaireAttempt; deviceToken: string }> {
        const { attempt, questionnaire } = opened;
        if (attempt.status !== 'invited') throw httpError(409, 'not_invited', 'Ce test a déjà été commencé');
        if (!confirmIdentity) throw httpError(400, 'identity', 'Merci de confirmer votre identité');
        if (questionnaire.questions.length === 0) throw httpError(409, 'empty', 'Ce questionnaire est vide');

        const deviceToken =
            opened.deviceCookie && /^[a-f0-9]{64}$/.test(opened.deviceCookie)
                ? opened.deviceCookie
                : generateSignature();
        const now = new Date();
        const choiceOrder = questionnaire.shuffle_choices
            ? Object.fromEntries(questionnaire.questions.map((q) => [q._id, shuffle(q.choices.map((c) => c._id))]))
            : undefined;
        const started = await this.repository.transitionAttempt(
            attempt._id,
            ['invited'],
            {
                status: 'in_progress',
                started_at: now,
                deadline: new Date(now.getTime() + questionnaire.duration_minutes * 60 * 1000),
                current_index: 0,
                identity_confirmed: true,
                device_hash: sha256Hex(deviceToken),
                questionnaire_version: questionnaire.version,
                ...(choiceOrder ? { choice_order: choiceOrder } : {}),
            },
            // Commencée : n'est plus une invitation purgeable.
            ['purge_at'],
        );
        if (!started) throw httpError(409, 'not_invited', 'Ce test a déjà été commencé');
        // 1er passage réel : le questionnaire n'est plus modifiable (anciens scores jamais faussés).
        if (!started.is_test_run) await this.repository.lock(questionnaire._id);
        logger.info({ attemptId: started._id, questionnaireId: questionnaire._id }, 'Questionnaire attempt started');
        this.notifyProgress(started, questionnaire);
        return { attempt: started, deviceToken };
    }

    async answer(
        opened: OpenedAttempt,
        body: { question_id?: unknown; choice_ids?: unknown; text?: unknown; skip?: unknown },
    ): Promise<{ attempt: QuestionnaireAttempt; feedback: AnswerFeedback | null }> {
        const { attempt, questionnaire } = opened;
        if (attempt.status !== 'in_progress') throw httpError(409, 'not_in_progress', "Ce test n'est plus en cours");

        const index = attempt.current_index;
        const question = questionnaire.questions[index];
        if (!question || body.question_id !== question._id) {
            // Pas de retour arrière ni de saut : seule la question courante est acceptée.
            throw httpError(409, 'wrong_question', 'Cette question a déjà reçu une réponse');
        }

        const skip = body.skip === true;
        if (skip && !questionnaire.allow_skip) throw httpError(400, 'skip_forbidden', 'Une réponse est attendue');
        const rawIds = Array.isArray(body.choice_ids) ? body.choice_ids : [];
        const validIds = new Set(question.choices.map((c) => c._id));
        const choiceIds = [...new Set(rawIds.filter((id): id is string => typeof id === 'string'))];
        const textAnswer = typeof body.text === 'string' ? body.text.trim() : '';
        if (!skip && question.type === 'text') {
            if (!textAnswer) throw httpError(400, 'invalid_text', 'Une réponse est attendue');
            if (textAnswer.length > QUESTIONNAIRE_LIMITS.ACCEPTED_ANSWER) {
                throw httpError(400, 'invalid_text', `${QUESTIONNAIRE_LIMITS.ACCEPTED_ANSWER} caractères maximum`);
            }
        } else if (!skip) {
            if (choiceIds.length === 0 || choiceIds.some((id) => !validIds.has(id))) {
                throw httpError(400, 'invalid_choice', 'Réponse invalide');
            }
            if (question.type !== 'multiple' && choiceIds.length !== 1) {
                throw httpError(400, 'invalid_choice', 'Une seule réponse est attendue');
            }
        }

        const graded = gradeAnswer(question, choiceIds, skip, textAnswer);
        const updated = await this.repository.pushAnswer(attempt._id, index, graded);
        if (!updated) throw httpError(409, 'wrong_question', 'Cette question a déjà reçu une réponse');

        const feedback =
            questionnaire.immediate_feedback && !skip
                ? {
                      correct: graded.correct,
                      correct_choice_ids: correctChoiceIds(question),
                      ...(question.type === 'text' ? { accepted_answers: question.accepted_answers ?? [] } : {}),
                  }
                : null;

        if (updated.current_index >= questionnaire.questions.length) {
            return { attempt: await this.finalize(updated, questionnaire), feedback };
        }
        this.notifyProgress(updated, questionnaire);
        return { attempt: updated, feedback };
    }

    async reportTabSwitch(opened: OpenedAttempt): Promise<void> {
        if (opened.attempt.status !== 'in_progress') return;
        await this.repository.incrementTabSwitch(opened.attempt._id);
    }

    /**
     * Expiration paresseuse : invitation non commencée au-delà de sa validité → expirée ;
     * tentative commencée au-delà du chrono (+ marge) → clôturée, questions restantes = 0.
     */
    async applyExpiry(attempt: QuestionnaireAttempt, questionnaire: Questionnaire): Promise<QuestionnaireAttempt> {
        const now = Date.now();
        if (attempt.status === 'invited' && new Date(attempt.expires_at).getTime() < now) {
            const expired = await this.repository.transitionAttempt(attempt._id, ['invited'], { status: 'expired' });
            if (expired) this.notifyProgress(expired, questionnaire);
            return expired ?? (await this.repository.findAttemptById(attempt._id)) ?? attempt;
        }
        if (
            attempt.status === 'in_progress' &&
            attempt.deadline &&
            new Date(attempt.deadline).getTime() + DEADLINE_GRACE_MS < now
        ) {
            return this.finalize(attempt, questionnaire);
        }
        return attempt;
    }

    /** Clôture idempotente : score serveur, puis recopie au format ClassMarker sur la fiche. */
    async finalize(attempt: QuestionnaireAttempt, questionnaire: Questionnaire): Promise<QuestionnaireAttempt> {
        const fresh = (await this.repository.findAttemptById(attempt._id)) ?? attempt;
        const score = computeScore(questionnaire, fresh.answers);
        const completed = await this.repository.transitionAttempt(fresh._id, ['in_progress'], {
            status: 'completed',
            completed_at: new Date(),
            score,
        });
        if (!completed) return (await this.repository.findAttemptById(fresh._id)) ?? fresh;

        logger.info(
            { attemptId: completed._id, questionnaireId: questionnaire._id, percentage: score.percentage },
            'Questionnaire attempt completed',
        );
        this.notifyProgress(completed, questionnaire);
        if (!completed.is_test_run && completed.candidate_id) {
            const saved = await TestResultService.saveTestResult(
                completed.candidate_id,
                toClassMarkerResult(questionnaire, completed),
                { backgroundPdf: true },
            );
            if (!saved) logger.warn({ attemptId: completed._id }, 'Questionnaire result: candidate not found');
        }
        return completed;
    }

    /** Suivi en direct sur la fiche candidat (même canal SSE que les résultats). */
    notifyProgress(attempt: QuestionnaireAttempt, questionnaire: Questionnaire): void {
        if (!attempt.candidate_id || attempt.is_test_run) return;
        notifyCandidate(attempt.candidate_id, {
            questionnaire_progress: {
                attempt_id: attempt._id,
                questionnaire_id: questionnaire._id,
                title: questionnaire.title,
                status: attempt.status,
                current_index: attempt.current_index,
                total: questionnaire.questions.length,
                deadline: attempt.deadline ?? null,
                expires_at: attempt.expires_at,
            },
        });
    }
}

import { ClassMarkerQuestion, ClassMarkerResult } from '../types/candidate.types';
import {
    AttemptAnswer,
    AttemptScore,
    Questionnaire,
    QuestionnaireAttempt,
    QuestionnaireQuestion,
} from '../types/questionnaire.types';

// Correction côté serveur uniquement. Une question est juste si l'ensemble des choix
// cochés est exactement l'ensemble des bonnes réponses (tout ou rien, pas de points partiels).
// Réponse libre : juste si elle correspond à l'une des réponses acceptées une fois normalisée.

export function correctChoiceIds(question: QuestionnaireQuestion): string[] {
    return question.choices.filter((c) => c.correct).map((c) => c._id);
}

/**
 * Comparaison tolérante d'une réponse libre : casse, espaces multiples, apostrophe typographique,
 * guillemets et ponctuation finale ignorés. Les accents comptent (« envoye » ≠ « envoyé »).
 */
export function normalizeTextAnswer(value: string): string {
    return value
        .normalize('NFC')
        .toLocaleLowerCase('fr')
        .replace(/[’‘`]/g, "'")
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^["«»“”\s]+|["«»“”\s.!?;:,]+$/g, '');
}

export function gradeAnswer(
    question: QuestionnaireQuestion,
    choiceIds: string[],
    skipped: boolean,
    textAnswer = '',
): AttemptAnswer {
    let correct: boolean;
    if (question.type === 'text') {
        const given = normalizeTextAnswer(textAnswer);
        correct =
            !skipped && given !== '' && (question.accepted_answers ?? []).some((a) => normalizeTextAnswer(a) === given);
    } else {
        const expected = new Set(correctChoiceIds(question));
        const given = new Set(choiceIds);
        correct = !skipped && given.size === expected.size && [...given].every((id) => expected.has(id));
    }
    return {
        question_id: question._id,
        choice_ids: skipped || question.type === 'text' ? [] : [...new Set(choiceIds)],
        ...(question.type === 'text' && !skipped ? { text_answer: textAnswer.trim() } : {}),
        skipped,
        correct,
        points: correct ? question.points : 0,
        answered_at: new Date(),
    };
}

export function computeScore(questionnaire: Questionnaire, answers: AttemptAnswer[]): AttemptScore {
    const available = questionnaire.questions.reduce((sum, q) => sum + q.points, 0);
    const scored = answers.reduce((sum, a) => sum + a.points, 0);
    const percentage = available > 0 ? Math.round((scored / available) * 1000) / 10 : 0;
    return {
        percentage,
        points_scored: scored,
        points_available: available,
        passed: percentage >= questionnaire.pass_threshold,
    };
}

function formatDuration(ms: number): string {
    const total = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

const LETTERS = 'ABCDEFGHIJ';

/**
 * Convertit une tentative terminée au format `ClassMarkerResult` existant : la fiche,
 * le gate, le PDF et le MCP lisent ce format sans modification. Les questions sont
 * numérotées 1..N et les choix lettrés A..J (dans l'ordre défini par le correcteur).
 */
export function toClassMarkerResult(questionnaire: Questionnaire, attempt: QuestionnaireAttempt): ClassMarkerResult {
    const score = attempt.score ?? computeScore(questionnaire, attempt.answers);
    const byQuestion = new Map(attempt.answers.map((a) => [a.question_id, a]));
    const questions: ClassMarkerQuestion[] = questionnaire.questions.map((q, i) => {
        const letterOf = new Map(q.choices.map((c, ci) => [c._id, LETTERS[ci]]));
        const answer = byQuestion.get(q._id);
        const answered = answer && !answer.skipped;
        if (q.type === 'text') {
            // Même forme que les réponses libres ClassMarker : le PDF et la fiche savent l'afficher.
            return {
                question_id: i + 1,
                question_type: 'freetext',
                question: q.text,
                options: { exact_match: (q.accepted_answers ?? []).map((content) => ({ content })) },
                correct_option: (q.accepted_answers ?? []).join(' / '),
                user_response: answered ? (answer.text_answer ?? '') : '',
                points_scored: answer?.points ?? 0,
                points_available: q.points,
                result: !answered ? 'unanswered' : answer.correct ? 'correct' : 'incorrect',
            };
        }
        return {
            question_id: i + 1,
            question_type: 'multiplechoice',
            question: q.text,
            options: Object.fromEntries(q.choices.map((c, ci) => [LETTERS[ci], c.text])),
            correct_option: correctChoiceIds(q)
                .map((id) => letterOf.get(id))
                .join(','),
            user_response: answered ? answer.choice_ids.map((id) => letterOf.get(id) ?? '').join(',') : '',
            points_scored: answer?.points ?? 0,
            points_available: q.points,
            result: !answered ? 'unanswered' : answer.correct ? 'correct' : 'incorrect',
        };
    });
    const completedAt = attempt.completed_at ?? new Date();
    return {
        percentage: score.percentage,
        points_scored: score.points_scored,
        points_available: score.points_available,
        passed: score.passed,
        test_name: questionnaire.title,
        completed_at: completedAt,
        duration: attempt.started_at
            ? formatDuration(completedAt.getTime() - new Date(attempt.started_at).getTime())
            : undefined,
        questions,
        source: 'internal',
        questionnaire_id: questionnaire._id,
        attempt_id: attempt._id,
        tab_switch_count: attempt.tab_switch_count,
    };
}

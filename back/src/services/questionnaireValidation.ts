import { randomUUID } from 'node:crypto';
import { httpError } from './httpError';
import { Questionnaire, QuestionnaireQuestion, QuestionType } from '../types/questionnaire.types';

// Validation manuelle (zod banni hors src/mcp). Sert à la fois à l'éditeur par blocs
// et à l'import JSON (format audit/README.md §8bis) : texte brut uniquement.

export const QUESTIONNAIRE_LIMITS = {
    TITLE: 200,
    DESCRIPTION: 2000,
    QUESTION_TEXT: 2000,
    CHOICE_TEXT: 500,
    MAX_QUESTIONS: 200,
    MAX_CHOICES: 10,
    MAX_DURATION: 240,
    MAX_POINTS: 100,
    ACCEPTED_ANSWER: 200,
    MAX_ACCEPTED_ANSWERS: 10,
} as const;

export type QuestionnaireInput = Pick<
    Questionnaire,
    | 'title'
    | 'description'
    | 'tp_types'
    | 'duration_minutes'
    | 'pass_threshold'
    | 'immediate_feedback'
    | 'allow_skip'
    | 'shuffle_choices'
    | 'questions'
>;

const QUESTION_TYPES: QuestionType[] = ['single', 'multiple', 'true_false', 'text'];
const HTML_TAG = /<\/?[a-z][^>]*>/i;

function cleanText(value: unknown, field: string, max: number, errors: string[], required = true): string {
    if (value === undefined || value === null || value === '') {
        if (required) errors.push(`${field} : obligatoire`);
        return '';
    }
    if (typeof value !== 'string') {
        errors.push(`${field} : texte attendu`);
        return '';
    }
    const text = value.trim();
    if (required && !text) errors.push(`${field} : obligatoire`);
    if (text.length > max) errors.push(`${field} : ${max} caractères maximum`);
    if (HTML_TAG.test(text)) errors.push(`${field} : le HTML n'est pas autorisé (texte brut uniquement)`);
    return text;
}

function cleanNumber(
    value: unknown,
    field: string,
    min: number,
    max: number,
    fallback: number,
    errors: string[],
): number {
    if (value === undefined || value === null || value === '') return fallback;
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n) || n < min || n > max) {
        errors.push(`${field} : nombre entre ${min} et ${max} attendu`);
        return fallback;
    }
    return n;
}

function cleanBool(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
}

function parseQuestion(raw: unknown, index: number, errors: string[]): QuestionnaireQuestion | null {
    const label = `Question ${index + 1}`;
    if (!raw || typeof raw !== 'object') {
        errors.push(`${label} : objet attendu`);
        return null;
    }
    const q = raw as Record<string, unknown>;
    const type = q.type as QuestionType;
    if (!QUESTION_TYPES.includes(type)) {
        errors.push(`${label} : type invalide (single, multiple, true_false ou text)`);
        return null;
    }
    const text = cleanText(q.text, `${label} — énoncé`, QUESTIONNAIRE_LIMITS.QUESTION_TEXT, errors);
    const points = cleanNumber(q.points, `${label} — points`, 0.5, QUESTIONNAIRE_LIMITS.MAX_POINTS, 1, errors);
    const id = typeof q._id === 'string' && q._id.length <= 64 ? q._id : randomUUID();

    if (type === 'text') {
        // Réponse libre : { "type": "text", "accepted_answers": ["envoyé"] }
        if (!Array.isArray(q.accepted_answers)) {
            errors.push(`${label} : liste "accepted_answers" attendue`);
            return null;
        }
        const max = QUESTIONNAIRE_LIMITS.MAX_ACCEPTED_ANSWERS;
        if (q.accepted_answers.length < 1 || q.accepted_answers.length > max) {
            errors.push(`${label} : entre 1 et ${max} réponses acceptées attendues`);
        }
        const accepted = q.accepted_answers
            .slice(0, max)
            .map((a, ai) =>
                cleanText(a, `${label} — réponse acceptée ${ai + 1}`, QUESTIONNAIRE_LIMITS.ACCEPTED_ANSWER, errors),
            );
        return { _id: id, type, text, points, choices: [], accepted_answers: accepted };
    }

    if (type === 'true_false' && !Array.isArray(q.choices)) {
        // Forme courte de l'import : { "type": "true_false", "answer": false }
        if (typeof q.answer !== 'boolean') {
            errors.push(`${label} : "answer" (true/false) attendu`);
            return null;
        }
        return {
            _id: id,
            type,
            text,
            points,
            choices: [
                { _id: randomUUID(), text: 'Vrai', correct: q.answer === true },
                { _id: randomUUID(), text: 'Faux', correct: q.answer === false },
            ],
        };
    }

    if (!Array.isArray(q.choices)) {
        errors.push(`${label} : liste "choices" attendue`);
        return null;
    }
    if (q.choices.length < 2 || q.choices.length > QUESTIONNAIRE_LIMITS.MAX_CHOICES) {
        errors.push(`${label} : entre 2 et ${QUESTIONNAIRE_LIMITS.MAX_CHOICES} choix attendus`);
    }
    const choices = q.choices.slice(0, QUESTIONNAIRE_LIMITS.MAX_CHOICES).map((c, ci) => {
        const choice = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
        return {
            _id: typeof choice._id === 'string' && choice._id.length <= 64 ? choice._id : randomUUID(),
            text: cleanText(choice.text, `${label} — choix ${ci + 1}`, QUESTIONNAIRE_LIMITS.CHOICE_TEXT, errors),
            correct: choice.correct === true,
        };
    });
    const correctCount = choices.filter((c) => c.correct).length;
    if (correctCount === 0) errors.push(`${label} : au moins une bonne réponse attendue`);
    if ((type === 'single' || type === 'true_false') && correctCount > 1) {
        errors.push(`${label} : une seule bonne réponse pour ce type`);
    }
    if (type === 'true_false' && choices.length !== 2) errors.push(`${label} : vrai/faux = exactement 2 choix`);
    if (new Set(choices.map((c) => c._id)).size !== choices.length)
        errors.push(`${label} : identifiants de choix en double`);
    return { _id: id, type, text, points, choices };
}

/** Valide et normalise un questionnaire ; lève une Error listant toutes les erreurs. */
export function parseQuestionnaireInput(body: unknown): QuestionnaireInput {
    const errors: string[] = [];
    if (!body || typeof body !== 'object' || Array.isArray(body))
        throw httpError(400, 'validation', 'Questionnaire : objet JSON attendu');
    const b = body as Record<string, unknown>;

    const title = cleanText(b.title, 'Titre', QUESTIONNAIRE_LIMITS.TITLE, errors);
    const description = cleanText(b.description, 'Consigne', QUESTIONNAIRE_LIMITS.DESCRIPTION, errors, false);
    const duration = cleanNumber(
        b.duration_minutes,
        'Durée (minutes)',
        1,
        QUESTIONNAIRE_LIMITS.MAX_DURATION,
        20,
        errors,
    );
    const threshold = cleanNumber(b.pass_threshold, 'Seuil de réussite (%)', 0, 100, 50, errors);
    const tpTypes = Array.isArray(b.tp_types)
        ? b.tp_types.filter((t): t is string => typeof t === 'string' && t.length <= 20).slice(0, 10)
        : [];

    const rawQuestions = Array.isArray(b.questions) ? b.questions : null;
    if (!rawQuestions) errors.push('Questions : liste attendue');
    else if (rawQuestions.length > QUESTIONNAIRE_LIMITS.MAX_QUESTIONS) {
        errors.push(`Questions : ${QUESTIONNAIRE_LIMITS.MAX_QUESTIONS} maximum`);
    }
    const questions = (rawQuestions ?? [])
        .slice(0, QUESTIONNAIRE_LIMITS.MAX_QUESTIONS)
        .map((q, i) => parseQuestion(q, i, errors))
        .filter((q): q is QuestionnaireQuestion => q !== null);
    if (new Set(questions.map((q) => q._id)).size !== questions.length)
        errors.push('Questions : identifiants en double');

    if (errors.length) throw httpError(400, 'validation', errors.join('\n'));
    return {
        title,
        description: description || undefined,
        tp_types: tpTypes,
        duration_minutes: Math.round(duration),
        pass_threshold: threshold,
        immediate_feedback: cleanBool(b.immediate_feedback, false),
        allow_skip: cleanBool(b.allow_skip, false),
        shuffle_choices: cleanBool(b.shuffle_choices, false),
        questions,
    };
}

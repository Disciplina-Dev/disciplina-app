import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { truncateMysql } from '../../../../test/helpers/db';
import { env } from '../../../config/env';
import { getModels } from '../../../db/mongo/tenant';
import { CandidateRepository } from '../../../repositories/mongo/CandidateRepository';
import { CandidateStatus } from '../../../types/candidate.types';

// Les 5 tests repris de ClassMarker (Classmarker/questions/jsons), passés de bout en bout
// tels qu'un recruteur les importe : import → activation → invitation → passage → résultat
// sur la fiche → PDF. Le dossier vit à la racine du dépôt ; en CI il est monté en lecture
// seule au même chemin relatif (cf. docker-compose.test.yml).
const QUIZ_DIR = path.resolve(__dirname, '../../../../../Classmarker/questions/jsons');

// Attendus = tableau de Classmarker/questions/README.md (source de vérité côté métier).
const QUIZZES = [
    { file: 'assistante-direction.json', questions: 20, points: 10, tp: ['AD'], freeText: 1 },
    { file: 'negociateur-technico-commercial.json', questions: 20, points: 10, tp: ['NTC'], freeText: 1 },
    { file: 'conseiller-commercial.json', questions: 20, points: 10, tp: ['CC'], freeText: 1 },
    { file: 'charge-accueil-gestion-administrative.json', questions: 20, points: 10, tp: [], freeText: 0 },
    { file: 'responsable-etablissement-marchand.json', questions: 19, points: 30, tp: ['REM'], freeText: 0 },
] as const;

type QuizJson = {
    title: string;
    tp_types: string[];
    duration_minutes: number;
    pass_threshold: number;
    immediate_feedback: boolean;
    allow_skip: boolean;
    questions: Array<{
        type: string;
        text: string;
        points: number;
        choices?: Array<{ text: string; correct: boolean }>;
        accepted_answers?: string[];
    }>;
};

const loadQuiz = (file: string): QuizJson => JSON.parse(readFileSync(path.join(QUIZ_DIR, file), 'utf8'));

const API = `http://localhost:${env.API_PORT}/api`;
const suffix = Date.now();
const candidateId = `cm-quiz-${suffix}`;
const rh = mintAuthCookies({ id: 7, email: `rh-quiz-${suffix}@test.local`, role: 'RH' });

function staff(method = 'GET', body?: unknown): RequestInit {
    return {
        method,
        headers: { Cookie: rh.cookieHeader, 'x-csrf-token': rh.csrfHeader, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
    };
}

/** Client « candidat » : garde le cookie d'appareil entre les appels, comme un navigateur. */
function candidateClient(token: string) {
    let cookie = '';
    return async (suffixPath: string, method = 'GET', body?: unknown) => {
        const res = await fetch(`${API}/q/${token}${suffixPath}`, {
            method,
            headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        const set = res.headers.get('set-cookie');
        if (set) cookie = set.split(';')[0];
        const text = await res.text();
        return { status: res.status, body: text ? JSON.parse(text) : null };
    };
}

async function importAndActivate(quiz: QuizJson): Promise<any> {
    const created = await fetch(`${API}/questionnaires`, staff('POST', quiz));
    expect(created.status, await created.clone().text()).toBe(201);
    const { questionnaire } = await created.json();
    const activated = await fetch(
        `${API}/questionnaires/${questionnaire._id}/status`,
        staff('POST', { status: 'active' }),
    );
    expect(activated.status).toBe(200);
    return getModels().Questionnaire.findById(questionnaire._id).lean<any>();
}

/**
 * Fait passer le questionnaire au candidat. `answerRight(i)` décide si la question i reçoit
 * la bonne réponse ; une réponse libre juste est tapée « comme un candidat » (majuscule,
 * espaces, point final) pour vérifier la tolérance de la correction sur les vrais corrigés.
 */
async function takeQuiz(stored: any, answerRight: (i: number) => boolean): Promise<{ attemptId: string; final: any }> {
    const res = await fetch(
        `${API}/questionnaires/${stored._id}/invitations`,
        staff('POST', { candidate_id: candidateId }),
    );
    expect(res.status).toBe(201);
    const { url, attempt_id: attemptId } = await res.json();
    const call = candidateClient(url.split('/test/')[1]);

    expect((await call('')).status).toBe(200);
    const started = await call('/start', 'POST', { confirm_identity: true });
    expect(started.status).toBe(200);

    let final: any = started.body;
    for (const [i, q] of (stored.questions as any[]).entries()) {
        const right = answerRight(i);
        let payload: Record<string, unknown>;
        if (q.type === 'text') {
            const good = q.accepted_answers[0] as string;
            const typed = `  ${good.charAt(0).toUpperCase()}${good.slice(1)}. `;
            payload = { question_id: q._id, text: right ? typed : 'réponse fausse' };
        } else {
            const pick = q.choices.find((c: any) => c.correct === right);
            payload = { question_id: q._id, choice_ids: [pick._id] };
        }
        // Une question à la fois : le serveur impose l'ordre.
        // oxlint-disable-next-line no-await-in-loop
        const answered = await call('/answer', 'POST', payload);
        expect(answered.status, `question ${i + 1}`).toBe(200);
        final = answered.body.state;
    }
    return { attemptId, final };
}

describe('Les 5 questionnaires repris de ClassMarker', () => {
    beforeEach(async () => {
        await truncateMysql();
        await getModels().Candidate.deleteMany({ _id: candidateId });
        await new CandidateRepository().create({
            _id: candidateId,
            candidate_id: candidateId,
            status: CandidateStatus.SEEKING,
            identity: {
                full_name: 'Jean Dupont',
                email: `jean.dupont-${suffix}@test.local`,
                phone: '0600000000',
            } as any,
        });
    });

    describe.each(QUIZZES)('$file', (expected) => {
        const quiz = loadQuiz(expected.file);
        const total = quiz.questions.reduce((s, q) => s + q.points, 0);

        it('correspond au tableau du README (questions, points, TP, réglages)', () => {
            expect(quiz.questions).toHaveLength(expected.questions);
            expect(total).toBe(expected.points);
            expect(quiz.tp_types).toEqual(expected.tp);
            expect(quiz.questions.filter((q) => q.type === 'text')).toHaveLength(expected.freeText);
            expect(quiz).toMatchObject({
                duration_minutes: 20,
                pass_threshold: 50,
                immediate_feedback: false,
                allow_skip: false,
            });
        });

        it('chaque question a un énoncé, une seule bonne réponse et des choix distincts', () => {
            for (const [i, q] of quiz.questions.entries()) {
                const label = `question ${i + 1}`;
                expect(q.text.trim(), label).not.toBe('');
                if (q.type === 'text') {
                    expect(q.accepted_answers?.length, label).toBeGreaterThan(0);
                    continue;
                }
                const texts = (q.choices ?? []).map((c) => c.text.trim().toLocaleLowerCase('fr'));
                expect(texts.length, label).toBeGreaterThanOrEqual(2);
                expect(new Set(texts).size, `${label} : choix en double`).toBe(texts.length);
                expect(
                    texts.every((t) => t !== ''),
                    label,
                ).toBe(true);
                expect(
                    q.choices!.filter((c) => c.correct),
                    `${label} : bonnes réponses`,
                ).toHaveLength(1);
            }
        });

        it("s'importe sans erreur et se ré-exporte à l'identique", async () => {
            const stored = await importAndActivate(quiz);
            expect(stored.questions).toHaveLength(expected.questions);
            const exported = await (await fetch(`${API}/questionnaires/${stored._id}/export`, staff())).json();
            expect(exported).toEqual(quiz);
        });

        it('un sans-faute donne 100 % et le résultat arrive sur la fiche candidat', async () => {
            const stored = await importAndActivate(quiz);
            const { attemptId, final } = await takeQuiz(stored, () => true);
            expect(final).toMatchObject({ status: 'completed', percentage: 100 });

            const candidate = await getModels().Candidate.findById(candidateId).lean<any>();
            expect(candidate.classmarker).toMatchObject({
                test_name: quiz.title,
                percentage: 100,
                points_scored: expected.points,
                points_available: expected.points,
                passed: true,
                source: 'internal',
                attempt_id: attemptId,
            });
            expect(candidate.classmarker.questions).toHaveLength(expected.questions);
            expect(candidate.classmarker.questions.every((q: any) => q.result === 'correct')).toBe(true);
        });

        it('un passage partiel est noté au point près, sous le seuil = échec, PDF téléchargeable', async () => {
            const stored = await importAndActivate(quiz);
            // Une question sur trois juste : score attendu recalculé depuis le fichier source.
            const right = (i: number) => i % 3 === 0;
            const scored = quiz.questions.reduce((s, q, i) => s + (right(i) ? q.points : 0), 0);
            const expectedPct = Math.round((scored / total) * 1000) / 10;
            expect(expectedPct).toBeLessThan(50);

            const { attemptId, final } = await takeQuiz(stored, right);
            expect(final).toMatchObject({ status: 'completed', percentage: expectedPct });

            const candidate = await getModels().Candidate.findById(candidateId).lean<any>();
            expect(candidate.classmarker).toMatchObject({ points_scored: scored, passed: false });
            const results = candidate.classmarker.questions.map((q: any) => q.result);
            expect(results).toEqual(quiz.questions.map((_, i) => (right(i) ? 'correct' : 'incorrect')));

            const pdf = await fetch(`${API}/questionnaires/attempts/${attemptId}/pdf`, staff());
            expect(pdf.status).toBe(200);
            expect(pdf.headers.get('content-type')).toBe('application/pdf');
            expect(pdf.headers.get('content-disposition')).toContain('Resultats_test_Jean_Dupont');
            expect(
                Buffer.from(await pdf.arrayBuffer())
                    .subarray(0, 4)
                    .toString(),
            ).toBe('%PDF');
        });
    });

    it('seuil de 50 % : exactement la moitié des points = réussi, un demi-point de moins = échec', async () => {
        // NTC : 20 questions à 0,5 point → 10 justes = 5/10 = 50 %, 9 justes = 45 %.
        const quiz = loadQuiz('negociateur-technico-commercial.json');
        const stored = await importAndActivate(quiz);

        const half = await takeQuiz(stored, (i) => i < 10);
        expect(half.final).toMatchObject({ percentage: 50 });
        expect((await getModels().Candidate.findById(candidateId).lean<any>()).classmarker.passed).toBe(true);

        const below = await takeQuiz(stored, (i) => i < 9);
        expect(below.final).toMatchObject({ percentage: 45 });
        const candidate = await getModels().Candidate.findById(candidateId).lean<any>();
        expect(candidate.classmarker.passed).toBe(false);
        // Les deux passages restent dans l'historique de la fiche.
        expect(candidate.classmarker_history).toHaveLength(2);
    });
});

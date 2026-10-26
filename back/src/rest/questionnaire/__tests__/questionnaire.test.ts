import { describe, it, expect, beforeEach } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { truncateMysql } from '../../../../test/helpers/db';
import { env } from '../../../config/env';
import { getModels } from '../../../db/mongo/tenant';
import { CandidateRepository } from '../../../repositories/mongo/CandidateRepository';
import { CandidateService } from '../../../services/CandidateService';
import { CandidateStatus } from '../../../types/candidate.types';

const API = `http://localhost:${env.API_PORT}/api`;
const suffix = Date.now();
const candidateId = `q-cand-${suffix}`;

const rh = mintAuthCookies({ id: 7, email: `rh-${suffix}@test.local`, role: 'RH' });
const commercial = mintAuthCookies({ id: 8, email: `com-${suffix}@test.local`, role: 'COMMERCIAL' });

function staff(auth: { cookieHeader: string; csrfHeader: string }, method = 'GET', body?: unknown): RequestInit {
    return {
        method,
        headers: { Cookie: auth.cookieHeader, 'x-csrf-token': auth.csrfHeader, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
    };
}

const QUESTIONNAIRE = {
    title: 'Positionnement NTC',
    duration_minutes: 20,
    pass_threshold: 50,
    immediate_feedback: true,
    allow_skip: false,
    questions: [
        {
            type: 'single',
            text: 'Que signifie CRM ?',
            points: 1,
            choices: [
                { text: 'Customer Relationship Management', correct: true },
                { text: 'Central Resource Module', correct: false },
            ],
        },
        { type: 'true_false', text: 'Un devis engage le client.', points: 1, answer: false },
        {
            type: 'multiple',
            text: 'Lesquels sont des canaux de vente ?',
            points: 2,
            choices: [
                { text: 'Téléphone', correct: true },
                { text: 'Email', correct: true },
                { text: 'Imprimante', correct: false },
            ],
        },
    ],
};

/** Client « candidat » : garde le cookie d'appareil entre les appels, comme un navigateur. */
function candidateClient(token: string) {
    let cookie = '';
    const call = async (path: string, method = 'GET', body?: unknown) => {
        const res = await fetch(`${API}/q/${token}${path}`, {
            method,
            headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        const set = res.headers.get('set-cookie');
        if (set) cookie = set.split(';')[0];
        const text = await res.text();
        return { status: res.status, body: text ? JSON.parse(text) : null, raw: text };
    };
    return { call, getCookie: () => cookie };
}

async function seedCandidate(): Promise<void> {
    await getModels().Candidate.deleteMany({ _id: candidateId });
    await new CandidateRepository().create({
        _id: candidateId,
        candidate_id: candidateId,
        status: CandidateStatus.SEEKING,
        identity: { full_name: 'Jean Dupont', email: `jean.dupont-${suffix}@test.local`, phone: '0600000000' } as any,
    });
}

async function createActiveQuestionnaire(body: unknown = QUESTIONNAIRE): Promise<any> {
    const created = await fetch(`${API}/questionnaires`, staff(rh, 'POST', body));
    expect(created.status).toBe(201);
    const { questionnaire } = await created.json();
    const activated = await fetch(
        `${API}/questionnaires/${questionnaire._id}/status`,
        staff(rh, 'POST', { status: 'active' }),
    );
    expect(activated.status).toBe(200);
    return questionnaire;
}

async function invite(questionnaireId: string, validity?: number): Promise<{ token: string; attempt_id: string }> {
    const res = await fetch(
        `${API}/questionnaires/${questionnaireId}/invitations`,
        staff(rh, 'POST', { candidate_id: candidateId, validity_minutes: validity }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    return { token: body.url.split('/test/')[1], attempt_id: body.attempt_id };
}

describe('Questionnaires internes', () => {
    beforeEach(async () => {
        await truncateMysql();
        await seedCandidate();
    });

    it('réserve le correcteur au recrutement', async () => {
        expect((await fetch(`${API}/questionnaires`)).status).toBe(401);
        expect((await fetch(`${API}/questionnaires`, staff(commercial))).status).toBe(403);
        expect((await fetch(`${API}/questionnaires`, staff(rh))).status).toBe(200);
    });

    it('refuse un import invalide avec des erreurs lisibles (HTML, pas de bonne réponse)', async () => {
        const res = await fetch(
            `${API}/questionnaires`,
            staff(rh, 'POST', {
                title: '<b>Test</b>',
                questions: [{ type: 'single', text: 'Q', choices: [{ text: 'a' }, { text: 'b' }] }],
            }),
        );
        expect(res.status).toBe(400);
        const { error } = await res.json();
        expect(error).toContain('HTML');
        expect(error).toContain('au moins une bonne réponse');
    });

    it('parcours complet : résultat écrit au format ClassMarker, sans jamais exposer les bonnes réponses', async () => {
        const q = await createActiveQuestionnaire();
        const { token, attempt_id } = await invite(q._id);
        expect(token).toMatch(/^[a-f0-9]{64}:reunion$/);
        const client = candidateClient(token);

        const state = await client.call('');
        expect(state.status).toBe(200);
        expect(state.body.status).toBe('invited');
        expect(state.body.candidate.full_name).toBe('Jean Dupont');
        expect(state.body.candidate.email_masked).not.toContain('jean.dupont');
        expect(state.raw).not.toContain(candidateId);
        // Deux chargements simultanés avant démarrage ne verrouillent rien.
        expect((await fetch(`${API}/q/${token}`)).status).toBe(200);

        expect((await client.call('/start', 'POST', {})).status).toBe(400);
        const started = await client.call('/start', 'POST', { confirm_identity: true });
        expect(started.status).toBe(200);
        expect(client.getCookie()).toMatch(/^q_device=/);

        // Une fois commencé, un autre appareil ne peut pas reprendre le lien.
        const intruder = await fetch(`${API}/q/${token}`);
        expect(intruder.status).toBe(403);
        expect(started.body.status).toBe('in_progress');
        expect(started.body.question.text).toBe('Que signifie CRM ?');
        expect(started.raw).not.toContain('"correct"');

        const [q1, q2, q3] = (await getModels().Questionnaire.findById(q._id).lean<any>()).questions;
        const right = (qq: any) => qq.choices.filter((c: any) => c.correct).map((c: any) => c._id);
        const wrong = (qq: any) =>
            qq.choices
                .filter((c: any) => !c.correct)
                .map((c: any) => c._id)
                .slice(0, 1);

        // Q1 juste, feedback immédiat activé.
        const a1 = await client.call('/answer', 'POST', { question_id: q1._id, choice_ids: right(q1) });
        expect(a1.status).toBe(200);
        expect(a1.body.feedback).toEqual({ correct: true, correct_choice_ids: right(q1) });
        expect(a1.body.state.current_index).toBe(1);
        expect(a1.body.state.question.text).toBe('Un devis engage le client.');
        expect(JSON.stringify(a1.body.state)).not.toContain('"correct"');

        // Pas de retour arrière : re-répondre à Q1 est refusé.
        const replay = await client.call('/answer', 'POST', { question_id: q1._id, choice_ids: wrong(q1) });
        expect(replay.status).toBe(409);
        // Passer est interdit (allow_skip=false), choix inconnu refusé.
        expect((await client.call('/answer', 'POST', { question_id: q2._id, skip: true })).status).toBe(400);
        expect((await client.call('/answer', 'POST', { question_id: q2._id, choice_ids: ['nope'] })).status).toBe(400);

        await client.call('/visibility', 'POST');
        // Q2 fausse, Q3 juste (2 points) → 3/4 = 75 %.
        await client.call('/answer', 'POST', { question_id: q2._id, choice_ids: wrong(q2) });
        const last = await client.call('/answer', 'POST', { question_id: q3._id, choice_ids: right(q3) });
        expect(last.body.state).toMatchObject({ status: 'completed', percentage: 75 });

        // Résultat recopié dans candidate.classmarker (+ historique), format inchangé.
        const candidate = await getModels().Candidate.findById(candidateId).lean<any>();
        expect(candidate.classmarker).toMatchObject({
            percentage: 75,
            points_scored: 3,
            points_available: 4,
            passed: true,
            test_name: 'Positionnement NTC',
            source: 'internal',
            attempt_id,
            tab_switch_count: 1,
        });
        expect(candidate.classmarker_history).toHaveLength(1);
        expect(candidate.classmarker.questions[2]).toMatchObject({
            question_id: 3,
            correct_option: 'A,B',
            user_response: 'A,B',
            result: 'correct',
        });

        // L'ancienne route de lecture de la fiche continue de servir le résultat.
        const ficheRes = await fetch(`${API}/webhooks/classmarker/result/${candidateId}`, staff(rh));
        expect((await ficheRes.json()).result.percentage).toBe(75);

        // Lien mort une fois terminé ; questionnaire verrouillé.
        expect((await client.call('/start', 'POST', { confirm_identity: true })).status).toBe(409);
        const locked = await fetch(`${API}/questionnaires/${q._id}`, staff(rh, 'PUT', QUESTIONNAIRE));
        expect(locked.status).toBe(409);
        const dup = await fetch(`${API}/questionnaires/${q._id}/duplicate`, staff(rh, 'POST'));
        expect((await dup.json()).questionnaire).toMatchObject({ version: 2, locked: false, status: 'draft' });

        // Détail correcteur : bonnes réponses + réponse donnée, aucun secret.
        const detail = await (await fetch(`${API}/questionnaires/attempts/${attempt_id}`, staff(rh))).json();
        expect(detail.attempt.questions[1].answer.correct).toBe(false);
        expect(detail.attempt.token_hash).toBeUndefined();
        expect(detail.attempt.device_hash).toBeUndefined();
    });

    it('expire une invitation non commencée et clôture une tentative hors délai', async () => {
        const q = await createActiveQuestionnaire();
        const first = await invite(q._id);
        await getModels().QuestionnaireAttempt.updateOne(
            { _id: first.attempt_id },
            { $set: { expires_at: new Date(Date.now() - 1000) } },
        );
        const expired = await candidateClient(first.token).call('');
        expect(expired.body.status).toBe('expired');

        const second = await invite(q._id);
        const client = candidateClient(second.token);
        await client.call('');
        await client.call('/start', 'POST', { confirm_identity: true });
        await getModels().QuestionnaireAttempt.updateOne(
            { _id: second.attempt_id },
            { $set: { deadline: new Date(Date.now() - 60 * 1000) } },
        );
        const late = await client.call('/answer', 'POST', { question_id: 'x', choice_ids: [] });
        expect(late.status).toBe(409);
        const final = await client.call('');
        expect(final.body).toMatchObject({ status: 'completed', percentage: 0 });
        const candidate = await getModels().Candidate.findById(candidateId).lean<any>();
        expect(candidate.classmarker.questions.every((x: any) => x.result === 'unanswered')).toBe(true);
    });

    it("régénérer invalide l'ancien lien", async () => {
        const q = await createActiveQuestionnaire();
        const first = await invite(q._id);
        await invite(q._id);
        expect((await candidateClient(first.token).call('')).body.status).toBe('cancelled');
    });

    it("le mode test n'écrit rien sur une fiche et ne verrouille pas", async () => {
        const q = await createActiveQuestionnaire();
        const res = await fetch(`${API}/questionnaires/${q._id}/test-run`, staff(rh, 'POST'));
        const client = candidateClient((await res.json()).url.split('/test/')[1]);
        const state = await client.call('');
        expect(state.body).toMatchObject({ is_test_run: true, candidate: null });
        await client.call('/start', 'POST', { confirm_identity: true });
        const stored = await getModels().Questionnaire.findById(q._id).lean<any>();
        expect(stored.locked).toBe(false);
        const candidate = await getModels().Candidate.findById(candidateId).lean<any>();
        expect(candidate.classmarker).toBeUndefined();
    });

    it('télécharge le PDF des résultats sans Google Drive, y compris pour un passage de test', async () => {
        const q = await createActiveQuestionnaire();
        const [q1, q2, q3] = (await getModels().Questionnaire.findById(q._id).lean<any>()).questions;
        const first = (qq: any) => [qq.choices[0]._id];
        const answerAll = async (client: ReturnType<typeof candidateClient>) => {
            await client.call('');
            await client.call('/start', 'POST', { confirm_identity: true });
            for (const qq of [q1, q2, q3]) {
                // Une question à la fois : le serveur impose l'ordre.
                // oxlint-disable-next-line no-await-in-loop
                await client.call('/answer', 'POST', { question_id: qq._id, choice_ids: first(qq) });
            }
        };

        const { token, attempt_id } = await invite(q._id);
        const pdfUrl = `${API}/questionnaires/attempts/${attempt_id}/pdf`;
        // Pas encore terminé → pas de PDF ; hors recrutement → refusé.
        expect((await fetch(pdfUrl, staff(rh))).status).toBe(409);
        expect((await fetch(pdfUrl, staff(commercial))).status).toBe(403);

        await answerAll(candidateClient(token));
        const res = await fetch(pdfUrl, staff(rh));
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toBe('application/pdf');
        expect(res.headers.get('content-disposition')).toContain('Resultats_test_Jean_Dupont_Positionnement_NTC');
        expect(
            Buffer.from(await res.arrayBuffer())
                .subarray(0, 4)
                .toString(),
        ).toBe('%PDF');

        const run = await fetch(`${API}/questionnaires/${q._id}/test-run`, staff(rh, 'POST'));
        const { url, attempt_id: runId } = await run.json();
        await answerAll(candidateClient(url.split('/test/')[1]));
        const runPdf = await fetch(`${API}/questionnaires/attempts/${runId}/pdf`, staff(rh));
        expect(runPdf.status).toBe(200);
        expect(runPdf.headers.get('content-disposition')).toContain('Passage_de_test');
    });

    it('corrige une réponse libre (casse, espaces, ponctuation ignorés ; accents comptés)', async () => {
        const missing = await fetch(
            `${API}/questionnaires`,
            staff(rh, 'POST', { title: 'Libre', questions: [{ type: 'text', text: 'Q' }] }),
        );
        expect(missing.status).toBe(400);
        expect((await missing.json()).error).toContain('accepted_answers');

        const q = await createActiveQuestionnaire({
            title: 'Conjugaison',
            immediate_feedback: true,
            questions: [
                { type: 'text', text: "J'ai ........ le devis hier.", points: 1, accepted_answers: ['envoyé'] },
                { type: 'text', text: 'Capitale de la France ?', points: 1, accepted_answers: ['Paris'] },
                { type: 'text', text: 'Participe passé de recevoir', points: 1, accepted_answers: ['reçu'] },
            ],
        });
        const [q1, q2, q3] = (await getModels().Questionnaire.findById(q._id).lean<any>()).questions;
        const { token } = await invite(q._id);
        const client = candidateClient(token);
        await client.call('');
        const started = await client.call('/start', 'POST', { confirm_identity: true });
        expect(started.body.question).toMatchObject({ type: 'text', choices: [] });
        expect(started.raw).not.toContain('envoyé');

        expect((await client.call('/answer', 'POST', { question_id: q1._id, text: '   ' })).status).toBe(400);
        const a1 = await client.call('/answer', 'POST', { question_id: q1._id, text: '  « Envoyé. » ' });
        expect(a1.body.feedback).toMatchObject({ correct: true, accepted_answers: ['envoyé'] });
        await client.call('/answer', 'POST', { question_id: q2._id, text: 'paris' });
        const a3 = await client.call('/answer', 'POST', { question_id: q3._id, text: 'recu' });
        expect(a3.body.feedback.correct).toBe(false);
        expect(a3.body.state).toMatchObject({ status: 'completed' });

        const candidate = await getModels().Candidate.findById(candidateId).lean<any>();
        expect(candidate.classmarker.points_scored).toBe(2);
        expect(candidate.classmarker.questions[2]).toMatchObject({
            question_type: 'freetext',
            options: { exact_match: [{ content: 'reçu' }] },
            user_response: 'recu',
            result: 'incorrect',
        });

        const exported = await (await fetch(`${API}/questionnaires/${q._id}/export`, staff(rh))).json();
        expect(exported.questions[0]).toEqual({
            type: 'text',
            text: "J'ai ........ le devis hier.",
            points: 1,
            accepted_answers: ['envoyé'],
        });
    });

    it('supprime les passages avec le candidat (droit à l’effacement)', async () => {
        const q = await createActiveQuestionnaire();
        await invite(q._id);
        expect(await getModels().QuestionnaireAttempt.countDocuments({ candidate_id: candidateId })).toBe(1);
        await new CandidateService().delete(candidateId);
        expect(await getModels().QuestionnaireAttempt.countDocuments({ candidate_id: candidateId })).toBe(0);
    });

    it('rejette un jeton mal formé ou inconnu', async () => {
        expect((await fetch(`${API}/q/abc`)).status).toBe(404);
        expect((await fetch(`${API}/q/${'a'.repeat(64)}:reunion`)).status).toBe(404);
    });
});

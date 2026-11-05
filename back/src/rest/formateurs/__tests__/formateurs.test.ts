import { randomUUID } from 'crypto';
import { describe, expect, it } from 'vitest';
import { env } from '../../../config/env';
import { tenantTimezone } from '../../../config/tenant';
import { getModels } from '../../../db/mongo/tenant';
import { generateSignature } from '../../../external/crypto';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { endOfLocalDay, localDate } from '../../../utils/zonedTime';

const API = `http://localhost:${env.API_PORT}`;

function pedaAuth() {
    return mintAuthCookies({ id: 1, email: 'peda@test.local', role: 'PEDA', permission: 'EMPLOYEE' });
}

function staffHeaders(auth: ReturnType<typeof pedaAuth>) {
    return {
        'Content-Type': 'application/json',
        Cookie: auth.cookieHeader,
        'x-csrf-token': auth.csrfHeader,
    };
}

async function call(
    method: string,
    path: string,
    body?: Record<string, unknown>,
    auth = pedaAuth(),
): Promise<{ status: number; body: any }> {
    const response = await fetch(`${API}/api/formateurs${path}`, {
        method,
        headers: staffHeaders(auth),
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
}

async function createFormateur(overrides: Record<string, unknown> = {}) {
    const suffix = randomUUID().slice(0, 8);
    const { status, body } = await call('POST', '/', {
        name: 'Marie Formatrice',
        email: `marie.${suffix}@test.local`,
        phone: '06 12 34 56 78',
        comment: 'Disponible le vendredi.',
        ...overrides,
    });
    expect(status).toBe(201);
    return body.formateur as {
        id: string;
        name: string;
        email: string;
        phone: string | null;
        comment: string | null;
        stats: {
            seanceCount: number;
            plannedMinutes: number;
            sessionCount: number;
            firstSeanceDate: string | null;
            lastSeanceDate: string | null;
            sessions: { id: string; nom: string; seanceCount: number; plannedMinutes: number }[];
        };
        history: {
            action: string;
            changes: { field: string; from: string | null; to: string | null }[];
            note: string | null;
        }[];
    };
}

async function seedSession(): Promise<string> {
    const suffix = randomUUID();
    const degreeId = `form-degree-${suffix}`;
    const classId = `form-class-${suffix}`;
    await getModels().FilizDegree.create({
        _id: degreeId,
        degree_type: 'TP',
        title: 'Développeur web',
        prepared_title: 'DW',
        synced_at: new Date(),
    });
    await getModels().FilizClass.create({
        _id: classId,
        degree_id: degreeId,
        name: `Promo formateurs ${suffix.slice(0, 8)}`,
        start_date: '2026-09-01',
        end_date: '2027-06-30',
        synced_at: new Date(),
    });
    return classId;
}

function seanceInput(sessionId: string, overrides: Record<string, unknown> = {}) {
    return {
        sessionId,
        date: localDate(new Date(), tenantTimezone()),
        site: 'Nord',
        mode: 'salle',
        formateurName: 'Formateur Inconnu',
        formateurEmail: `inconnu.${randomUUID().slice(0, 8)}@test.local`,
        morningClassStart: '08:00',
        morningClassEnd: '12:30',
        afternoonClassStart: '13:30',
        afternoonClassEnd: '17:00',
        morningStart: '08:00',
        morningEnd: '10:30',
        afternoonStart: '13:45',
        afternoonEnd: '14:30',
        ...overrides,
    };
}

async function createSeance(input: Record<string, unknown>) {
    const response = await fetch(`${API}/api/emargement/seances`, {
        method: 'POST',
        headers: staffHeaders(pedaAuth()),
        body: JSON.stringify(input),
    });
    return { status: response.status, body: await response.json() };
}

/** Séance antérieure à l'annuaire : ni `formateur_id`, ni horaires de cours. */
async function seedLegacySeance(formateurEmail: string, date: string) {
    return getModels().Seance.create({
        _id: 'legacy-session',
        session_id: 'legacy-session',
        session_nom: 'Promo historique',
        date,
        start_time: '09:00',
        end_time: '12:00',
        site: 'Nord',
        mode: 'salle',
        formateur_name: 'Ancien Formateur',
        formateur_email: formateurEmail,
        morning_start: '09:00',
        morning_end: '12:00',
        afternoon_start: null,
        afternoon_end: null,
        timezone: tenantTimezone(),
        token_secret: generateSignature(),
        invite_expires_at: endOfLocalDay(date, tenantTimezone()),
        created_by: 1,
    });
}

describe('API formateurs — annuaire du Peda', () => {
    it('crée une fiche, normalise l’e-mail et journalise la création', async () => {
        const suffix = randomUUID().slice(0, 8);
        const { status, body } = await call('POST', '/', {
            name: '  Marie Formatrice  ',
            email: `  Marie.${suffix}@Test.Local  `,
            phone: ' 06 12 34 56 78 ',
            comment: '  Disponible le vendredi.  ',
        });
        expect(status).toBe(201);
        expect(body.formateur).toMatchObject({
            name: 'Marie Formatrice',
            email: `marie.${suffix}@test.local`,
            phone: '06 12 34 56 78',
            comment: 'Disponible le vendredi.',
        });
        expect(body.formateur.stats).toMatchObject({
            seanceCount: 0,
            plannedMinutes: 0,
            sessionCount: 0,
            firstSeanceDate: null,
            lastSeanceDate: null,
        });
        expect(body.formateur.history).toContainEqual(
            expect.objectContaining({ action: 'formateur_created', note: null }),
        );
    });

    it('refuse un e-mail déjà pris et un e-mail invalide', async () => {
        const suffix = randomUUID().slice(0, 8);
        const email = `dup.${suffix}@test.local`;
        await call('POST', '/', { name: 'Premier', email });
        const duplicate = await call('POST', '/', { name: 'Second', email: email.toUpperCase() });
        expect(duplicate.status).toBe(409);
        expect(duplicate.body.code).toBe('email');

        const invalid = await call('POST', '/', { name: 'Troisième', email: 'pas-un-email' });
        expect(invalid.status).toBe(400);
        expect(invalid.body.code).toBe('validation');

        const missingName = await call('POST', '/', { email: `sansnom.${suffix}@test.local` });
        expect(missingName.status).toBe(400);
    });

    it('modifie une fiche en ne traçant que les champs réellement changés', async () => {
        const formateur = await createFormateur();
        const suffix = randomUUID().slice(0, 8);

        const { status, body } = await call('PUT', `/${formateur.id}`, {
            phone: '07 00 00 00 00',
            email: `nouveau.${suffix}@test.local`,
        });
        expect(status).toBe(200);
        expect(body.formateur).toMatchObject({
            name: formateur.name,
            email: `nouveau.${suffix}@test.local`,
            phone: '07 00 00 00 00',
            comment: formateur.comment,
        });
        const update = body.formateur.history.find((entry: { action: string }) => entry.action === 'formateur_updated');
        expect(update).toBeTruthy();
        expect(update.changes).toEqual(
            expect.arrayContaining([
                { field: 'email', from: formateur.email, to: `nouveau.${suffix}@test.local` },
                { field: 'phone', from: '06 12 34 56 78', to: '07 00 00 00 00' },
            ]),
        );
        // Le nom et le commentaire n'ont pas bougé : aucune ligne de diff.
        expect(update.changes.map((change: { field: string }) => change.field).sort()).toEqual(['email', 'phone']);

        // Une réécriture identique n'ajoute pas d'entrée au journal.
        const before = body.formateur.history.length;
        const same = await call('PUT', `/${formateur.id}`, { phone: '07 00 00 00 00' });
        expect(same.body.formateur.history.length).toBe(before);
    });

    it('refuse de prendre l’e-mail d’une autre fiche', async () => {
        const first = await createFormateur();
        const second = await createFormateur();
        const conflict = await call('PUT', `/${second.id}`, { email: first.email });
        expect(conflict.status).toBe(409);
        expect(conflict.body.code).toBe('email');
    });

    it('ajoute une note Peda append-only, sans toucher aux coordonnées', async () => {
        const formateur = await createFormateur();
        const { status, body } = await call('POST', `/${formateur.id}/notes`, {
            note: 'A demandé à être prévenu 48 h avant.',
        });
        expect(status).toBe(201);
        expect(body.formateur.history[0]).toMatchObject({
            action: 'note',
            note: 'A demandé à être prévenu 48 h avant.',
            changes: [],
        });
        expect(body.formateur).toMatchObject({
            name: formateur.name,
            email: formateur.email,
            phone: formateur.phone,
            comment: formateur.comment,
        });

        const empty = await call('POST', `/${formateur.id}/notes`, { note: '   ' });
        expect(empty.status).toBe(400);
        expect(empty.body.code).toBe('validation');
    });

    it('crée automatiquement le formateur inconnu d’une séance, puis agrège ses heures', async () => {
        const classId = await seedSession();
        const email = `auto.${randomUUID().slice(0, 8)}@test.local`;
        const created = await createSeance(seanceInput(classId, { formateurName: 'Auto Créé', formateurEmail: email }));
        expect(created.status).toBe(201);
        expect(created.body.seance.formateurName).toBe('Auto Créé');
        expect(created.body.seance.formateurId).toBeTruthy();

        const list = await call('GET', '/');
        expect(list.status).toBe(200);
        const fiche = list.body.formateurs.find((row: { email: string }) => row.email === email);
        expect(fiche).toBeTruthy();
        // 08:00–12:30 (270 min) + 13:30–17:00 (210 min), pause déjeuner exclue.
        expect(fiche.stats).toMatchObject({
            seanceCount: 1,
            plannedMinutes: 480,
            sessionCount: 1,
        });
        expect(fiche.stats.sessions[0]).toMatchObject({
            id: classId,
            seanceCount: 1,
            plannedMinutes: 480,
        });

        const detail = await call('GET', `/${fiche.id}`);
        expect(detail.status).toBe(200);
        expect(detail.body.formateur.seances).toHaveLength(1);
        expect(detail.body.formateur.seances[0]).toMatchObject({
            date: created.body.seance.date,
            sessionId: classId,
            plannedMinutes: 480,
        });
        expect(['in_progress', 'to_validate']).toContain(detail.body.formateur.seances[0].validationStatus);

        // Une seconde séance sur la même fiche ne crée pas de doublon.
        const again = await createSeance(seanceInput(classId, { formateurName: 'Auto Créé', formateurEmail: email }));
        expect(again.body.seance.formateurId).toBe(fiche.id);
        const after = await call('GET', `/${fiche.id}`);
        expect(after.body.formateur.stats.seanceCount).toBe(2);
        expect(after.body.formateur.stats.plannedMinutes).toBe(960);
    });

    it('rattache une séance à la fiche sélectionnée et compte les séances antérieures par e-mail', async () => {
        const classId = await seedSession();
        const formateur = await createFormateur();

        const linked = await createSeance(
            seanceInput(classId, {
                formateurId: formateur.id,
                formateurName: 'Nom saisi différent',
                formateurEmail: formateur.email,
            }),
        );
        expect(linked.status).toBe(201);
        expect(linked.body.seance.formateurId).toBe(formateur.id);

        // Séance plus ancienne, sans lien : elle doit compter via l'e-mail.
        await seedLegacySeance(formateur.email, '2026-10-05');

        const detail = await call('GET', `/${formateur.id}`);
        expect(detail.body.formateur.stats.seanceCount).toBe(2);
        expect(detail.body.formateur.stats.sessions.map((s: { id: string }) => s.id)).toEqual(
            expect.arrayContaining([classId, 'legacy-session']),
        );
        expect(detail.body.formateur.seances.map((s: { id: string }) => s.id)).toEqual(
            expect.arrayContaining([linked.body.seance.id, 'legacy-session']),
        );
        // Une séance antérieure au lot 8 retombe sur ses créneaux : 09:00–12:00.
        const legacy = detail.body.formateur.seances.find((s: { id: string }) => s.id === 'legacy-session');
        expect(legacy.plannedMinutes).toBe(180);
        expect(legacy.validationStatus).toBe('anomaly');
        expect(detail.body.formateur.stats.firstSeanceDate).toBe('2026-10-05');
    });

    it('renvoie 404 pour une fiche inconnue', async () => {
        const response = await call('GET', '/inconnu');
        expect(response.status).toBe(404);
        expect(response.body.code).toBe('not_found');
    });

    it('exige une authentification', async () => {
        const response = await fetch(`${API}/api/formateurs`, { method: 'GET' });
        expect(response.status).toBe(401);
    });
});

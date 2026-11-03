import { randomUUID } from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../../config/env';
import { tenantTimezone } from '../../../config/tenant';
import { getModels } from '../../../db/mongo/tenant';
import { generateSignature } from '../../../external/crypto';
import pool from '../../../db/mysql/connection';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { spyOnGoogleMail } from '../../../../test/helpers/googleMail';
import { buildSeanceToken } from '../../../services/emargementTokens';
import { RUPTURE_MOTIFS } from '../../../types/rupture.types';
import { addDaysToDate, endOfLocalDay, localDate } from '../../../utils/zonedTime';

const API = `http://localhost:${env.API_PORT}`;

// L'app Express est démarrée par `test/setup.ts` avant ce fichier : un `vi.mock`
// d'`external/google/system-mail` arriverait trop tard (cf. HOWTOTEST §9). On
// espionne donc le service Gmail et on sème l'utilisateur système pour que
// `sendSystemEmail` aille jusqu'à l'envoi.
const SYSTEM_EMAIL = 'dev@disciplina.re';

/** PNG 1×1 en data-URL : suffit à satisfaire la validation de format côté serveur. */
const SIGNATURE_PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
/** Second tracé distinct, pour vérifier qu'une signature en remplace bien une autre. */
const FORMATEUR_SIGNATURE_PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

async function seedSystemMailUser(): Promise<void> {
    await pool.execute(
        `INSERT INTO users (email, first_name, last_name, password, role_id, permission_id, oauth_token, refresh_token)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE oauth_token = VALUES(oauth_token), refresh_token = VALUES(refresh_token)`,
        [SYSTEM_EMAIL, 'Système', 'Mail', 'pwd', 1, 1, 'oauth-token', 'refresh-token'],
    );
}

function pedaAuth() {
    return mintAuthCookies({ id: 1, email: 'peda@test.local', role: 'PEDA', permission: 'EMPLOYEE' });
}

function staffHeaders(auth: { cookieHeader: string; csrfHeader: string }) {
    return {
        'Content-Type': 'application/json',
        Cookie: auth.cookieHeader,
        'x-csrf-token': auth.csrfHeader,
    };
}

function tokenFromUrl(url: string): string {
    const path = new URL(url).pathname;
    return decodeURIComponent(path.slice(path.lastIndexOf('/') + 1));
}

async function seedSessionWithAlternants(alternantCount = 2) {
    const suffix = randomUUID();
    const classId = `emarg-class-${suffix}`;
    const degreeId = `emarg-degree-${suffix}`;
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
        name: `Promo émargement ${suffix.slice(0, 8)}`,
        start_date: '2026-09-01',
        end_date: '2027-06-30',
        synced_at: new Date(),
    });
    const alternants = [];
    for (let i = 0; i < alternantCount; i++) {
        const alternant = await getModels().Alternant.create({
            _id: randomUUID(),
            first_name: `Prénom${i}`,
            last_name: `Nom${i}`,
            session: '',
            session_id: null,
            email: `alternant${i}.${suffix}@test.local`,
            phone: null,
            candidate_id: null,
            // Financeur porté par la feuille d'émargement (cf. §1.7 du cahier des charges).
            financeur: i === 0 ? 'Opco 2i' : null,
            company: null,
            linked_alternant_ids: [],
            filiz: {
                folder_id: `folder-${suffix}-${i}`,
                class_id: classId,
                degree_id: degreeId,
                step: 1,
                synced_at: new Date(),
            },
            archived_at: null,
            created_at: new Date(),
            updated_at: new Date(),
        });
        alternants.push(alternant);
    }
    return { classId, degreeId, alternants };
}

async function cleanupSession(classId: string, degreeId: string, alternantIds: string[]) {
    await getModels().Alternant.deleteMany({ _id: { $in: alternantIds } });
    await getModels().FilizClass.deleteOne({ _id: classId });
    await getModels().FilizDegree.deleteOne({ _id: degreeId });
}

function seanceInput(sessionId: string, overrides: Record<string, unknown> = {}) {
    const tz = tenantTimezone();
    const today = localDate(new Date(), tz);
    return {
        sessionId,
        date: today,
        site: 'Nord',
        mode: 'salle',
        formateurName: 'Jean Formateur',
        formateurEmail: 'formateur@test.local',
        // Horaires de cours (base des heures) : pause déjeuner 12:30 → 13:30.
        morningClassStart: '08:00',
        morningClassEnd: '12:30',
        afternoonClassStart: '13:30',
        afternoonClassEnd: '17:00',
        // Créneaux de signature, bornés à la demi-journée correspondante.
        morningStart: '08:00',
        morningEnd: '10:30',
        afternoonStart: '13:45',
        afternoonEnd: '14:30',
        ...overrides,
    };
}

async function createSeanceHttp(auth: ReturnType<typeof pedaAuth>, input: Record<string, unknown>) {
    const response = await fetch(`${API}/api/emargement/seances`, {
        method: 'POST',
        headers: staffHeaders(auth),
        body: JSON.stringify(input),
    });
    return { status: response.status, body: await response.json() };
}

async function seedSeance(overrides: Record<string, unknown> = {}) {
    const tz = tenantTimezone();
    const now = new Date();
    const today = localDate(now, tz);
    const seance = await getModels().Seance.create({
        _id: randomUUID(),
        session_id: 'seeded-session',
        session_nom: 'Promo seedée',
        date: today,
        start_time: '08:00',
        end_time: '17:00',
        site: 'Nord',
        mode: 'salle',
        formateur_name: 'Jean Formateur',
        formateur_email: 'formateur@test.local',
        morning_start: '00:00',
        morning_end: '23:59',
        afternoon_start: null,
        afternoon_end: null,
        timezone: tz,
        token_secret: generateSignature(),
        invite_expires_at: endOfLocalDay(today, tz),
        signed_at: null,
        signed_by_name: null,
        signature_image: null,
        signed_ip: null,
        signed_user_agent: null,
        created_by: 1,
        ...overrides,
    });
    return seance;
}

afterEach(async () => {
    vi.restoreAllMocks();
    // Le journal d'émargement est append-only en production : en test, on le vide
    // entre deux cas pour que les assertions ne voient que leurs propres événements.
    await getModels().EmargementHistory.deleteMany({});
});

describe('API émargement — côté Peda', () => {
    it('crée une séance, envoie l’invitation et renvoie les liens formateur/QR', async () => {
        const { sendEmail } = spyOnGoogleMail();
        await seedSystemMailUser();
        const auth = pedaAuth();
        const { classId, degreeId, alternants } = await seedSessionWithAlternants();
        // Séance datée de demain : avec la date du jour, les créneaux 08:00–10:30 et
        // 13:45–14:30 sont déjà fermés quand la CI tourne l'après-midi, et la feuille
        // est alors légitimement `to_validate` au lieu d'`in_progress`. Le test doit
        // tester l'état « en cours », pas l'heure d'exécution.
        const tomorrow = addDaysToDate(localDate(new Date(), tenantTimezone()), 1);
        try {
            const { status, body } = await createSeanceHttp(
                auth,
                seanceInput(classId, {
                    date: tomorrow,
                    module: 'Séquence 3 — Communication',
                    location: 'Salle 204',
                }),
            );
            expect(status).toBe(201);
            expect(body.seance).toMatchObject({
                sessionId: classId,
                site: 'Nord',
                mode: 'salle',
                validationStatus: 'in_progress',
                validations: { morning: null, afternoon: null },
                formateurName: 'Jean Formateur',
                // En-tête de la feuille : titre pro snapshoté depuis la promo Filiz,
                // module et lieu libres.
                degreeTitle: 'Développeur web',
                module: 'Séquence 3 — Communication',
                location: 'Salle 204',
            });
            expect(body.seance.formateurUrl).toContain('/emargement/formateur/');
            expect(body.seance.qrUrl).toContain('/emargement/sign/');
            expect(body.inviteSent).toBe(true);
            expect(sendEmail).toHaveBeenCalledTimes(1);
            expect(sendEmail.mock.calls[0][1]).toMatchObject({
                to: 'formateur@test.local',
                subject: expect.stringContaining('Émargement'),
            });
            expect(sendEmail.mock.calls[0][1].html).toContain('/emargement/formateur/');

            const detail = await fetch(`${API}/api/emargement/seances/${body.seance.id}`, {
                headers: { Cookie: auth.cookieHeader },
            }).then((res) => res.json());
            expect(detail.seance.alternants).toHaveLength(alternants.length);
            expect(detail.seance.alternants[0].email).toContain('@test.local');
            expect(detail.seance.alternants[0].financeur).toBe('Opco 2i');
            expect(detail.seance.alternants[1].financeur).toBeNull();

            // Mise à jour partielle : le module change, le lieu et le titre pro tiennent.
            const updated = await fetch(`${API}/api/emargement/seances/${body.seance.id}`, {
                method: 'PUT',
                headers: staffHeaders(auth),
                body: JSON.stringify({ module: 'Séquence 4 — Négociation' }),
            }).then((res) => res.json());
            expect(updated.seance).toMatchObject({
                module: 'Séquence 4 — Négociation',
                location: 'Salle 204',
                degreeTitle: 'Développeur web',
            });
        } finally {
            await getModels().Seance.deleteMany({ session_id: classId });
            await getModels().Emargement.deleteMany({});
            await cleanupSession(
                classId,
                degreeId,
                alternants.map((a) => a._id),
            );
        }
    });

    it('refuse la création sans authentification Peda', async () => {
        const response = await fetch(`${API}/api/emargement/seances`);
        expect(response.status).toBe(401);
    });

    it('crée la séance mais signale l’échec quand aucune boîte ne peut envoyer', async () => {
        // Ni boîte système (`dev@disciplina.re`) ni compte Google pour le Peda :
        // l'invitation ne part pas, et l'API doit le dire au lieu de laisser croire
        // que l'e-mail est envoyé (cf. incident « mail formateur non reçu »).
        const { sendEmail } = spyOnGoogleMail();
        await pool.execute('DELETE FROM users WHERE email = ?', [SYSTEM_EMAIL]);
        const auth = mintAuthCookies({
            id: 987654,
            email: 'sans-google@test.local',
            role: 'PEDA',
            permission: 'EMPLOYEE',
        });
        const { classId, degreeId, alternants } = await seedSessionWithAlternants(1);
        try {
            const { status, body } = await createSeanceHttp(auth, seanceInput(classId));
            expect(status).toBe(201);
            expect(body.inviteSent).toBe(false);
            expect(body.seance.formateurUrl).toContain('/emargement/formateur/');
            expect(sendEmail).not.toHaveBeenCalled();
        } finally {
            await seedSystemMailUser();
            await getModels().Seance.deleteMany({ session_id: classId });
            await getModels().Emargement.deleteMany({});
            await cleanupSession(
                classId,
                degreeId,
                alternants.map((a) => a._id),
            );
        }
    });
});

describe('API émargement — côté formateur', () => {
    it('liste les alternants sans e-mail et enregistre une saisie manuelle', async () => {
        const auth = pedaAuth();
        const { classId, degreeId, alternants } = await seedSessionWithAlternants();
        try {
            const { body } = await createSeanceHttp(auth, seanceInput(classId));
            const token = tokenFromUrl(body.seance.formateurUrl);
            const viewUrl = `${API}/api/emargement/formateur/${encodeURIComponent(token)}`;

            const view = await fetch(viewUrl).then((res) => res.json());
            expect(view.emargement.seance.sessionNom).toContain('Promo émargement');
            expect(view.emargement.seance).toMatchObject({
                degreeTitle: 'Développeur web',
                module: null,
                location: null,
            });
            expect(view.emargement.alternants).toHaveLength(alternants.length);
            expect(view.emargement.alternants[0]).not.toHaveProperty('email');
            expect(view.emargement.alternants[0].financeur).toBe('Opco 2i');
            expect(view.emargement.canEdit).toBe(true);

            const alternant = view.emargement.alternants[0];
            const update = await fetch(`${viewUrl}/attendance`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    alternantId: alternant.id,
                    half: 'morning',
                    status: 'late',
                    statusTime: '08:15',
                }),
            });
            expect(update.status).toBe(200);
            const updated = await update.json();
            expect(updated.attendance).toMatchObject({
                status: 'late',
                statusTime: '08:15',
                signatureMode: 'manual',
            });

            const after = await fetch(viewUrl).then((res) => res.json());
            const row = after.emargement.alternants.find((a: { id: string }) => a.id === alternant.id);
            expect(row.attendance.morning).toMatchObject({ status: 'late', statusTime: '08:15' });

            // Le détail Peda expose les mêmes compteurs que la liste.
            const detail = await fetch(`${API}/api/emargement/seances/${body.seance.id}`, {
                headers: { Cookie: auth.cookieHeader },
            }).then((res) => res.json());
            expect(detail.seance).toMatchObject({ marked: 1, present: 1 });

            // La saisie manuelle est journalisée (création de la feuille + statut).
            expect(detail.seance.history.map((entry: { action: string }) => entry.action)).toContain('seance_created');
            expect(detail.seance.history).toContainEqual(
                expect.objectContaining({
                    action: 'attendance_set',
                    alternantName: `${alternant.firstName} ${alternant.lastName}`,
                    half: 'morning',
                    fromStatus: null,
                    toStatus: 'late',
                    toStatusTime: '08:15',
                    source: 'formateur',
                    actorName: 'Jean Formateur',
                }),
            );
        } finally {
            await getModels().Seance.deleteMany({ session_id: classId });
            await getModels().Emargement.deleteMany({});
            await cleanupSession(
                classId,
                degreeId,
                alternants.map((a) => a._id),
            );
        }
    });

    it('journalise les changements de statut, signatures et verrouillages', async () => {
        const auth = pedaAuth();
        const { classId, degreeId, alternants } = await seedSessionWithAlternants(1);
        // Créneau du matin déjà fermé : la demi-journée est signable, puis verrouillée.
        const seance = await seedSeance({
            session_id: classId,
            morning_start: '00:00',
            morning_end: '00:01',
            afternoon_start: null,
            afternoon_end: null,
        });
        try {
            const token = buildSeanceToken(seance, 'formateur');
            const viewUrl = `${API}/api/emargement/formateur/${encodeURIComponent(token)}`;
            const alternantId = alternants[0]._id;
            const alternantName = `${alternants[0].first_name} ${alternants[0].last_name}`;

            const setStatus = (status: string) =>
                fetch(`${viewUrl}/attendance`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ alternantId, half: 'morning', status }),
                });

            // Deux écritures identiques ne produisent qu'une entrée de journal.
            expect((await setStatus('present')).status).toBe(200);
            expect((await setStatus('present')).status).toBe(200);
            expect((await setStatus('absent')).status).toBe(200);

            const handwritten = await fetch(`${viewUrl}/attendance/sign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alternantId, half: 'morning', signature: SIGNATURE_PNG }),
            });
            expect(handwritten.status).toBe(200);

            // Horodatage à la milliseconde : on laisse passer un tick pour que la
            // signature de la feuille soit strictement postérieure dans le journal.
            await new Promise((resolve) => setTimeout(resolve, 5));
            const sheet = await fetch(`${viewUrl}/sign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ half: 'morning', confirmed: true, signature: SIGNATURE_PNG }),
            });
            expect(sheet.status).toBe(200);

            // Demi-journée verrouillée : la correction refusée n'entre pas au journal.
            expect((await setStatus('present')).status).toBe(409);

            const detail = await fetch(`${API}/api/emargement/seances/${seance._id}`, {
                headers: { Cookie: auth.cookieHeader },
            }).then((res) => res.json());
            const history: { action: string; at: string }[] = detail.seance.history;

            // Journal du plus récent au plus ancien.
            const timestamps = history.map((entry) => new Date(entry.at).getTime());
            expect([...timestamps].sort((a, b) => b - a)).toEqual(timestamps);
            expect(history[0]).toMatchObject({ action: 'half_signed', half: 'morning', source: 'formateur' });

            expect(history.filter((entry) => entry.action === 'attendance_set')).toHaveLength(2);
            expect(detail.seance.history).toContainEqual(
                expect.objectContaining({
                    action: 'attendance_set',
                    alternantName,
                    half: 'morning',
                    fromStatus: null,
                    toStatus: 'present',
                    source: 'formateur',
                    actorName: 'Jean Formateur',
                }),
            );
            expect(detail.seance.history).toContainEqual(
                expect.objectContaining({
                    action: 'attendance_set',
                    fromStatus: 'present',
                    toStatus: 'absent',
                }),
            );
            expect(detail.seance.history).toContainEqual(
                expect.objectContaining({
                    action: 'attendance_signed',
                    alternantName,
                    fromStatus: 'absent',
                    toStatus: 'present',
                    source: 'formateur',
                }),
            );
        } finally {
            await getModels().Emargement.deleteMany({ seance_id: seance._id });
            await getModels().Seance.deleteOne({ _id: seance._id });
            await cleanupSession(
                classId,
                degreeId,
                alternants.map((a) => a._id),
            );
        }
    });

    it('refuse un créneau de signature hors des horaires de cours de sa demi-journée', async () => {
        // Sans cette borne, la fermeture du créneau ne protège plus rien : la
        // signature restait ouverte avant le début du cours et après sa fin. Le
        // créneau est borné à *sa* demi-journée (la pause déjeuner est exclue).
        const auth = pedaAuth();
        const { classId, degreeId, alternants } = await seedSessionWithAlternants(1);
        try {
            const earlyOpen = await createSeanceHttp(auth, seanceInput(classId, { morningStart: '07:00' }));
            expect(earlyOpen.status).toBe(400);
            expect(earlyOpen.body).toMatchObject({ code: 'validation' });

            const lateClose = await createSeanceHttp(auth, seanceInput(classId, { morningEnd: '13:00' }));
            expect(lateClose.status).toBe(400);

            // Un créneau du matin ne peut pas déborder sur l'après-midi.
            const overlapsLunch = await createSeanceHttp(auth, seanceInput(classId, { morningEnd: '12:45' }));
            expect(overlapsLunch.status).toBe(400);

            const afternoonEarly = await createSeanceHttp(auth, seanceInput(classId, { afternoonStart: '07:30' }));
            expect(afternoonEarly.status).toBe(400);

            const afternoonLate = await createSeanceHttp(auth, seanceInput(classId, { afternoonEnd: '18:30' }));
            expect(afternoonLate.status).toBe(400);

            // Les bornes elles-mêmes restent acceptées.
            const ok = await createSeanceHttp(
                auth,
                seanceInput(classId, {
                    morningStart: '08:00',
                    morningEnd: '12:30',
                    afternoonStart: '13:30',
                    afternoonEnd: '17:00',
                }),
            );
            expect(ok.status).toBe(201);

            // Sans après-midi : ni cours ni créneau l'après-midi.
            const morningOnly = await createSeanceHttp(
                auth,
                seanceInput(classId, {
                    afternoonClassStart: null,
                    afternoonClassEnd: null,
                    afternoonStart: null,
                    afternoonEnd: null,
                }),
            );
            expect(morningOnly.status).toBe(201);
        } finally {
            await getModels().Seance.deleteMany({ session_id: classId });
            await getModels().Emargement.deleteMany({});
            await cleanupSession(
                classId,
                degreeId,
                alternants.map((a) => a._id),
            );
        }
    });

    it('laisse le lien formateur valable après minuit (fin du jour J + 7 jours)', async () => {
        const auth = pedaAuth();
        const { classId, degreeId, alternants } = await seedSessionWithAlternants(1);
        try {
            const { body } = await createSeanceHttp(auth, seanceInput(classId));
            const tz = tenantTimezone();
            const expected = endOfLocalDay(addDaysToDate(body.seance.date, 7), tz).getTime();
            expect(new Date(body.seance.inviteExpiresAt).getTime()).toBe(expected);
        } finally {
            await getModels().Seance.deleteMany({ session_id: classId });
            await getModels().Emargement.deleteMany({});
            await cleanupSession(
                classId,
                degreeId,
                alternants.map((a) => a._id),
            );
        }
    });

    it('prolonge la validité du lien quand le Peda renvoie l’invitation', async () => {
        const auth = pedaAuth();
        const { classId, degreeId, alternants } = await seedSessionWithAlternants(1);
        try {
            const { body } = await createSeanceHttp(auth, seanceInput(classId));
            // Lien déjà expiré : sans prolongation, le renvoi enverrait un lien mort.
            await getModels().Seance.updateOne(
                { _id: body.seance.id },
                { invite_expires_at: new Date(Date.now() - 60_000) },
            );

            const resend = await fetch(`${API}/api/emargement/seances/${body.seance.id}/resend`, {
                method: 'POST',
                headers: staffHeaders(auth),
                body: JSON.stringify({ rotate: true }),
            });
            expect(resend.status).toBe(200);

            const tz = tenantTimezone();
            const expected = endOfLocalDay(addDaysToDate(body.seance.date, 7), tz).getTime();
            const after = await fetch(`${API}/api/emargement/seances/${body.seance.id}`, {
                headers: { Cookie: auth.cookieHeader },
            }).then((res) => res.json());
            expect(new Date(after.seance.inviteExpiresAt).getTime()).toBe(expected);
        } finally {
            await getModels().Seance.deleteMany({ session_id: classId });
            await getModels().Emargement.deleteMany({});
            await cleanupSession(
                classId,
                degreeId,
                alternants.map((a) => a._id),
            );
        }
    });

    it('enregistre la signature manuscrite de l’alternant tracée chez le formateur', async () => {
        const auth = pedaAuth();
        const { classId, degreeId, alternants } = await seedSessionWithAlternants(1);
        try {
            const { body } = await createSeanceHttp(
                auth,
                seanceInput(classId, {
                    afternoonClassStart: null,
                    afternoonClassEnd: null,
                    afternoonStart: null,
                    afternoonEnd: null,
                }),
            );
            const token = tokenFromUrl(body.seance.formateurUrl);
            const viewUrl = `${API}/api/emargement/formateur/${encodeURIComponent(token)}`;
            const view = await fetch(viewUrl).then((res) => res.json());
            const alternant = view.emargement.alternants[0];

            const signature = SIGNATURE_PNG;
            const handwritten = await fetch(`${viewUrl}/attendance/sign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alternantId: alternant.id, half: 'morning', signature }),
            });
            expect(handwritten.status).toBe(200);
            const saved = await handwritten.json();
            expect(saved.attendance).toMatchObject({
                status: 'present',
                signatureMode: 'handwritten',
                signatureImage: signature,
            });

            // La feuille Peda expose le tracé (pièce de preuve).
            const detail = await fetch(`${API}/api/emargement/seances/${body.seance.id}`, {
                headers: { Cookie: auth.cookieHeader },
            }).then((res) => res.json());
            const row = detail.seance.alternants.find((a: { id: string }) => a.id === alternant.id);
            expect(row.attendance.morning).toMatchObject({
                signatureMode: 'handwritten',
                signatureImage: signature,
            });

            // Une correction de statut qui reste une présence conserve le tracé…
            const late = await fetch(`${viewUrl}/attendance`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    alternantId: alternant.id,
                    half: 'morning',
                    status: 'late',
                    statusTime: '08:10',
                }),
            }).then((res) => res.json());
            expect(late.attendance).toMatchObject({ signatureMode: 'manual', signatureImage: signature });

            // …mais un passage à `absent` l'efface : il ne prouve plus la présence.
            const absent = await fetch(`${viewUrl}/attendance`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alternantId: alternant.id, half: 'morning', status: 'absent' }),
            }).then((res) => res.json());
            expect(absent.attendance).toMatchObject({ status: 'absent', signatureImage: null });

            const noSignature = await fetch(`${viewUrl}/attendance/sign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alternantId: alternant.id, half: 'morning' }),
            });
            expect(noSignature.status).toBe(400);
            expect((await noSignature.json()).code).toBe('signature');

            const noAfternoon = await fetch(`${viewUrl}/attendance/sign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alternantId: alternant.id, half: 'afternoon', signature }),
            });
            expect(noAfternoon.status).toBe(400);
            expect((await noAfternoon.json()).code).toBe('window');
        } finally {
            await getModels().Seance.deleteMany({ session_id: classId });
            await getModels().Emargement.deleteMany({});
            await cleanupSession(
                classId,
                degreeId,
                alternants.map((a) => a._id),
            );
        }
    });

    it('signe chaque demi-journée après la fermeture de son créneau et les verrouille séparément', async () => {
        const { classId, degreeId, alternants } = await seedSessionWithAlternants(1);
        // Matin fermé depuis 00:01, après-midi encore ouvert : la signature du
        // matin doit être possible, celle de l'après-midi refusée.
        const seance = await seedSeance({
            session_id: classId,
            morning_start: '00:00',
            morning_end: '00:01',
            afternoon_start: '00:02',
            afternoon_end: '23:59',
        });
        try {
            const token = buildSeanceToken(seance, 'formateur');
            const viewUrl = `${API}/api/emargement/formateur/${encodeURIComponent(token)}`;
            const signature = SIGNATURE_PNG;

            const beforeClose = await fetch(`${viewUrl}/sign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ half: 'afternoon', confirmed: true, signature }),
            });
            expect(beforeClose.status).toBe(409);
            expect((await beforeClose.json()).code).toBe('window');

            const signMorning = await fetch(`${viewUrl}/sign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ half: 'morning', confirmed: true, signature }),
            });
            expect(signMorning.status).toBe(200);
            expect(await signMorning.json()).toMatchObject({ half: 'morning', signedByName: 'Jean Formateur' });

            const after = await fetch(viewUrl).then((res) => res.json());
            expect(after.emargement.seance.validations.morning).toMatchObject({
                source: 'formateur',
                signatureImage: signature,
            });
            expect(after.emargement.seance.validations.afternoon).toBeNull();
            // L'après-midi reste éditable et signable plus tard.
            expect(after.emargement.seance.validationStatus).toBe('in_progress');
            expect(after.emargement.canEdit).toBe(true);
            expect(after.emargement.editableHalves).toEqual(['afternoon']);
            expect(after.emargement.signableHalves).toEqual([]);

            // Le matin signé est verrouillé, l'après-midi ne l'est pas.
            const lockedMorning = await fetch(`${viewUrl}/attendance`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alternantId: alternants[0]._id, half: 'morning', status: 'present' }),
            });
            expect(lockedMorning.status).toBe(409);
            expect((await lockedMorning.json()).code).toBe('signed');

            const afternoon = await fetch(`${viewUrl}/attendance`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alternantId: alternants[0]._id, half: 'afternoon', status: 'present' }),
            });
            expect(afternoon.status).toBe(200);

            // Rejouer la signature de la même demi-journée est refusé.
            const again = await fetch(`${viewUrl}/sign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ half: 'morning', confirmed: true, signature }),
            });
            expect(again.status).toBe(409);
            expect((await again.json()).code).toBe('signed');
        } finally {
            await getModels().Seance.deleteOne({ _id: seance._id });
            await getModels().Emargement.deleteMany({ seance_id: seance._id });
            await cleanupSession(
                classId,
                degreeId,
                alternants.map((a) => a._id),
            );
        }
    });

    it('refuse la signature d’une demi-journée avant la fermeture de son créneau', async () => {
        const { classId, degreeId, alternants } = await seedSessionWithAlternants(1);
        // Créneau ouvert sur toute la journée : la signature reste fermée.
        const seance = await seedSeance({ session_id: classId });
        try {
            const token = buildSeanceToken(seance, 'formateur');
            const response = await fetch(`${API}/api/emargement/formateur/${encodeURIComponent(token)}/sign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ half: 'morning', confirmed: true, signature: SIGNATURE_PNG }),
            });
            expect(response.status).toBe(409);
            expect((await response.json()).code).toBe('window');
        } finally {
            await getModels().Seance.deleteOne({ _id: seance._id });
            await cleanupSession(
                classId,
                degreeId,
                alternants.map((a) => a._id),
            );
        }
    });

    it('signale une anomalie quand le lien a expiré sans signature, et laisse le Peda valider', async () => {
        const auth = pedaAuth();
        const { classId, degreeId, alternants } = await seedSessionWithAlternants(1);
        const seance = await seedSeance({
            session_id: classId,
            morning_start: '00:00',
            morning_end: '00:01',
            invite_expires_at: new Date(Date.now() - 60_000),
        });
        try {
            // Le lien est expiré : le formateur ne peut plus signer (410)…
            const token = buildSeanceToken(seance, 'formateur');
            const formateurUrl = `${API}/api/emargement/formateur/${encodeURIComponent(token)}/sign`;
            const late = await fetch(formateurUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ half: 'morning', confirmed: true, signature: SIGNATURE_PNG }),
            });
            expect(late.status).toBe(410);
            expect((await late.json()).code).toBe('expired');

            // … et la liste la classe en anomalie.
            const anomalies = await fetch(`${API}/api/emargement/seances?validation=anomaly`, {
                headers: { Cookie: auth.cookieHeader },
            }).then((res) => res.json());
            expect(anomalies.seances.map((row: { id: string }) => row.id)).toContain(seance._id);

            // Le motif est obligatoire.
            const withoutNote = await fetch(`${API}/api/emargement/seances/${seance._id}/validate`, {
                method: 'POST',
                headers: staffHeaders(auth),
                body: JSON.stringify({}),
            });
            expect(withoutNote.status).toBe(400);
            expect((await withoutNote.json()).code).toBe('validation');

            const validated = await fetch(`${API}/api/emargement/seances/${seance._id}/validate`, {
                method: 'POST',
                headers: staffHeaders(auth),
                body: JSON.stringify({ note: 'Formateur injoignable, lien expiré.' }),
            });
            expect(validated.status).toBe(200);
            const detail = (await validated.json()).seance;
            expect(detail).toMatchObject({
                validationStatus: 'validated',
                validationSource: 'peda',
                validationNote: 'Formateur injoignable, lien expiré.',
            });
            expect(detail.validations.morning).toMatchObject({
                source: 'peda',
                signatureImage: null,
            });
            expect(detail.validations.morning.signedByName).toBeTruthy();

            // La validation de régularisation est journalisée avec son motif.
            expect(detail.history).toContainEqual(
                expect.objectContaining({
                    action: 'half_validated',
                    half: 'morning',
                    source: 'peda',
                    note: 'Formateur injoignable, lien expiré.',
                }),
            );

            // Une feuille validée ne se revalide pas, mais reste supprimable : le
            // Peda doit pouvoir retirer une feuille créée par erreur, même signée
            // (statuts, signatures et journal sont alors perdus avec elle).
            const again = await fetch(`${API}/api/emargement/seances/${seance._id}/validate`, {
                method: 'POST',
                headers: staffHeaders(auth),
                body: JSON.stringify({ note: 'Doublon' }),
            });
            expect(again.status).toBe(409);
            expect((await again.json()).code).toBe('signed');
            const removed = await fetch(`${API}/api/emargement/seances/${seance._id}`, {
                method: 'DELETE',
                headers: staffHeaders(auth),
            });
            expect(removed.status).toBe(200);
            expect(await removed.json()).toEqual({ deleted: true });
            expect(await getModels().Seance.findOne({ _id: seance._id })).toBeNull();
            expect(await getModels().EmargementHistory.countDocuments({ seance_id: seance._id })).toBe(0);
        } finally {
            await getModels().Seance.deleteOne({ _id: seance._id });
            await cleanupSession(
                classId,
                degreeId,
                alternants.map((a) => a._id),
            );
        }
    });

    it('refuse un jeton inconnu et un lien expiré', async () => {
        const invalid = await fetch(`${API}/api/emargement/formateur/${encodeURIComponent('inconnu.abc:reunion')}`);
        expect(invalid.status).toBe(404);

        const seance = await seedSeance({ invite_expires_at: new Date(Date.now() - 60_000) });
        const token = buildSeanceToken(seance, 'formateur');
        const expired = await fetch(`${API}/api/emargement/formateur/${encodeURIComponent(token)}/attendance`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ alternantId: 'x', half: 'morning', status: 'present' }),
        });
        expect(expired.status).toBe(410);
        await getModels().Seance.deleteOne({ _id: seance._id });
    });
});

describe('API émargement — signature alternant par QR', () => {
    it('enregistre la présence pendant la fenêtre et reste idempotent', async () => {
        const { classId, degreeId, alternants } = await seedSessionWithAlternants(1);
        const seance = await seedSeance({ session_id: classId, session_nom: 'Promo QR' });
        try {
            const token = buildSeanceToken(seance, 'qr');
            const url = `${API}/api/emargement/sign/${encodeURIComponent(token)}`;
            const page = await fetch(url).then((res) => res.json());
            expect(page.seance).toMatchObject({ sessionNom: 'Promo QR', signed: false, expired: false });

            const email = alternants[0].email;
            const first = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            expect(first.status).toBe(400);
            expect((await first.json()).code).toBe('signature');

            const signed = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, signature: SIGNATURE_PNG }),
            });
            expect(signed.status).toBe(200);
            const firstBody = await signed.json();
            expect(firstBody.result).toMatchObject({ alreadySigned: false, half: 'morning' });

            const second = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, signature: SIGNATURE_PNG }),
            });
            expect(second.status).toBe(200);
            expect((await second.json()).result.alreadySigned).toBe(true);

            const record = await getModels()
                .Emargement.findOne({
                    seance_id: seance._id,
                    alternant_id: alternants[0]._id,
                    half: 'morning',
                })
                .lean();
            // Le tracé est conservé : il vaut preuve de présence et alimentera les exports PDF.
            expect(record).toMatchObject({
                status: 'present',
                signature_mode: 'qr',
                signature_image: SIGNATURE_PNG,
            });
            expect(record?.ip).toBeTruthy();
        } finally {
            await getModels().Seance.deleteOne({ _id: seance._id });
            await getModels().Emargement.deleteMany({ seance_id: seance._id });
            await cleanupSession(
                classId,
                degreeId,
                alternants.map((a) => a._id),
            );
        }
    });

    it('remplace une signature manuscrite du formateur par le tracé du QR', async () => {
        const { classId, degreeId, alternants } = await seedSessionWithAlternants(1);
        const seance = await seedSeance({ session_id: classId });
        try {
            // Repli d'abord : le formateur a fait signer l'alternant sur son appareil.
            const formateurUrl = `${API}/api/emargement/formateur/${encodeURIComponent(buildSeanceToken(seance, 'formateur'))}`;
            const handwritten = await fetch(`${formateurUrl}/attendance/sign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    alternantId: alternants[0]._id,
                    half: 'morning',
                    signature: FORMATEUR_SIGNATURE_PNG,
                }),
            });
            expect(handwritten.status).toBe(200);

            // Puis l'alternant signe lui-même : son tracé remplace celui du formateur.
            const url = `${API}/api/emargement/sign/${encodeURIComponent(buildSeanceToken(seance, 'qr'))}`;
            const signed = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: alternants[0].email, signature: SIGNATURE_PNG }),
            });
            expect(signed.status).toBe(200);
            expect((await signed.json()).result).toMatchObject({ alreadySigned: false, half: 'morning' });

            const record = await getModels()
                .Emargement.findOne({ seance_id: seance._id, alternant_id: alternants[0]._id, half: 'morning' })
                .lean();
            expect(record).toMatchObject({ signature_mode: 'qr', signature_image: SIGNATURE_PNG });
        } finally {
            await getModels().Seance.deleteOne({ _id: seance._id });
            await getModels().Emargement.deleteMany({ seance_id: seance._id });
            await cleanupSession(
                classId,
                degreeId,
                alternants.map((a) => a._id),
            );
        }
    });

    it('refuse un e-mail inconnu et une signature hors fenêtre', async () => {
        const { classId, degreeId, alternants } = await seedSessionWithAlternants(1);
        const tz = tenantTimezone();
        const yesterday = localDate(new Date(Date.now() - 24 * 60 * 60 * 1000), tz);
        const open = await seedSeance({ session_id: classId });
        const closed = await seedSeance({
            session_id: classId,
            date: yesterday,
            invite_expires_at: endOfLocalDay(localDate(new Date(), tz), tz),
        });
        try {
            const openUrl = `${API}/api/emargement/sign/${encodeURIComponent(buildSeanceToken(open, 'qr'))}`;
            const unknown = await fetch(openUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'inconnu@test.local', signature: SIGNATURE_PNG }),
            });
            expect(unknown.status).toBe(404);
            expect((await unknown.json()).code).toBe('alternant');

            // Hors fenêtre, le refus de fenêtre prime : il ne révèle pas si
            // l'adresse existe dans la session.
            const url = `${API}/api/emargement/sign/${encodeURIComponent(buildSeanceToken(closed, 'qr'))}`;
            const late = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: alternants[0].email, signature: SIGNATURE_PNG }),
            });
            expect(late.status).toBe(409);
            expect((await late.json()).code).toBe('window');
        } finally {
            await getModels().Seance.deleteMany({ _id: { $in: [open._id, closed._id] } });
            await getModels().Emargement.deleteMany({ seance_id: { $in: [open._id, closed._id] } });
            await cleanupSession(
                classId,
                degreeId,
                alternants.map((a) => a._id),
            );
        }
    });
});

describe('API émargement — assiduité et archivage (lot 7)', () => {
    /** Assiduité attendue d'une séance d'une minute : 1 minute prévue par demi-journée. */
    async function mark(
        seance: Parameters<typeof buildSeanceToken>[0],
        alternantId: string,
        status: string,
        half = 'morning',
    ): Promise<void> {
        const viewUrl = `${API}/api/emargement/formateur/${encodeURIComponent(buildSeanceToken(seance, 'formateur'))}`;
        const response = await fetch(`${viewUrl}/attendance`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ alternantId, half, status }),
        });
        expect(response.status).toBe(200);
    }

    async function cleanupLot7(classId: string, degreeId: string, alternantIds: string[]): Promise<void> {
        await getModels().Rupture.deleteMany({ alternant_id: { $in: alternantIds } });
        await getModels().Emargement.deleteMany({});
        await getModels().Seance.deleteMany({ session_id: classId });
        await cleanupSession(classId, degreeId, alternantIds);
    }

    it('agrège l’assiduité par alternant, par session et par site sur une période', async () => {
        const auth = pedaAuth();
        const { classId, degreeId, alternants } = await seedSessionWithAlternants(2);
        const seance = await seedSeance({
            session_id: classId,
            session_nom: 'Promo assiduité',
            morning_start: '00:00',
            morning_end: '00:01',
            afternoon_start: null,
            afternoon_end: null,
        });
        try {
            await mark(seance, alternants[0]._id, 'present');
            await mark(seance, alternants[1]._id, 'absent');

            const response = await fetch(
                `${API}/api/emargement/assiduite?from=${seance.date}&to=${seance.date}&site=Nord`,
                { headers: { Cookie: auth.cookieHeader } },
            );
            expect(response.status).toBe(200);
            const { assiduite } = await response.json();
            expect(assiduite).toMatchObject({ site: 'Nord', from: seance.date, to: seance.date });
            expect(assiduite.totals).toMatchObject({
                alternants: 2,
                seances: 1,
                halves: 2,
                absences: 1,
                // Créneau de 1 minute, une demi-journée par alternant.
                plannedMinutes: 2,
                attendedMinutes: 1,
            });
            expect(assiduite.totals.rate).toBeCloseTo(0.5, 5);

            // Lignes triées par nom : Nom0 (présent) puis Nom1 (absent).
            const [present, absent] = assiduite.alternants;
            expect(present).toMatchObject({
                alternantId: alternants[0]._id,
                label: `Nom0 Prénom0`,
                sessions: 1,
                plannedMinutes: 1,
                attendedMinutes: 1,
                presence: { archived: false, archiveDate: null },
            });
            expect(present.rate).toBe(1);
            expect(absent).toMatchObject({
                alternantId: alternants[1]._id,
                plannedMinutes: 1,
                attendedMinutes: 0,
                absences: 1,
                lastSeanceDate: seance.date,
            });
            expect(absent.rate).toBe(0);

            expect(assiduite.sessions).toHaveLength(1);
            expect(assiduite.sessions[0]).toMatchObject({ key: classId, label: 'Promo assiduité', alternants: 2 });
            expect(assiduite.sites).toEqual([expect.objectContaining({ key: 'Nord', label: 'Nord', alternants: 2 })]);

            // Fiche d'un alternant : même total, détail séance par séance.
            const fiche = await fetch(
                `${API}/api/emargement/assiduite/${alternants[1]._id}?from=${seance.date}&to=${seance.date}`,
                { headers: { Cookie: auth.cookieHeader } },
            );
            expect(fiche.status).toBe(200);
            const detail = (await fiche.json()).assiduite;
            expect(detail).toMatchObject({
                alternantId: alternants[1]._id,
                sessionNom: 'Promo assiduité',
                presence: { archived: false },
                totals: { halves: 1, absences: 1, plannedMinutes: 1, attendedMinutes: 0 },
            });
            expect(detail.totals.rate).toBe(0);
            expect(detail.seances).toHaveLength(1);
            expect(detail.seances[0].halves).toEqual([
                expect.objectContaining({ half: 'morning', status: 'absent', attendedMinutes: 0, missing: false }),
            ]);

            const unknown = await fetch(`${API}/api/emargement/assiduite/inconnu`, {
                headers: { Cookie: auth.cookieHeader },
            });
            expect(unknown.status).toBe(404);
        } finally {
            await cleanupLot7(
                classId,
                degreeId,
                alternants.map((a) => a._id),
            );
        }
    });

    it('liste les feuilles incomplètes et compte les statuts manquants sur les créneaux fermés', async () => {
        const auth = pedaAuth();
        const { classId, degreeId, alternants } = await seedSessionWithAlternants(2);
        const seance = await seedSeance({
            session_id: classId,
            morning_start: '00:00',
            morning_end: '00:01',
            afternoon_start: null,
            afternoon_end: null,
        });
        try {
            const incomplete = await fetch(`${API}/api/emargement/seances?sessionId=${classId}&missing=1`, {
                headers: { Cookie: auth.cookieHeader },
            });
            const { seances } = await incomplete.json();
            expect(seances).toHaveLength(1);
            expect(seances[0]).toMatchObject({
                id: seance._id,
                attendanceProgress: {
                    expected: 2,
                    morning: { expected: 2, recorded: 0 },
                    afternoon: { expected: 2, recorded: 0 },
                    missing: 2,
                    missingHalves: ['morning'],
                },
            });

            // Un statut saisi sur deux : la feuille reste incomplète pour l'autre.
            await mark(seance, alternants[0]._id, 'present');
            const detail = await fetch(`${API}/api/emargement/seances/${seance._id}`, {
                headers: { Cookie: auth.cookieHeader },
            }).then((res) => res.json());
            expect(detail.seance.attendanceProgress.morning).toEqual({ expected: 2, recorded: 1 });
            expect(detail.seance.attendanceProgress.missing).toBe(1);

            // Feuille complète : plus dans la liste des incomplètes.
            await mark(seance, alternants[1]._id, 'present');
            const done = await fetch(`${API}/api/emargement/seances?sessionId=${classId}&missing=1`, {
                headers: { Cookie: auth.cookieHeader },
            }).then((res) => res.json());
            expect(done.seances).toHaveLength(0);
        } finally {
            await cleanupLot7(
                classId,
                degreeId,
                alternants.map((a) => a._id),
            );
        }
    });

    it('sort les archivés de la feuille, distingue la rupture qui poursuit et les inclut sur demande', async () => {
        const auth = pedaAuth();
        const { classId, degreeId, alternants } = await seedSessionWithAlternants(3);
        const tz = tenantTimezone();
        const today = localDate(new Date(), tz);
        const yesterday = addDaysToDate(today, -1);
        const ruptureAt = new Date(`${yesterday}T12:00:00Z`);
        const seance = await seedSeance({ session_id: classId, session_nom: 'Promo archivage' });
        try {
            // Nom1 : rupture qui sort de la formation (archivé la veille).
            await getModels().Alternant.updateOne(
                { _id: alternants[1]._id },
                { $set: { archived_at: ruptureAt, archive_reason: 'rupture' } },
            );
            await getModels().Rupture.create({
                _id: randomUUID(),
                alternant_id: alternants[1]._id,
                date_rupture: ruptureAt,
                entreprise: null,
                motif: RUPTURE_MOTIFS[0],
                detail: null,
                poursuit_formation: false,
                created_at: new Date(),
                updated_at: new Date(),
            });
            // Nom2 : rupture qui n'archive pas — il reste attendu en formation.
            await getModels().Rupture.create({
                _id: randomUUID(),
                alternant_id: alternants[2]._id,
                date_rupture: ruptureAt,
                entreprise: null,
                motif: RUPTURE_MOTIFS[0],
                detail: null,
                poursuit_formation: true,
                created_at: new Date(),
                updated_at: new Date(),
            });

            const detail = await fetch(`${API}/api/emargement/seances/${seance._id}`, {
                headers: { Cookie: auth.cookieHeader },
            }).then((res) => res.json());
            // Le sorti de la veille n'est plus attendu ; le rupturé qui poursuit l'est.
            expect(detail.seance.alternants.map((a: { id: string }) => a.id)).toEqual([
                alternants[0]._id,
                alternants[2]._id,
            ]);
            expect(detail.seance.attendanceProgress.expected).toBe(2);
            expect(detail.seance.alternants[0].presence).toMatchObject({
                archived: false,
                archiveDate: null,
                ruptureDate: null,
            });
            expect(detail.seance.alternants[1].presence).toMatchObject({
                archived: false,
                ruptureDate: yesterday,
                poursuitFormation: true,
            });

            const filters = `seanceId=${seance._id}`;
            const current = await fetch(`${API}/api/emargement/exports/attendance?${filters}`, {
                headers: { Cookie: auth.cookieHeader },
            }).then(async (res) => Buffer.from(await res.arrayBuffer()).toString('utf8'));
            expect(current).toContain('Rupture — poursuit la formation');
            expect(current).not.toContain(`${alternants[1].first_name} ${alternants[1].last_name}`);

            // Export historique : l'archivé revient, avec sa situation datée.
            const archivedCsv = await fetch(`${API}/api/emargement/exports/attendance?${filters}&includeArchived=1`, {
                headers: { Cookie: auth.cookieHeader },
            }).then(async (res) => Buffer.from(await res.arrayBuffer()).toString('utf8'));
            expect(archivedCsv).toContain(`${alternants[1].first_name} ${alternants[1].last_name}`);
            expect(archivedCsv).toContain('Archivé — rupture');
            const archiveDate = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC' }).format(ruptureAt);
            expect(archivedCsv).toContain(archiveDate);

            // Le tableau de bord suit la même règle par défaut.
            const dashboard = await fetch(`${API}/api/emargement/assiduite?from=${seance.date}&to=${seance.date}`, {
                headers: { Cookie: auth.cookieHeader },
            }).then((res) => res.json());
            expect(dashboard.assiduite.alternants.map((row: { alternantId: string }) => row.alternantId)).toEqual([
                alternants[0]._id,
                alternants[2]._id,
            ]);
        } finally {
            await cleanupLot7(
                classId,
                degreeId,
                alternants.map((a) => a._id),
            );
        }
    });

    it('compte une demi-journée non renseignée sans la confondre avec une absence', async () => {
        const { classId, degreeId, alternants } = await seedSessionWithAlternants(1);
        const seance = await seedSeance({
            session_id: classId,
            morning_start: '00:00',
            morning_end: '00:01',
            afternoon_start: null,
            afternoon_end: null,
        });
        try {
            const view = await fetch(
                `${API}/api/emargement/formateur/${encodeURIComponent(buildSeanceToken(seance, 'formateur'))}`,
            ).then((res) => res.json());
            const alternant = view.emargement.alternants[0];

            // Aucun statut saisi : la feuille est incomplète, pas « absente ».
            const detail = await fetch(`${API}/api/emargement/seances/${seance._id}`, {
                headers: { Cookie: pedaAuth().cookieHeader },
            }).then((res) => res.json());
            expect(detail.seance.alternants[0].attendance.morning).toBeNull();
            expect(detail.seance.attendanceProgress).toMatchObject({ missing: 1, missingHalves: ['morning'] });

            const attestation = await fetch(
                `${API}/api/emargement/attestations/${alternants[0]._id}?from=${seance.date}&to=${seance.date}`,
                { headers: { Cookie: pedaAuth().cookieHeader } },
            );
            expect(attestation.status).toBe(200);

            const assiduite = await fetch(`${API}/api/emargement/assiduite/${alternants[0]._id}`, {
                headers: { Cookie: pedaAuth().cookieHeader },
            }).then((res) => res.json());
            expect(assiduite.assiduite.totals).toMatchObject({
                halves: 0,
                absences: 0,
                missingHalves: 1,
                plannedMinutes: 1,
                attendedMinutes: 0,
            });
            expect(alternant.id).toBe(alternants[0]._id);
        } finally {
            await cleanupLot7(
                classId,
                degreeId,
                alternants.map((a) => a._id),
            );
        }
    });
});

describe('API émargement — exports (§8)', () => {
    it('exporte la feuille en PDF, les présences en CSV/Excel, le journal et une attestation', async () => {
        const auth = pedaAuth();
        const { classId, degreeId, alternants } = await seedSessionWithAlternants(1);
        const tz = tenantTimezone();
        const seance = await seedSeance({
            session_id: classId,
            session_nom: 'Promo export',
            degree_title: 'Développeur web',
            module: 'Séquence 1 — Export',
            morning_start: '00:00',
            morning_end: '00:01',
            afternoon_start: null,
            afternoon_end: null,
            invite_expires_at: endOfLocalDay(addDaysToDate(localDate(new Date(), tz), 7), tz),
        });
        try {
            const viewUrl = `${API}/api/emargement/formateur/${encodeURIComponent(buildSeanceToken(seance, 'formateur'))}`;
            const alternantId = alternants[0]._id;
            const attendance = await fetch(`${viewUrl}/attendance`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alternantId, half: 'morning', status: 'present' }),
            });
            expect(attendance.status).toBe(200);
            const signed = await fetch(`${viewUrl}/attendance/sign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alternantId, half: 'morning', signature: SIGNATURE_PNG }),
            });
            expect(signed.status).toBe(200);

            // Feuille de séance : vrai PDF, signature de l'alternant incluse.
            const pdfRes = await fetch(`${API}/api/emargement/seances/${seance._id}/pdf?theme=region`, {
                headers: { Cookie: auth.cookieHeader },
            });
            expect(pdfRes.status).toBe(200);
            expect(pdfRes.headers.get('content-type')).toContain('application/pdf');
            const pdf = Buffer.from(await pdfRes.arrayBuffer());
            expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
            expect(pdf.length).toBeGreaterThan(1_000);

            // Présences : CSV français (BOM + `;`), une ligne par alternant × demi-journée.
            const csvRes = await fetch(`${API}/api/emargement/exports/attendance?seanceId=${seance._id}`, {
                headers: { Cookie: auth.cookieHeader },
            });
            expect(csvRes.status).toBe(200);
            expect(csvRes.headers.get('content-type')).toContain('text/csv');
            const csvBytes = Buffer.from(await csvRes.arrayBuffer());
            // BOM UTF-8 : Excel français reconnaît l'encodage sans assistant d'import.
            expect(csvBytes.subarray(0, 3).toString('hex')).toBe('efbbbf');
            const csv = csvBytes.toString('utf8');
            expect(csv).toContain('Demi-journée');
            expect(csv).toContain(`${alternants[0].first_name} ${alternants[0].last_name}`);
            expect(csv).toContain('Présent');
            // Créneau de 1 minute → 0,02 h prévue comme réalisée.
            expect(csv).toContain('0,02');
            expect(csv).toContain('Synthèse par alternant');

            // Excel : classeur zippé, deux feuilles.
            const xlsxRes = await fetch(`${API}/api/emargement/exports/attendance?seanceId=${seance._id}&format=xlsx`, {
                headers: { Cookie: auth.cookieHeader },
            });
            expect(xlsxRes.status).toBe(200);
            expect(xlsxRes.headers.get('content-type')).toContain('spreadsheetml');
            const xlsx = Buffer.from(await xlsxRes.arrayBuffer());
            expect(xlsx.subarray(0, 2).toString()).toBe('PK');

            // Journal d'audit : la saisie et la signature du lot 5 y figurent.
            const historyRes = await fetch(`${API}/api/emargement/exports/history?seanceId=${seance._id}`, {
                headers: { Cookie: auth.cookieHeader },
            });
            expect(historyRes.status).toBe(200);
            const history = await historyRes.text();
            expect(history).toContain('Statut modifié');
            expect(history).toContain('Signature tracée');
            expect(history).toContain('Jean Formateur');

            // Attestation d'assiduité : PDF sur la période de la séance.
            const attestationRes = await fetch(
                `${API}/api/emargement/attestations/${alternants[0]._id}?from=${seance.date}&to=${seance.date}`,
                { headers: { Cookie: auth.cookieHeader } },
            );
            expect(attestationRes.status).toBe(200);
            expect(attestationRes.headers.get('content-type')).toContain('application/pdf');
            const attestation = Buffer.from(await attestationRes.arrayBuffer());
            expect(attestation.subarray(0, 4).toString()).toBe('%PDF');

            // Récapitulatif du groupe : PDF de la session entière (export « par groupe »).
            const groupRes = await fetch(
                `${API}/api/emargement/sessions/${classId}/attendance.pdf?from=${seance.date}&to=${seance.date}&theme=fse`,
                { headers: { Cookie: auth.cookieHeader } },
            );
            expect(groupRes.status).toBe(200);
            expect(groupRes.headers.get('content-type')).toContain('application/pdf');
            const group = Buffer.from(await groupRes.arrayBuffer());
            expect(group.subarray(0, 4).toString()).toBe('%PDF');
        } finally {
            await getModels().EmargementHistory.deleteMany({ seance_id: seance._id });
            await getModels().Emargement.deleteMany({ seance_id: seance._id });
            await getModels().Seance.deleteOne({ _id: seance._id });
            await cleanupSession(
                classId,
                degreeId,
                alternants.map((a) => a._id),
            );
        }
    });

    it('refuse les exports sans authentification et les séances inconnues', async () => {
        const anonymous = await fetch(`${API}/api/emargement/exports/attendance`);
        expect(anonymous.status).toBe(401);

        const auth = pedaAuth();
        const missing = await fetch(`${API}/api/emargement/seances/inconnue/pdf`, {
            headers: { Cookie: auth.cookieHeader },
        });
        expect(missing.status).toBe(404);
    });
});

describe('API émargement — heures de cours (lot 8)', () => {
    it('calcule les heures sur les horaires de cours, pause déjeuner exclue', async () => {
        const auth = pedaAuth();
        const { classId, degreeId, alternants } = await seedSessionWithAlternants(3);
        try {
            // Journée 09:00–12:30 puis 13:30–17:00 : 12:30 → 13:30 ne compte pas.
            const { status, body } = await createSeanceHttp(
                auth,
                seanceInput(classId, {
                    morningClassStart: '09:00',
                    morningClassEnd: '12:30',
                    afternoonClassStart: '13:30',
                    afternoonClassEnd: '17:00',
                    morningStart: '09:00',
                    morningEnd: '09:15',
                    afternoonStart: '13:30',
                    afternoonEnd: '13:45',
                }),
            );
            expect(status).toBe(201);
            // Les horaires globaux de la séance sont dérivés des horaires de cours.
            expect(body.seance).toMatchObject({
                startTime: '09:00',
                endTime: '17:00',
                morningClassStart: '09:00',
                morningClassEnd: '12:30',
                afternoonClassStart: '13:30',
                afternoonClassEnd: '17:00',
            });

            const url = `${API}/api/emargement/formateur/${encodeURIComponent(tokenFromUrl(body.seance.formateurUrl))}`;
            const markAttendance = async (
                alternantId: string,
                half: string,
                attendanceStatus: string,
                statusTime?: string,
            ) => {
                const response = await fetch(`${url}/attendance`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        alternantId,
                        half,
                        status: attendanceStatus,
                        ...(statusTime ? { statusTime } : {}),
                    }),
                });
                expect(response.status).toBe(200);
            };

            // Journée complète : 3h30 + 3h30 = 7h (et non 8h comme le voudraient
            // les horaires globaux 09:00–17:00).
            await markAttendance(alternants[0]._id, 'morning', 'present');
            await markAttendance(alternants[0]._id, 'afternoon', 'present');
            // En retard l'après-midi (arrivée 14:30) : 2h30 au lieu de 3h30.
            await markAttendance(alternants[1]._id, 'afternoon', 'late', '14:30');
            // Parti en avance le matin (départ 10:30) : 1h30 au lieu de 3h30.
            await markAttendance(alternants[2]._id, 'morning', 'left_early', '10:30');

            const filters = `from=${body.seance.date}&to=${body.seance.date}&sessionId=${classId}`;
            const dashboard = await fetch(`${API}/api/emargement/assiduite?${filters}`, {
                headers: { Cookie: auth.cookieHeader },
            }).then((res) => res.json());
            expect(dashboard.assiduite.totals).toMatchObject({
                alternants: 3,
                seances: 1,
                halves: 4,
                // 3 alternants × (3h30 + 3h30).
                plannedMinutes: 3 * 420,
                // 420 + 150 (retard) + 90 (départ anticipé).
                attendedMinutes: 660,
            });

            const [full, late, early] = dashboard.assiduite.alternants;
            expect(full).toMatchObject({ plannedMinutes: 420, attendedMinutes: 420 });
            expect(late).toMatchObject({ plannedMinutes: 420, attendedMinutes: 150 });
            expect(early).toMatchObject({ plannedMinutes: 420, attendedMinutes: 90 });

            // Le détail par demi-journée expose les mêmes heures.
            const detail = await fetch(`${API}/api/emargement/assiduite/${alternants[1]._id}?${filters}`, {
                headers: { Cookie: auth.cookieHeader },
            }).then((res) => res.json());
            expect(detail.assiduite.seances[0].halves).toEqual([
                expect.objectContaining({ half: 'morning', status: 'na', plannedMinutes: 210, attendedMinutes: 0 }),
                expect.objectContaining({
                    half: 'afternoon',
                    status: 'late',
                    statusTime: '14:30',
                    plannedMinutes: 210,
                    attendedMinutes: 150,
                }),
            ]);
        } finally {
            await getModels().Emargement.deleteMany({});
            await getModels().Seance.deleteMany({ session_id: classId });
            await cleanupSession(
                classId,
                degreeId,
                alternants.map((a) => a._id),
            );
        }
    });

    it('exige les horaires de cours de l’après-midi avec un créneau l’après-midi', async () => {
        const auth = pedaAuth();
        const { classId, degreeId, alternants } = await seedSessionWithAlternants(1);
        try {
            const { status, body } = await createSeanceHttp(
                auth,
                seanceInput(classId, { afternoonClassStart: null, afternoonClassEnd: null }),
            );
            expect(status).toBe(400);
            expect(body).toMatchObject({ code: 'validation' });

            // L'inverse est refusé aussi : des cours l'après-midi sans créneau ne
            // produiraient jamais d'heures.
            const withoutWindow = await createSeanceHttp(
                auth,
                seanceInput(classId, { afternoonStart: null, afternoonEnd: null }),
            );
            expect(withoutWindow.status).toBe(400);
            expect(withoutWindow.body).toMatchObject({ code: 'validation' });
        } finally {
            await cleanupSession(
                classId,
                degreeId,
                alternants.map((a) => a._id),
            );
        }
    });
});

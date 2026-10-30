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
        startTime: '08:00',
        endTime: '17:00',
        site: 'Nord',
        mode: 'salle',
        formateurName: 'Jean Formateur',
        formateurEmail: 'formateur@test.local',
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

afterEach(() => {
    vi.restoreAllMocks();
});

describe('API émargement — côté Peda', () => {
    it('crée une séance, envoie l’invitation et renvoie les liens formateur/QR', async () => {
        const { sendEmail } = spyOnGoogleMail();
        await seedSystemMailUser();
        const auth = pedaAuth();
        const { classId, degreeId, alternants } = await seedSessionWithAlternants();
        try {
            const { status, body } = await createSeanceHttp(
                auth,
                seanceInput(classId, { module: 'Séquence 3 — Communication', location: 'Salle 204' }),
            );
            expect(status).toBe(201);
            expect(body.seance).toMatchObject({
                sessionId: classId,
                site: 'Nord',
                mode: 'salle',
                signed: false,
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

    it('refuse un créneau de signature hors des horaires de la séance', async () => {
        // Sans cette borne, la fermeture du créneau ne protège plus rien : la
        // signature restait ouverte avant le début du cours et après sa fin.
        const auth = pedaAuth();
        const { classId, degreeId, alternants } = await seedSessionWithAlternants(1);
        try {
            const earlyOpen = await createSeanceHttp(auth, seanceInput(classId, { morningStart: '07:00' }));
            expect(earlyOpen.status).toBe(400);
            expect(earlyOpen.body).toMatchObject({ code: 'validation' });

            const lateClose = await createSeanceHttp(auth, seanceInput(classId, { morningEnd: '18:00' }));
            expect(lateClose.status).toBe(400);

            const afternoonEarly = await createSeanceHttp(auth, seanceInput(classId, { afternoonStart: '07:30' }));
            expect(afternoonEarly.status).toBe(400);

            const afternoonLate = await createSeanceHttp(auth, seanceInput(classId, { afternoonEnd: '18:30' }));
            expect(afternoonLate.status).toBe(400);

            // Les bornes elles-mêmes restent acceptées.
            const ok = await createSeanceHttp(
                auth,
                seanceInput(classId, {
                    morningStart: '08:00',
                    morningEnd: '17:00',
                    afternoonStart: null,
                    afternoonEnd: null,
                }),
            );
            expect(ok.status).toBe(201);
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
                seanceInput(classId, { afternoonStart: null, afternoonEnd: null }),
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

    it('signe la feuille avec la signature manuscrite puis la verrouille', async () => {
        const auth = pedaAuth();
        const { classId, degreeId, alternants } = await seedSessionWithAlternants(1);
        try {
            const { body } = await createSeanceHttp(auth, seanceInput(classId));
            const token = tokenFromUrl(body.seance.formateurUrl);
            const viewUrl = `${API}/api/emargement/formateur/${encodeURIComponent(token)}`;
            const view = await fetch(viewUrl).then((res) => res.json());
            const alternant = view.emargement.alternants[0];

            const signature = SIGNATURE_PNG;
            const signResponse = await fetch(`${viewUrl}/sign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirmed: true, signature }),
            });
            expect(signResponse.status).toBe(200);
            const signed = await signResponse.json();
            expect(signed.signedByName).toBe('Jean Formateur');

            const after = await fetch(viewUrl).then((res) => res.json());
            expect(after.emargement.seance.signed).toBe(true);
            expect(after.emargement.seance.signatureImage).toBe(signature);
            expect(after.emargement.canEdit).toBe(false);

            const locked = await fetch(`${viewUrl}/attendance`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alternantId: alternant.id, half: 'morning', status: 'present' }),
            });
            expect(locked.status).toBe(409);
            expect((await locked.json()).code).toBe('signed');
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

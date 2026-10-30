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
import { endOfLocalDay, localDate } from '../../../utils/zonedTime';

const API = `http://localhost:${env.API_PORT}`;

// L'app Express est démarrée par `test/setup.ts` avant ce fichier : un `vi.mock`
// d'`external/google/system-mail` arriverait trop tard (cf. HOWTOTEST §9). On
// espionne donc le service Gmail et on sème l'utilisateur système pour que
// `sendSystemEmail` aille jusqu'à l'envoi.
const SYSTEM_EMAIL = 'dev@disciplina.re';

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
        morningStart: '07:45',
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
            const { status, body } = await createSeanceHttp(auth, seanceInput(classId));
            expect(status).toBe(201);
            expect(body.seance).toMatchObject({
                sessionId: classId,
                site: 'Nord',
                mode: 'salle',
                signed: false,
                formateurName: 'Jean Formateur',
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
            expect(view.emargement.alternants).toHaveLength(alternants.length);
            expect(view.emargement.alternants[0]).not.toHaveProperty('email');
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

    it('signe la feuille avec la signature manuscrite puis la verrouille', async () => {
        const auth = pedaAuth();
        const { classId, degreeId, alternants } = await seedSessionWithAlternants(1);
        try {
            const { body } = await createSeanceHttp(auth, seanceInput(classId));
            const token = tokenFromUrl(body.seance.formateurUrl);
            const viewUrl = `${API}/api/emargement/formateur/${encodeURIComponent(token)}`;
            const view = await fetch(viewUrl).then((res) => res.json());
            const alternant = view.emargement.alternants[0];

            const signature =
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
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
            expect(first.status).toBe(200);
            const firstBody = await first.json();
            expect(firstBody.result).toMatchObject({ alreadySigned: false, half: 'morning' });

            const second = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
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
            expect(record).toMatchObject({ status: 'present', signature_mode: 'qr' });
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
                body: JSON.stringify({ email: 'inconnu@test.local' }),
            });
            expect(unknown.status).toBe(404);
            expect((await unknown.json()).code).toBe('alternant');

            // Hors fenêtre, le refus de fenêtre prime : il ne révèle pas si
            // l'adresse existe dans la session.
            const url = `${API}/api/emargement/sign/${encodeURIComponent(buildSeanceToken(closed, 'qr'))}`;
            const late = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: alternants[0].email }),
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

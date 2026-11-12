import { randomUUID } from 'crypto';
import { describe, expect, it } from 'vitest';
import { env } from '../../../config/env';
import { tenantTimezone } from '../../../config/tenant';
import { getModels } from '../../../db/mongo/tenant';
import { generateSignature } from '../../../external/crypto';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { addDaysToDate, endOfLocalDay, localDate } from '../../../utils/zonedTime';

const API = `http://localhost:${env.API_PORT}`;
const STRONG_PASSWORD = 'Formateur2026!a';

function pedaAuth() {
    return mintAuthCookies({ id: 1, email: 'peda@test.local', role: 'PEDA', permission: 'EMPLOYEE' });
}

function headers(auth: ReturnType<typeof pedaAuth>, json = false): Record<string, string> {
    return {
        ...(json ? { 'Content-Type': 'application/json' } : {}),
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
        headers: headers(auth, body !== undefined),
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
}

async function get(path: string, auth: ReturnType<typeof pedaAuth>): Promise<Response> {
    return fetch(`${API}${path}`, { headers: headers(auth) });
}

/** Fiche minimale : l'e-mail doit être unique sur la collection. */
async function createFormateur(overrides: Record<string, unknown> = {}) {
    const suffix = randomUUID().slice(0, 8);
    const { status, body } = await call('POST', '/', {
        name: 'Marie Formatrice',
        email: `marie.${suffix}@test.local`,
        ...overrides,
    });
    expect(status).toBe(201);
    return body.formateur as {
        id: string;
        name: string;
        email: string;
        account: { userId: number | null };
        history: { action: string }[];
    };
}

/** Compte de connexion de la fiche, créé par l'API (jamais inséré à la main). */
async function withAccount(overrides: Record<string, unknown> = {}) {
    const formateur = await createFormateur(overrides);
    const { status, body } = await call('POST', `/${formateur.id}/account`, { password: STRONG_PASSWORD });
    expect(status).toBe(201);
    return body.formateur as typeof formateur & { account: { userId: number } };
}

function formateurAuth(userId: number) {
    return mintAuthCookies({
        id: userId,
        email: 'formateur@test.local',
        role: 'FORMATEUR',
        permission: 'EMPLOYEE',
    });
}

async function login(email: string, passwordPlain: string) {
    const response = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, passwordPlain }),
    });
    return { status: response.status, body: await response.json() };
}

async function seedSeance(formateurId: string, email: string, date: string): Promise<void> {
    await getModels().Seance.create({
        _id: randomUUID(),
        session_id: `form-app-${randomUUID()}`,
        session_nom: 'Promo espace formateur',
        date,
        start_time: '09:00',
        end_time: '12:00',
        site: 'Nord',
        mode: 'salle',
        formateur_id: formateurId,
        formateur_name: 'Marie Formatrice',
        formateur_email: email,
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

describe('comptes formateurs — gestion depuis la fiche du Peda', () => {
    it('crée le compte, le rattache à la fiche et autorise la connexion', async () => {
        const formateur = await createFormateur();
        expect(formateur.account.userId).toBeNull();

        const created = await call('POST', `/${formateur.id}/account`, { password: STRONG_PASSWORD });
        expect(created.status).toBe(201);
        expect(created.body.formateur.account.userId).toBeGreaterThan(0);
        expect(created.body.formateur.history.some((e: { action: string }) => e.action === 'account_created')).toBe(
            true,
        );

        // Le compte est un compte formateur ordinaire : mot de passe, rôle, permission.
        const session = await login(formateur.email, STRONG_PASSWORD);
        expect(session.status).toBe(200);
        expect(session.body.user.role).toBe('FORMATEUR');
        expect(session.body.user.permission).toBe('EMPLOYEE');
    });

    it('refuse un mot de passe faible et un second compte', async () => {
        const formateur = await createFormateur();

        const weak = await call('POST', `/${formateur.id}/account`, { password: 'court' });
        expect(weak.status).toBe(400);
        expect(weak.body.error).toContain('Mot de passe trop faible');
        expect((await call('GET', `/${formateur.id}`)).body.formateur.account.userId).toBeNull();

        expect((await call('POST', `/${formateur.id}/account`, { password: STRONG_PASSWORD })).status).toBe(201);

        const twice = await call('POST', `/${formateur.id}/account`, { password: STRONG_PASSWORD });
        expect(twice.status).toBe(409);
        expect(twice.body.code).toBe('account_exists');
    });

    it('aligne l’e-mail et le nom du compte sur ceux de la fiche', async () => {
        const formateur = await withAccount();
        const suffix = randomUUID().slice(0, 8);
        const nextEmail = `marie.renommee.${suffix}@test.local`;

        const updated = await call('PUT', `/${formateur.id}`, {
            name: 'Marie-Claire Formatrice',
            email: nextEmail,
        });
        expect(updated.status).toBe(200);
        expect(updated.body.formateur.email).toBe(nextEmail);

        // Le compte suit : la connexion se fait avec le nouvel e-mail.
        const session = await login(nextEmail, STRONG_PASSWORD);
        expect(session.status).toBe(200);
        expect(session.body.user.firstName).toBe('Marie-Claire');
        expect(session.body.user.lastName).toBe('Formatrice');
    });

    it('n’expose jamais les formateurs dans l’annuaire staff', async () => {
        const formateur = await withAccount();
        const admin = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'AD', permission: 'ADMIN' });

        const directory = await (await get('/api/auth/directory', admin)).json();
        expect(directory.some((entry: { id: number }) => entry.id === formateur.account.userId)).toBe(false);

        const users = await (await get('/api/auth/users', admin)).json();
        expect(users.some((entry: { id: number }) => entry.id === formateur.account.userId)).toBe(false);
    });
});

describe('espace formateur — cloisonnement et tableau de bord', () => {
    it('sert la prochaine séance et les compteurs au compte rattaché', async () => {
        const formateur = await withAccount();
        const today = localDate(new Date(), tenantTimezone());
        const yesterday = addDaysToDate(today, -1);
        const tomorrow = addDaysToDate(today, 1);
        await seedSeance(formateur.id, formateur.email, yesterday);
        await seedSeance(formateur.id, formateur.email, tomorrow);

        const auth = formateurAuth(formateur.account.userId);
        const res = await get('/api/formateur/me', auth);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.formateur.id).toBe(formateur.id);
        expect(body.upcomingSeanceCount).toBe(1);
        expect(body.pastSeanceCount).toBe(1);
        expect(body.nextSeance.date).toBe(tomorrow);
        expect(body.nextSeance.sessionNom).toBe('Promo espace formateur');
    });

    it('refuse un compte formateur sans fiche et les routes du staff', async () => {
        const orphan = formateurAuth(999_999);
        expect((await get('/api/formateur/me', orphan)).status).toBe(403);

        const formateur = await withAccount();
        const auth = formateurAuth(formateur.account.userId);
        // Son identité passe (page de login, bandeau, déconnexion)…
        expect((await get('/api/auth/me', auth)).status).toBe(200);
        // …mais aucune route staff, y compris l'annuaire et l'émargement.
        expect((await get('/api/auth/directory', auth)).status).toBe(403);
        expect((await get('/api/auth/users', auth)).status).toBe(403);
        expect((await get('/api/formateurs', auth)).status).toBe(403);
        expect((await get('/api/emargement/seances', auth)).status).toBe(403);

        // Les serveurs GraphQL accordent EMPLOYEE au niveau de permission le plus
        // bas : sans refus explicite dans `jwtContext`, un formateur lirait les
        // candidats. Le contexte doit donc le traiter comme non authentifié.
        const graphql = await fetch(`${API}/api/graphql/candidates`, {
            method: 'POST',
            headers: headers(auth, true),
            body: JSON.stringify({ query: 'query { candidates { id } }' }),
        });
        const graphqlBody = (await graphql.json()) as { errors?: { message: string }[] };
        expect(graphqlBody.errors?.[0]?.message).toMatch(/Unauthorized|Forbidden/);
    });
});

describe('cycle de vie du compte formateur', () => {
    it('réinitialise le mot de passe', async () => {
        const formateur = await withAccount();
        const nextPassword = 'NouveauSecret2027!b';

        const reset = await call('PUT', `/${formateur.id}/account`, { password: nextPassword });
        expect(reset.status).toBe(200);
        expect(
            reset.body.formateur.history.some((e: { action: string }) => e.action === 'account_password_reset'),
        ).toBe(true);

        const session = await login(formateur.email, nextPassword);
        expect(session.status).toBe(200);
    });

    it('retire le compte sans toucher à la fiche, puis supprime la fiche', async () => {
        const formateur = await withAccount();

        const removed = await call('DELETE', `/${formateur.id}/account`);
        expect(removed.status).toBe(200);
        expect(removed.body.formateur.account.userId).toBeNull();
        // Le compte est soft-deleted : les identifiants ne fonctionnent plus.
        expect((await login(formateur.email, STRONG_PASSWORD)).status).toBe(401);

        // Recréer un accès sur la même adresse réactive la ligne supprimée
        // (`users.email` est unique) au lieu de buter sur la contrainte.
        const nextPassword = 'RetourParmi2027!c';
        const recreated = await call('POST', `/${formateur.id}/account`, { password: nextPassword });
        expect(recreated.status).toBe(201);
        expect((await login(formateur.email, nextPassword)).status).toBe(200);

        const deleted = await call('DELETE', `/${formateur.id}`);
        expect(deleted.status).toBe(204);
        expect((await call('GET', `/${formateur.id}`)).status).toBe(404);
        // Le compte a suivi la fiche : plus de connexion possible.
        expect((await login(formateur.email, nextPassword)).status).toBe(401);
    });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { env } from '../../../config/env';
import { signGoogleState, verifyGoogleState } from '../../../external/crypto';
import { hmac } from '../../../external/crypto/hmac.service';
import { googleOAuth } from '../../../external/google/oauth-client';
import { getPool } from '../../../db/mysql/connection';

const URL = `http://localhost:${env.API_PORT}/api/auth/google/token`;
const DEFAULT = env.DB_DEFAULT_TENANT;

async function clearUsers(region: string): Promise<void> {
    const conn = await getPool(region).getConnection();
    try {
        await conn.query('SET FOREIGN_KEY_CHECKS = 0');
        await conn.query('DELETE FROM refresh_tokens');
        await conn.query('DELETE FROM users');
        await conn.query('ALTER TABLE users AUTO_INCREMENT = 1');
        await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    } finally {
        conn.release();
    }
}

async function insertUser(region: string, email: string): Promise<void> {
    await getPool(region).execute(
        `INSERT INTO users (email, first_name, last_name, password, role_id, permission_id) VALUES (?, 'Google', 'Tester', 'irrelevant', 1, 1)`,
        [email],
    );
}

async function tokens(region: string, id: number): Promise<{ oauth_token: string | null }[]> {
    const [rows] = await getPool(region).execute('SELECT oauth_token FROM users WHERE id = ?', [id]);
    return rows as { oauth_token: string | null }[];
}

describe('signGoogleState / verifyGoogleState', () => {
    it('roundtrip avec la région annemasse', () => {
        expect(verifyGoogleState(signGoogleState(7, 'annemasse'))).toEqual({ userId: 7, region: 'annemasse' });
    });

    it('roundtrip avec la région reunion', () => {
        expect(verifyGoogleState(signGoogleState(3, 'reunion'))).toEqual({ userId: 3, region: 'reunion' });
    });

    it('accepte un état legacy sans région → tenant par défaut', () => {
        const legacy = `5:${hmac.sign(env.GOOGLE_STATE_SECRET, 'google:state:5')}`;
        expect(verifyGoogleState(legacy)).toEqual({ userId: 5, region: DEFAULT });
    });

    it('rejette un état falsifié (région modifiée, HMAC inchangé)', () => {
        const state = signGoogleState(1, 'annemasse');
        expect(verifyGoogleState(state.replace('annemasse', 'reunion'))).toBeNull();
    });

    it('rejette un état falsifié (signature HMAC modifiée)', () => {
        const state = signGoogleState(1, 'annemasse');
        const [head] = state.split(':');
        expect(verifyGoogleState(`${head}:annemasse:deadbeef`)).toBeNull();
    });

    it('rejette un état illisible', () => {
        expect(verifyGoogleState('garbage')).toBeNull();
        expect(verifyGoogleState('1:2:3')).toBeNull();
    });
});

describe('GoogleOAuthClient per-tenant credentials', () => {
    const saved = {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        redirectUri: env.GOOGLE_REDIRECT_URI,
        annemasseClientId: env.GOOGLE_ANNEMASSE_CLIENT_ID,
        annemasseClientSecret: env.GOOGLE_ANNEMASSE_CLIENT_SECRET,
        annemasseRedirectUri: env.GOOGLE_ANNEMASSE_REDIRECT_URI,
    };

    afterEach(() => {
        env.GOOGLE_CLIENT_ID = saved.clientId;
        env.GOOGLE_CLIENT_SECRET = saved.clientSecret;
        env.GOOGLE_REDIRECT_URI = saved.redirectUri;
        env.GOOGLE_ANNEMASSE_CLIENT_ID = saved.annemasseClientId;
        env.GOOGLE_ANNEMASSE_CLIENT_SECRET = saved.annemasseClientSecret;
        env.GOOGLE_ANNEMASSE_REDIRECT_URI = saved.annemasseRedirectUri;
    });

    function clientIdOf(url: string): string | null {
        // `URL` est shadowé par la constante du fichier → passer par globalThis.
        return new globalThis.URL(url).searchParams.get('client_id');
    }

    it('reunion utilise le client GCP partagé', () => {
        env.GOOGLE_CLIENT_ID = 'reunion-client-id';
        expect(googleOAuth.credentialsFor('reunion').clientId).toBe('reunion-client-id');
        expect(clientIdOf(googleOAuth.generateAuthUrl('9:reunion:sig', 'reunion'))).toBe('reunion-client-id');
    });

    it('annemasse retombe sur le client partagé quand ses vars sont vides', () => {
        env.GOOGLE_CLIENT_ID = 'reunion-client-id';
        env.GOOGLE_ANNEMASSE_CLIENT_ID = undefined;
        env.GOOGLE_ANNEMASSE_CLIENT_SECRET = undefined;
        expect(googleOAuth.credentialsFor('annemasse').clientId).toBe('reunion-client-id');
        expect(clientIdOf(googleOAuth.generateAuthUrl('9:annemasse:sig', 'annemasse'))).toBe('reunion-client-id');
    });

    it('annemasse utilise son propre client GCP quand ses vars sont renseignées', () => {
        env.GOOGLE_CLIENT_ID = 'reunion-client-id';
        env.GOOGLE_ANNEMASSE_CLIENT_ID = 'annemasse-client-id';
        env.GOOGLE_ANNEMASSE_CLIENT_SECRET = 'annemasse-secret';
        env.GOOGLE_ANNEMASSE_REDIRECT_URI = 'https://app-annemasse.example/auth/google';
        const creds = googleOAuth.credentialsFor('annemasse');
        expect(creds.clientId).toBe('annemasse-client-id');
        expect(creds.clientSecret).toBe('annemasse-secret');
        expect(creds.redirectUri).toBe('https://app-annemasse.example/auth/google');
        expect(clientIdOf(googleOAuth.generateAuthUrl('9:annemasse:sig', 'annemasse'))).toBe('annemasse-client-id');
        // reunion reste sur le client partagé.
        expect(clientIdOf(googleOAuth.generateAuthUrl('9:reunion:sig', 'reunion'))).toBe('reunion-client-id');
    });
});

describe('Google OAuth handleGoogleToken route vers la bonne région', () => {
    beforeEach(async () => {
        await clearUsers(DEFAULT);
        await clearUsers('annemasse');
        await insertUser(DEFAULT, 'geo.reunion@disciplina.test');
        await insertUser('annemasse', 'geo.annemasse@disciplina.test');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('écrit les tokens dans la base annemasse quand le state porte la région annemasse', async () => {
        vi.spyOn(googleOAuth, 'exchangeCode').mockResolvedValue({
            access_token: 'access-token',
            refresh_token: 'refresh-token',
        });

        const res = await fetch(URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: 'fake-code', state: signGoogleState(1, 'annemasse') }),
        });

        expect(res.status).toBe(200);
        expect((await tokens('annemasse', 1))[0].oauth_token).not.toBeNull();
        expect((await tokens(DEFAULT, 1))[0].oauth_token).toBeNull();
    });

    it('écrit les tokens dans la base par défaut quand le state porte la région reunion', async () => {
        vi.spyOn(googleOAuth, 'exchangeCode').mockResolvedValue({
            access_token: 'access-token',
            refresh_token: 'refresh-token',
        });

        const res = await fetch(URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: 'fake-code', state: signGoogleState(1, 'reunion') }),
        });

        expect(res.status).toBe(200);
        expect((await tokens(DEFAULT, 1))[0].oauth_token).not.toBeNull();
        expect((await tokens('annemasse', 1))[0].oauth_token).toBeNull();
    });

    it('rejette un state invalide avant tout échange de code', async () => {
        const exchangeCode = vi.spyOn(googleOAuth, 'exchangeCode');

        const res = await fetch(URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: 'fake-code', state: 'faux-state' }),
        });

        expect(res.status).toBe(400);
        expect(exchangeCode).not.toHaveBeenCalled();
    });
});

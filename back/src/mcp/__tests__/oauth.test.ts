import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHash, randomBytes } from 'crypto';
import bcrypt from 'bcrypt';
import { env } from '../../config/env';
import pool, { getPool } from '../../db/mysql/connection';
import type { Region } from '../../types/tenant';

const BASE = `http://localhost:${env.API_PORT}`;
const MCP_ENDPOINT = `${BASE}/api/mcp`;
// Clé MCP statique (Claude Code / Desktop) : accès admin de contournement. Elle
// est injectée par docker-compose.test.yml ; auth.ts est fail-closed < 32 chars.
const MCP_KEY = env.MCP_API_KEY ?? '';
const REDIRECT_URI = 'http://localhost/cb';

// Credentials du compte MCP créé en base : le consentement OAuth vérifie le
// login CRM (email + mot de passe) dans la table `users` de la région choisie.
const TEST_PASSWORD = 'StrongPass123!';

interface ConsentUser {
    id: number;
    email: string;
    password: string;
    region: Region;
}

interface TestUserOptions {
    roleId?: number;
    permissionId?: number;
    region?: Region;
}

function pkce(): { verifier: string; challenge: string } {
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge };
}

function authorizeParams(clientId: string, challenge: string): string {
    return new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: REDIRECT_URI,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        scope: 'mcp:call',
        state: 'test-state',
    }).toString();
}

function consentForm(clientId: string, challenge: string, user: ConsentUser): string {
    return `${authorizeParams(clientId, challenge)}&email=${encodeURIComponent(user.email)}&password=${encodeURIComponent(user.password)}&region=${user.region}`;
}

async function registerClient(name = 'Claude Test'): Promise<{ clientId: string }> {
    const res = await fetch(`${BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            redirect_uris: [REDIRECT_URI],
            client_name: name,
            token_endpoint_auth_method: 'none',
        }),
    });
    const body = (await res.json()) as { client_id: string };
    return { clientId: body.client_id };
}

// Insère un utilisateur CRM (login MCP de test) dans le tenant `region`.
// id explicite très haut : jamais seedé ni référencé par les suites voisines,
// donc sa suppression ne peut pas se heurter à une FK (external_access, …).
async function createUser(email: string, opts: TestUserOptions = {}): Promise<ConsentUser> {
    const region = opts.region ?? 'reunion';
    const hash = await bcrypt.hash(TEST_PASSWORD, 4);
    const roleId = opts.roleId ?? 1;
    const permissionId = opts.permissionId ?? 1;
    for (let attempt = 0; attempt < 5; attempt++) {
        const id = 9_000_000 + Math.floor(Math.random() * 900_000);
        try {
            await getPool(region).execute(
                'INSERT INTO users (id, email, first_name, last_name, password, role_id, permission_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [id, email, 'MCP', 'OAuth', hash, roleId, permissionId],
            );
            return { id, email, password: TEST_PASSWORD, region };
        } catch (err) {
            if ((err as { code?: string }).code !== 'ER_DUP_ENTRY') throw err;
        }
    }
    throw new Error(`could not insert MCP test user ${email}`);
}

async function dropUser(user: ConsentUser): Promise<void> {
    const p = getPool(user.region);
    await p.execute('DELETE FROM external_access WHERE user_id = ?', [user.id]);
    await p.execute('DELETE FROM users WHERE id = ?', [user.id]);
}

function decodeJwtPayload(token: string): Record<string, unknown> {
    const part = token.split('.')[1];
    return JSON.parse(Buffer.from(part, 'base64url').toString()) as Record<string, unknown>;
}

// Consent complet via login CRM : émet le code d'autorisation + le verifier PKCE.
async function gate(clientId: string, user: ConsentUser): Promise<{ verifier: string; code: string }> {
    const { verifier, challenge } = pkce();
    const res = await fetch(`${BASE}/authorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(consentForm(clientId, challenge, user)).toString(),
        redirect: 'manual',
    });
    if (res.status !== 302) {
        const body = await res.text();
        throw new Error(`consent POST returned ${res.status}: ${body.slice(0, 400)}`);
    }
    expect(res.status, 'consent POST should redirect (302)').toBe(302);
    const location = res.headers.get('location') ?? '';
    expect(location).toContain('http://localhost/cb');
    expect(location).toContain('state=test-state');
    const code = new URL(location).searchParams.get('code');
    expect(code).toBeTruthy();
    return { verifier, code: code! };
}

async function exchangeTokens(clientId: string, verifier: string, code: string) {
    const res = await fetch(`${BASE}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: clientId,
            code,
            redirect_uri: REDIRECT_URI,
            code_verifier: verifier,
        }).toString(),
    });
    const body = (await res.json()) as Record<string, string>;
    expect(res.status, `token exchange failed: ${JSON.stringify(body)}`).toBe(200);
    return body as unknown as { access_token: string; refresh_token: string; token_type: string };
}

// Appel MCP générique (tools/list ou tools/call) avec un Bearer.
async function mcpCall(
    payload: Record<string, unknown>,
    token?: string,
): Promise<Response> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(MCP_ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
    });
}

async function mcpResult(response: Response): Promise<unknown> {
    const text = await response.text();
    // Le serveur MCP répond en SSE (event: message\ndata: <json>) même pour une
    // requête unique : on extrait la payload `data:`.
    const dataLine = text.split('\n').find((line) => line.startsWith('data:'));
    return JSON.parse(dataLine ? dataLine.slice('data:'.length).trim() : text);
}

async function toolCall(token: string, name: string, args: Record<string, unknown> = {}) {
    const res = await mcpCall(
        { jsonrpc: '2.0', method: 'tools/call', params: { name, arguments: args }, id: 'oc-test' },
        token,
    );
    const parsed = (await mcpResult(res)) as {
        result?: { content?: { type: string; text: string }[]; isError?: boolean };
        error?: { message?: string };
    };
    return parsed;
}

async function grantedToken(clientId: string, user: ConsentUser): Promise<{ access_token: string; refresh_token: string }> {
    const { verifier, code } = await gate(clientId, user);
    const tokens = await exchangeTokens(clientId, verifier, code);
    return { access_token: tokens.access_token, refresh_token: tokens.refresh_token };
}

let defaultUser: ConsentUser;

beforeEach(async () => {
    await pool.query('DELETE FROM mcp_oauth_refresh_tokens');
    await pool.query('DELETE FROM mcp_oauth_clients');
    // Compte par défaut : COMMERCIAL / EMPLOYEE sur La Réunion.
    defaultUser = await createUser('mcp.commercial.test@disciplina.re');
});

afterEach(async () => {
    await dropUser(defaultUser);
    await pool.query('DELETE FROM mcp_oauth_refresh_tokens');
    await pool.query('DELETE FROM mcp_oauth_clients');
});

describe('MCP OAuth 2.1 (claude.ai web) — login CRM + région + RBAC', () => {
    it('exposes OAuth metadata for discovery', async () => {
        const asRes = await fetch(`${BASE}/.well-known/oauth-authorization-server`);
        expect(asRes.status).toBe(200);
        const asMeta = (await asRes.json()) as Record<string, unknown>;
        const issuer = env.MCP_OAUTH_ISSUER_URL.replace(/\/$/, '');
        expect(String(asMeta.issuer).replace(/\/$/, '')).toBe(issuer);
        expect(asMeta.authorization_endpoint).toBe(`${issuer}/authorize`);
        expect(asMeta.token_endpoint).toBe(`${issuer}/token`);
        expect(asMeta.registration_endpoint).toBe(`${issuer}/register`);
        expect(asMeta.scopes_supported).toContain('mcp:call');

        const rsRes = await fetch(`${BASE}/.well-known/oauth-protected-resource/api/mcp`);
        expect(rsRes.status).toBe(200);
        const rsMeta = (await rsRes.json()) as Record<string, unknown>;
        expect(rsMeta.resource).toBe(MCP_ENDPOINT);
        const servers = (rsMeta.authorization_servers as string[]).map((s) => s.replace(/\/$/, ''));
        expect(servers).toContain(issuer);
    });

    it('registers a public client via DCR', async () => {
        const res = await fetch(`${BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                redirect_uris: [REDIRECT_URI],
                client_name: 'Claude Test DCR',
                token_endpoint_auth_method: 'none',
            }),
        });
        expect(res.status).toBe(201);
        const body = (await res.json()) as Record<string, unknown>;
        expect(typeof body.client_id).toBe('string');
        expect(body.token_endpoint_auth_method).toBe('none');
    });

    it('renders consent with client info and rejects a bad password, then grants', async () => {
        const { clientId } = await registerClient('Disciplina Connector');
        const { challenge } = pkce();

        const pageRes = await fetch(`${BASE}/authorize?${authorizeParams(clientId, challenge)}`);
        expect(pageRes.status).toBe(200);
        const page = await pageRes.text();
        expect(page).toContain('Disciplina Connector');
        expect(page).toContain('E-mail du compte Disciplina');
        expect(page).toContain('mcp:call');
        expect(page).toContain('lecture seule');
        expect(page).toContain('La Réunion');

        const badRes = await fetch(`${BASE}/authorize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(
                `${authorizeParams(clientId, challenge)}&email=${encodeURIComponent(defaultUser.email)}&password=wrong-password&region=reunion`,
            ).toString(),
            redirect: 'manual',
        });
        expect(badRes.status).toBe(200);
        expect(await badRes.text()).toContain('Identifiants incorrects.');

        const { verifier, code } = await gate(clientId, defaultUser);
        const tokens = await exchangeTokens(clientId, verifier, code);
        expect(tokens.access_token).toBeTruthy();
    });

    it('round-trips the rendered consent form end-to-end (hidden fields incl. response_type, email/password/region)', async () => {
        const { clientId } = await registerClient();
        const { verifier, challenge } = pkce();

        const page = await (await fetch(`${BASE}/authorize?${authorizeParams(clientId, challenge)}`)).text();
        const hidden = [...page.matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)"/g)].map(
            (m) => [m[1] as string, m[2] as string] as const,
        );
        const names = hidden.map(([n]) => n);
        expect(names).toContain('response_type');
        expect(names).toContain('state');
        expect(names).toContain('code_challenge');
        expect(names).toContain('client_id');

        const form = new URLSearchParams(hidden.map(([n, v]) => [n, v]));
        form.set('email', defaultUser.email);
        form.set('password', defaultUser.password);
        form.set('region', defaultUser.region);
        const res = await fetch(`${BASE}/authorize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'null' },
            body: form.toString(),
            redirect: 'manual',
        });
        expect(res.status).toBe(302);
        const location = res.headers.get('location') ?? '';
        expect(location).toContain('http://localhost/cb');
        expect(location).toContain('state=test-state');
        const code = new URL(location).searchParams.get('code');
        expect(code).toBeTruthy();

        const tokens = await exchangeTokens(clientId, verifier, code!);
        expect(tokens.access_token).toBeTruthy();
        expect(decodeJwtPayload(tokens.access_token)).toMatchObject({ sub: defaultUser.id, region: 'reunion' });
    });

    it('accepts the consent POST from an opaque origin (claude.ai sandboxed iframe)', async () => {
        const { clientId } = await registerClient();
        const { challenge } = pkce();
        const res = await fetch(`${BASE}/authorize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Origin: 'null',
            },
            body: new URLSearchParams(consentForm(clientId, challenge, defaultUser)).toString(),
            redirect: 'manual',
        });
        expect(res.status).toBe(302);
    });

    it('only exchanges an authorization code with the matching PKCE verifier', async () => {
        const { clientId } = await registerClient();
        const { code } = await gate(clientId, defaultUser);

        const res = await fetch(`${BASE}/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: clientId,
                code,
                redirect_uri: REDIRECT_URI,
                code_verifier: 'wrong-verifier',
            }).toString(),
        });
        expect(res.status).toBe(400);
    });

    it('lets the OAuth-issued token and the static key call /api/mcp, rejects others', async () => {
        const { clientId } = await registerClient();
        const { access_token } = await grantedToken(clientId, defaultUser);

        const listRes = await mcpCall({ jsonrpc: '2.0', method: 'tools/list', id: 'oc-test' }, access_token);
        const list = (await mcpResult(listRes)) as { result?: { tools?: { name: string }[] }; error?: { message: string } };
        const tools = list.result?.tools;
        if (!tools) {
            throw new Error(`tools/list OAuth returned ${listRes.status}: ${JSON.stringify(list).slice(0, 400)}`);
        }
        expect(tools.length).toBeGreaterThan(20);
        expect(tools[0]?.name).toBeTruthy();

        const byKey = (await mcpResult(
            await mcpCall({ jsonrpc: '2.0', method: 'tools/list', id: 'oc-test' }, MCP_KEY),
        )) as { result?: { tools?: { name: string }[] }; error?: { message: string } };
        expect(byKey.result?.tools?.length ?? 0).toBeGreaterThan(20);

        const byBad = await mcpCall({ jsonrpc: '2.0', method: 'tools/list', id: 'oc-test' }, 'wrong-token');
        expect(byBad.status).toBe(401);
    });

    it('rotates the refresh token and rejects reuse', async () => {
        const { clientId } = await registerClient();
        const { refresh_token } = await grantedToken(clientId, defaultUser);

        const rotate = await fetch(`${BASE}/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: clientId,
                refresh_token,
            }).toString(),
        });
        expect(rotate.status).toBe(200);
        const rotated = (await rotate.json()) as { access_token: string; refresh_token: string };
        expect(rotated.access_token).toBeTruthy();
        expect(rotated.refresh_token).not.toBe(refresh_token);

        const reuse = await fetch(`${BASE}/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: clientId,
                refresh_token,
            }).toString(),
        });
        expect(reuse.status).toBe(400);
        expect(((await reuse.json()) as { error?: string }).error).toBe('invalid_grant');
    });

    // --- RBAC : l'utilisateur attaché à la session OAuth scope les outils ---

    it('scopes tools by role for low-permission users: GUEST+COMMERCIAL sees companies, denied on candidates', async () => {
        // Miroir exact d'authGuardRole (permission OU rôle) : un compte GUEST n'a
        // que son rôle métier pour accéder → le scope porté par l'outil s'applique.
        const guestCommercial = await createUser('mcp.guest.commercial@disciplina.re', { roleId: 1, permissionId: 4 });
        try {
            const { clientId } = await registerClient();
            const { access_token } = await grantedToken(clientId, guestCommercial);

            const companies = await toolCall(access_token, 'search_companies', {});
            expect(companies.result?.isError).toBeUndefined();

            const candidates = await toolCall(access_token, 'search_candidates', {});
            expect(candidates.result?.isError).toBe(true);
            expect(candidates.result?.content?.[0]?.text).toContain('Accès refusé');
        } finally {
            await dropUser(guestCommercial);
        }
    });

    it('scopes tools by role for low-permission users: GUEST+RH sees candidates, denied on companies', async () => {
        const guestRh = await createUser('mcp.guest.rh@disciplina.re', { roleId: 2, permissionId: 4 });
        try {
            const { clientId } = await registerClient();
            const { access_token } = await grantedToken(clientId, guestRh); // RH/GUEST

            const candidates = await toolCall(access_token, 'search_candidates', {});
            expect(candidates.result?.isError).toBeUndefined();

            const companies = await toolCall(access_token, 'search_companies', {});
            expect(companies.result?.isError).toBe(true);
            expect(companies.result?.content?.[0]?.text).toContain('Accès refusé');
        } finally {
            await dropUser(guestRh);
        }
    });

    it('mirrors authGuardRole: an EMPLOYEE-permission user reaches both domains (permission leg dominates)', async () => {
        const { clientId } = await registerClient();
        const { access_token } = await grantedToken(clientId, defaultUser); // COMMERCIAL/EMPLOYEE

        const companies = await toolCall(access_token, 'search_companies', {});
        expect(companies.result?.isError).toBeUndefined();

        // Permissions hiérarchique : EMPLOYEE ≥ EMPLOYEE → accès même hors de son rôle.
        const candidates = await toolCall(access_token, 'search_candidates', {});
        expect(candidates.result?.isError).toBeUndefined();
    });

    it('forbids reading another user notifications unless ADMIN (list_notifications is self-scoped)', async () => {
        const other = await createUser('mcp.other.test@disciplina.re', { roleId: 1 });
        try {
            const { clientId } = await registerClient();
            const { access_token } = await grantedToken(clientId, defaultUser);

            const otherNotifications = await toolCall(access_token, 'list_notifications', { userId: other.id });
            expect(otherNotifications.result?.isError).toBe(true);

            const own = await toolCall(access_token, 'list_notifications', { userId: defaultUser.id });
            expect(own.result?.isError).toBeUndefined();
        } finally {
            await dropUser(other);
        }
    });

    // --- Région : le consentement choisit le tenant (users + données) ---

    it('binds the consent region (annemasse) to the token and the client row', async () => {
        const annemasseUser = await createUser('mcp.rh.annemasse@disciplina.re', {
            roleId: 2,
            region: 'annemasse',
        });
        try {
            const { clientId } = await registerClient();
            const { access_token, refresh_token } = await grantedToken(clientId, annemasseUser);

            expect(decodeJwtPayload(access_token)).toMatchObject({
                sub: annemasseUser.id,
                region: 'annemasse',
            });

            const [rows] = await getPool('reunion').execute<{ user_id: number; region: string }[]>(
                'SELECT user_id, region FROM mcp_oauth_clients WHERE client_id = ?',
                [clientId],
            );
            expect(rows[0]).toMatchObject({ user_id: annemasseUser.id, region: 'annemasse' });

            // Le token conserve l'identité au refresh (rotation).
            const rotated = await fetch(`${BASE}/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    client_id: clientId,
                    refresh_token,
                }).toString(),
            });
            expect(rotated.status).toBe(200);
            const rotatedTokens = (await rotated.json()) as { access_token: string };
            expect(decodeJwtPayload(rotatedTokens.access_token)).toMatchObject({
                sub: annemasseUser.id,
                region: 'annemasse',
            });
        } finally {
            await dropUser(annemasseUser);
        }
    });

    it('rejects an invalid region on the consent form', async () => {
        const { clientId } = await registerClient();
        const { challenge } = pkce();
        const res = await fetch(`${BASE}/authorize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(
                `${authorizeParams(clientId, challenge)}&email=${defaultUser.email}&password=${defaultUser.password}&region=paris`,
            ).toString(),
            redirect: 'manual',
        });
        expect(res.status).toBe(200);
        expect(await res.text()).toContain('Région invalide.');
    });
});
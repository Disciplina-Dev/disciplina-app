import { describe, it, expect, beforeEach } from 'vitest';
import { createHash, randomBytes } from 'crypto';
import { env } from '../../config/env';
import pool from '../../db/mysql/connection';

const BASE = `http://localhost:${env.API_PORT}`;
const MCP_ENDPOINT = `${BASE}/api/mcp`;
// Clé MCP injectée via l'environnement du process de test (auth.ts fail-closed
// en-dessous de 32 chars) : elle sert à la fois de Bearer direct et de secret de
// consentement OAuth.
const MCP_KEY = env.MCP_API_KEY ?? '';
const REDIRECT_URI = 'http://localhost/cb';

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

// Consent complet : PKCE généré ici, renvoyé avec le code d'autorisation.
async function gate(clientId: string, mcpKey = MCP_KEY): Promise<{ verifier: string; code: string }> {
    const { verifier, challenge } = pkce();
    const res = await fetch(`${BASE}/authorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(`${authorizeParams(clientId, challenge)}&mcp_key=${encodeURIComponent(mcpKey)}`).toString(),
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

async function mcpCall(token?: string) {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(MCP_ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 'oc-test' }),
    });
}

async function mcpResult(response: Response): Promise<unknown> {
    const text = await response.text();
    // Le serveur MCP répond en SSE (event: message\ndata: <json>) même pour une
    // requête unique : on extrait la payload `data:`.
    const dataLine = text.split('\n').find((line) => line.startsWith('data:'));
    return JSON.parse(dataLine ? dataLine.slice('data:'.length).trim() : text);
}

beforeEach(async () => {
    await pool.query('DELETE FROM mcp_oauth_refresh_tokens');
    await pool.query('DELETE FROM mcp_oauth_clients');
    await pool.query('DELETE FROM mcp_oauth_refresh_tokens');
});

describe('MCP OAuth 2.1 (claude.ai web)', () => {
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

    it('renders consent with client info and rejects a bad key, then grants', async () => {
        const { clientId } = await registerClient('Disciplina Connector');
        const { challenge } = pkce();

        const pageRes = await fetch(`${BASE}/authorize?${authorizeParams(clientId, challenge)}`);
        expect(pageRes.status).toBe(200);
        const page = await pageRes.text();
        expect(page).toContain('Disciplina Connector');
        expect(page).toContain("Clé d'accès MCP");
        expect(page).toContain('mcp:call');
        expect(page).toContain('lecture seule');

        const badRes = await fetch(`${BASE}/authorize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(`${authorizeParams(clientId, challenge)}&mcp_key=wrong-key`).toString(),
            redirect: 'manual',
        });
        expect(badRes.status).toBe(200);
        expect(await badRes.text()).toContain('incorrecte');

        const { code, verifier: gateVerifier } = await gate(clientId);
        const tokens = await exchangeTokens(clientId, gateVerifier, code);
        expect(tokens.access_token).toBeTruthy();
        expect(tokens.refresh_token).toBeTruthy();
        expect(tokens.token_type).toBe('Bearer');
    });

    it('only exchanges an authorization code with the matching PKCE verifier', async () => {
        const { clientId } = await registerClient();
        const { code } = await gate(clientId);

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
        const { verifier, code } = await gate(clientId);
        const { access_token } = await exchangeTokens(clientId, verifier, code);

        const listRes = await mcpCall(access_token);
        const list = (await mcpResult(listRes)) as { result?: { tools?: { name: string }[] }; error?: { message: string } };
        const tools = list.result?.tools;
        if (!tools) {
            throw new Error(`tools/list OAuth returned ${listRes.status}: ${JSON.stringify(list).slice(0, 400)}`);
        }
        expect(tools.length).toBeGreaterThan(20);
        expect(tools[0]?.name).toBeTruthy();

        const byKey = (await mcpResult(await mcpCall(MCP_KEY))) as { result?: { tools?: { name: string }[] }; error?: { message: string } };
        expect(byKey.result?.tools?.length ?? 0).toBeGreaterThan(20);

        const byBad = await mcpCall('wrong-token');
        expect(byBad.status).toBe(401);
    });

    it('rotates the refresh token and rejects reuse', async () => {
        const { clientId } = await registerClient();
        const { verifier, code } = await gate(clientId);
        const { refresh_token } = await exchangeTokens(clientId, verifier, code);

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
});
import { Response } from 'express';
import { timingSafeEqual } from 'crypto';
import { InvalidGrantError, InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import type { OAuthServerProvider, AuthorizationParams } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { OAuthClientInformationFull, OAuthTokens, OAuthTokenRevocationRequest } from '@modelcontextprotocol/sdk/shared/auth.js';
import { env } from '../../config/env';
import { logger } from '../../external/logger';
import { sha256Hex } from '../../external/crypto/hash';
import { McpOAuthClientStore } from './clientStore';
import { McpOAuthRefreshTokenStore } from './refreshTokenStore';
import {
    MCP_SCOPE,
    MCP_ACCESS_TOKEN_TTL_SECONDS,
    MCP_REFRESH_TOKEN_TTL_SECONDS,
    signAuthCode,
    verifyAuthCode,
    signMcpAccessToken,
    verifyMcpAccessToken,
    generateRefreshToken,
} from './tokens';

const DEFAULT_CLIENT_NAME = 'Claude (claude.ai)';
const REFRESH_GRACE_DAYS = 30;

function secureEquals(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

function withCodeAndState(redirectUri: string, params: AuthorizationParams, code?: string, error?: string): string {
    const url = new URL(redirectUri);
    if (code) url.searchParams.set('code', code);
    if (error) url.searchParams.set('error', error);
    if (params.state) url.searchParams.set('state', params.state);
    return url.href;
}

function escapeHtml(input: string): string {
    return input.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

function renderConsentPage(client: OAuthClientInformationFull, params: AuthorizationParams, error: string | null): string {
    const clientName = escapeHtml(client.client_name || DEFAULT_CLIENT_NAME);
    const clientUri = client.client_uri ? escapeHtml(client.client_uri.toString()) : null;
    const logoUri = client.logo_uri ? escapeHtml(client.logo_uri.toString()) : null;
    const resource = params.resource ? escapeHtml(params.resource.toString()) : null;
    // Seul le scope mcp:call existe : on le présente explicitement.
    const scopeRequested = params.scopes && params.scopes.length > 0 ? params.scopes : [MCP_SCOPE];
    const scopeLabel = scopeRequested.includes(MCP_SCOPE)
        ? 'Accès en lecture seule aux données du CRM Disciplina'
        : scopeRequested.map(escapeHtml).join(', ');

    const hiddenFields = [
        ['client_id', client.client_id],
        ['redirect_uri', params.redirectUri],
        ['code_challenge', params.codeChallenge],
        ['code_challenge_method', 'S256'],
        ...(params.scopes && params.scopes.length > 0 ? ([['scope', params.scopes.join(' ')]] as const) : []),
        ...(params.state ? ([['state', params.state]] as const) : []),
        ...(params.resource ? ([['resource', params.resource.toString()]] as const) : []),
    ]
        .map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}"/>`)
        .join('\n      ');

    const errorHtml = error
        ? `<div class="error">${escapeHtml(error)}</div>`
        : '';

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Connexion — Disciplina CRM</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: #f4f4f5; margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .card { background: #fff; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.12); padding: 32px; max-width: 420px; width: 100%; margin: 16px; }
  .logo { width: 48px; height: 48px; object-fit: contain; margin-bottom: 12px; }
  h1 { font-size: 18px; margin: 4px 0 8px; }
  .desc { color: #555; font-size: 14px; line-height: 1.5; }
  .field { margin: 16px 0; }
  label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
  input[type=password], input[type=text] { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #ccc; border-radius: 8px; font-size: 14px; }
  .actions { display: flex; gap: 8px; margin-top: 20px; }
  button { flex: 1; padding: 10px 12px; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; }
  button.allow { background: #14532d; color: #fff; }
  button.deny { background: #e5e7eb; color: #111; }
  a.deny { text-align:center; display:block; padding:10px; border-radius:8px; background:#e5e7eb; color:#111; text-decoration:none; font-size:14px; }
  .error { background: #fee2e2; color: #991b1b; border-radius: 8px; padding: 10px 12px; font-size: 13px; margin: 12px 0; }
  .meta { font-size: 12px; color: #777; margin-top: 16px; }
</style>
</head>
<body>
  <form class="card" method="post" action="/authorize">
    ${logoUri ? `<img class="logo" src="${logoUri}" alt="" referrerpolicy="no-referrer"/>` : ''}
    <h1>${clientName} souhaite accéder au CRM Disciplina</h1>
    ${clientUri ? `<p class="desc">Application : <a href="${clientUri}" rel="noreferrer">${clientUri}</a></p>` : ''}
    <p class="desc">${scopeLabel}.</p>
    ${resource ? `<p class="desc">Destination des données : <code>${resource}</code></p>` : ''}
    <p class="desc">Aucune modification n'est possible : l'accès est strictement en lecture.</p>
    <div class="field">
      <label for="mcp_key">Clé d'accès MCP (secret partagé de l'organisation)</label>
      <input id="mcp_key" name="mcp_key" type="password" autocomplete="off" required autofocus/>
    </div>
    ${errorHtml}
    ${hiddenFields}
    <div class="actions">
      <button class="allow" type="submit">Autoriser</button>
      <a class="deny" href="${escapeHtml(withCodeAndState(params.redirectUri, params, undefined, 'access_denied'))}">Refuser</a>
    </div>
    <p class="meta">Autorisation OAuth &mdash; dissociable à tout moment depuis votre compte claude.ai.</p>
  </form>
</body>
</html>`;
}

/**
 * Fournisseur OAuth 2.1 du SDK MCP, adossé à notre CRM :
 * - DCR persistant en MySQL (clients enregistrés par claude.ai)
 * - page de consentement gardée par la clé MCP partagée (MCP_API_KEY)
 * - access tokens JWT stateless, refresh tokens en rotation hachés en base.
 */
export class McpOAuthProvider implements OAuthServerProvider {
    readonly clientsStore = new McpOAuthClientStore();
    private readonly refreshTokenStore = new McpOAuthRefreshTokenStore();

    async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
        res.setHeader('Cache-Control', 'no-store');

        // La page de consentement POSTe sur /authorize : un middleware monté
        // avant le SDK dépose le secret dans res.locals.mcpKey.
        const submittedKey = (res.locals as { mcpKey?: string }).mcpKey;
        if (submittedKey === undefined) {
            res.status(200).send(renderConsentPage(client, params, null));
            return;
        }

        const configured = env.MCP_API_KEY;
        if (!configured || configured.length < 32 || !secureEquals(submittedKey, configured)) {
            logger.warn({ ip: res.req.ip, clientId: client.client_id }, 'MCP OAuth: bad consent key rejected');
            res.status(200).send(renderConsentPage(client, params, 'Clé d\u2019accès incorrecte.'));
            return;
        }

        logger.info({ clientId: client.client_id, clientName: client.client_name, ip: res.req.ip }, 'MCP OAuth: authorization granted');
        const code = signAuthCode({
            clientId: client.client_id,
            codeChallenge: params.codeChallenge,
            redirectUri: params.redirectUri,
        });
        res.redirect(302, withCodeAndState(params.redirectUri, params, code));
    }

    async challengeForAuthorizationCode(client: OAuthClientInformationFull, authorizationCode: string): Promise<string> {
        const payload = verifyAuthCode(authorizationCode);
        if (!payload || payload.clientId !== client.client_id) {
            throw new InvalidGrantError('Invalid authorization code');
        }
        return payload.codeChallenge;
    }

    async exchangeAuthorizationCode(
        client: OAuthClientInformationFull,
        authorizationCode: string,
    ): Promise<OAuthTokens> {
        const payload = verifyAuthCode(authorizationCode);
        if (!payload || payload.clientId !== client.client_id) {
            throw new InvalidGrantError('Invalid authorization code');
        }
        return this.issueTokens(client.client_id);
    }

    async exchangeRefreshToken(client: OAuthClientInformationFull, refreshToken: string): Promise<OAuthTokens> {
        const tokenHash = sha256Hex(refreshToken);
        const row = await this.refreshTokenStore.findValidByHash(client.client_id, tokenHash);
        if (!row) {
            throw new InvalidGrantError('Invalid refresh token');
        }
        // Rotation : l'ancien jeton est révoqué, un nouveau est émis.
        await this.refreshTokenStore.revokeByHash(client.client_id, tokenHash);
        void this.pruneRefreshTokens();
        return this.issueTokens(client.client_id);
    }

    async revokeToken(_client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest): Promise<void> {
        // Access tokens JWT stateless : non révocables sans blacklist. Les
        // refresh tokens (supports de session) sont révoqués par leur hash.
        await this.refreshTokenStore.revokeByHash(_client.client_id, sha256Hex(request.token));
    }

    async verifyAccessToken(token: string): Promise<AuthInfo> {
        const verified = verifyMcpAccessToken(token);
        if (!verified) {
            throw new InvalidTokenError('Invalid or expired access token');
        }
        return {
            token,
            clientId: verified.clientId,
            scopes: [MCP_SCOPE],
            expiresAt: verified.expiresAt,
        };
    }

    private async issueTokens(clientId: string): Promise<OAuthTokens> {
        const accessToken = signMcpAccessToken(clientId);
        const refreshToken = generateRefreshToken();
        const expiresAt = new Date(Date.now() + MCP_REFRESH_TOKEN_TTL_SECONDS * 1000);
        await this.refreshTokenStore.create(clientId, sha256Hex(refreshToken), expiresAt);
        logger.info({ clientId }, 'MCP OAuth: tokens issued');
        return {
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: MCP_ACCESS_TOKEN_TTL_SECONDS,
            refresh_token: refreshToken,
            scope: MCP_SCOPE,
        };
    }

    private async pruneRefreshTokens(): Promise<void> {
        try {
            await this.refreshTokenStore.deleteExpired(REFRESH_GRACE_DAYS);
        } catch (error) {
            logger.error({ err: error }, 'MCP OAuth: refresh token purge failed');
        }
    }
}
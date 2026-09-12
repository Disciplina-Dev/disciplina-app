import { Response } from 'express';
import { InvalidGrantError, InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import type { OAuthServerProvider, AuthorizationParams } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { OAuthClientInformationFull, OAuthTokens, OAuthTokenRevocationRequest } from '@modelcontextprotocol/sdk/shared/auth.js';
import { env } from '../../config/env';
import { logger } from '../../external/logger';
import { sha256Hex } from '../../external/crypto/hash';
import { UserService } from '../../services/UserService';
import { isRegion, type Region } from '../../types/tenant';
import { buildRedirectUri, renderConsentPage } from './consentPage';
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

const REFRESH_GRACE_DAYS = 30;

/**
 * Fournisseur OAuth 2.1 du SDK MCP, adossé à notre CRM :
 * - DCR persistant en MySQL (clients enregistrés par claude.ai)
 * - page de consentement gardée par le login CRM (email + mot de passe de la
 *   table `users`, dans la région choisie) — l'identité (sub) et le tenant sont
 *   ensuite portés par les tokens pour scoper chaque outil.
 * - access tokens JWT stateless, refresh tokens en rotation hachés en base.
 */

/**
 * Fournisseur OAuth 2.1 du SDK MCP, adossé à notre CRM :
 * - DCR persistant en MySQL (clients enregistrés par claude.ai)
 * - page de consentement gardée par le login CRM (email + mot de passe de la
 *   table `users`, dans la région choisie) — l'identité (sub) et le tenant sont
 *   ensuite portés par les tokens pour scoper chaque outil.
 * - access tokens JWT stateless, refresh tokens en rotation hachés en base.
 */
/**
 * Fournisseur OAuth 2.1 du SDK MCP, adossé à notre CRM :
 * - DCR persistant en MySQL (clients enregistrés par claude.ai)
 * - page de consentement gardée par le login CRM (email + mot de passe de la
 *   table `users`, dans la région choisie) — l'identité (sub) et le tenant sont
 *   ensuite portés par les tokens pour scoper chaque outil.
 * - access tokens JWT stateless, refresh tokens en rotation hachés en base.
 */
export class McpOAuthProvider implements OAuthServerProvider {
    readonly clientsStore = new McpOAuthClientStore();
    private readonly refreshTokenStore = new McpOAuthRefreshTokenStore();
    private readonly userService = new UserService();

    async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
        res.setHeader('Cache-Control', 'no-store');

        // La page de consentement POSTe sur /authorize : un middleware monté
        // avant le SDK dépose email/mot de passe/région dans res.locals.
        const { loginEmail, loginPassword, loginRegion } = res.locals as {
            loginEmail?: string;
            loginPassword?: string;
            loginRegion?: string;
        };
        if (loginEmail === undefined) {
            res.status(200).send(renderConsentPage(client, params, null));
            return;
        }

        const email = loginEmail.trim().toLowerCase();
        const password = loginPassword ?? '';
        const submittedRegion = loginRegion ?? '';

        if (!email || !password) {
            res.status(200).send(renderConsentPage(client, params, 'E-mail et mot de passe requis.', email, env.DB_DEFAULT_TENANT));
            return;
        }

        if (submittedRegion !== '' && !isRegion(submittedRegion)) {
            logger.warn({ ip: res.req.ip, clientId: client.client_id, submittedRegion }, 'MCP OAuth: invalid consent region');
            res.status(200).send(renderConsentPage(client, params, 'Région invalide.', email, env.DB_DEFAULT_TENANT));
            return;
        }
        const region = isRegion(submittedRegion) ? submittedRegion : env.DB_DEFAULT_TENANT;

        const user = await this.userService.verifyCredentials(email, password, region);
        if (!user) {
            logger.warn({ ip: res.req.ip, clientId: client.client_id, region }, 'MCP OAuth: consent login failed');
            res.status(200).send(renderConsentPage(client, params, 'Identifiants incorrects.', email, region));
            return;
        }

        await this.clientsStore.recordConsent(client.client_id, user.id, region);
        logger.info(
            { clientId: client.client_id, clientName: client.client_name, userId: user.id, region, ip: res.req.ip },
            'MCP OAuth: authorization granted',
        );
        const code = signAuthCode({
            clientId: client.client_id,
            userId: user.id,
            region,
            codeChallenge: params.codeChallenge,
            redirectUri: params.redirectUri,
        });
        res.redirect(302, buildRedirectUri(params.redirectUri, params, code));
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
        return this.issueTokens(client.client_id, payload.userId, payload.region);
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
        return this.issueTokens(client.client_id, row.user_id ?? 0, row.region);
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

    private async issueTokens(clientId: string, userId: number, region: Region): Promise<OAuthTokens> {
        const accessToken = signMcpAccessToken(clientId, userId, region);
        const refreshToken = generateRefreshToken();
        const expiresAt = new Date(Date.now() + MCP_REFRESH_TOKEN_TTL_SECONDS * 1000);
        await this.refreshTokenStore.create(clientId, userId, region, sha256Hex(refreshToken), expiresAt);
        logger.info({ clientId, userId, region }, 'MCP OAuth: tokens issued');
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
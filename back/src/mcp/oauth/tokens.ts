import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { env } from '../../config/env';
import type { Region } from '../../types/tenant';

// TTL courts : un access token volé est utilisable 1h max, un code d'autorisation
// 5 min (échangé immédiatement par le client OAuth). Le refresh token reste long.
export const MCP_ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
export const MCP_AUTH_CODE_TTL_SECONDS = 5 * 60;
export const MCP_REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

export const MCP_SCOPE = 'mcp:call';
const MCP_ACCESS_TOKEN_TYPE = 'mcp_access';
const MCP_AUTH_CODE_TYPE = 'mcp_auth_code';

export interface McpAccessTokenPayload {
    typ: typeof MCP_ACCESS_TOKEN_TYPE;
    clientId: string;
    sub: number;
    region: Region;
    scope: string[];
}

export interface McpAuthCodePayload {
    typ: typeof MCP_AUTH_CODE_TYPE;
    clientId: string;
    userId: number;
    region: Region;
    codeChallenge: string;
    redirectUri: string;
}

// Code d'autorisation stateless : signé JWT, zéro persistance (les cold starts /
// redémarrages de container ne peuvent pas le perdre). Le challenge PKCE y est
// encapsulé pour être re-exposé par `challengeForAuthorizationCode`, et
// l'identité (userId + region issue du consentement) y transite jusqu'à l'échange.
export function signAuthCode(payload: Omit<McpAuthCodePayload, 'typ'>): string {
    return jwt.sign({ typ: MCP_AUTH_CODE_TYPE, ...payload }, env.JWT_SECRET, {
        expiresIn: MCP_AUTH_CODE_TTL_SECONDS,
        algorithm: 'HS256',
    });
}

export function verifyAuthCode(token: string): McpAuthCodePayload | null {
    try {
        const payload = jwt.verify(token, env.JWT_SECRET) as McpAuthCodePayload & { typ?: string };
        return payload.typ === MCP_AUTH_CODE_TYPE ? payload : null;
    } catch {
        return null;
    }
}

// Access token stateless : vérifié à chaque tools/call par le middleware MCP sans
// lookup DB (idéal serveur persistant comme serverless). sub = users.id de la
// région `region` : c'est l'identité qui permettra de scoper les outils.
export function signMcpAccessToken(clientId: string, sub: number, region: Region): string {
    return jwt.sign(
        { typ: MCP_ACCESS_TOKEN_TYPE, clientId, sub, region, scope: [MCP_SCOPE] },
        env.JWT_SECRET,
        { expiresIn: MCP_ACCESS_TOKEN_TTL_SECONDS, algorithm: 'HS256' },
    );
}

export interface VerifiedAccessToken {
    clientId: string;
    userId: number;
    region: Region;
    expiresAt: number;
}

export function verifyMcpAccessToken(token: string): VerifiedAccessToken | null {
    try {
        const payload = jwt.verify(token, env.JWT_SECRET) as unknown as McpAccessTokenPayload & { exp: number };
        if (payload.typ !== MCP_ACCESS_TOKEN_TYPE || typeof payload.exp !== 'number') return null;
        if (typeof payload.sub !== 'number' || !isMcpRegion(payload.region)) return null;
        return { clientId: payload.clientId, userId: payload.sub, region: payload.region, expiresAt: payload.exp };
    } catch {
        return null;
    }
}

function isMcpRegion(value: unknown): value is Region {
    return value === 'reunion' || value === 'annemasse';
}

// Refresh token opaque : seul son hash sha256 est stocké en base (miroir de la
// table `refresh_tokens` existante). base64url = 64 caractères, entropie 384 bits.
export function generateRefreshToken(): string {
    return randomBytes(48).toString('base64url');
}
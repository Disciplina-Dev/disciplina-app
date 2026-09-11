import express from 'express';
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { env } from '../../config/env';
import { McpOAuthProvider } from './provider';
import { MCP_SCOPE } from './tokens';

/**
 * Router OAuth MCP à monter à la racine de l'app Express (exigence SDK : les
 * endpoints .well-known/authorize/token/register/revoke sont servis sur le
 * chemin racine de l'issuer).
 *
 * Un pré-hook sur POST /authorize dépose la clé soumise dans res.locals.mcpKey
 * (le handler du SDK n'expose pas le body à OAuthServerProvider.authorize, qui
 * ne reçoit que `res`).
 */
export function buildMcpOAuthRouter(): express.Router {
    const provider = new McpOAuthProvider();

    const consentHook = express.Router();
    consentHook.post('/authorize', express.urlencoded({ extended: false }), (req, res, next) => {
        const body = req.body as { mcp_key?: unknown } | undefined;
        res.locals.mcpKey = typeof body?.mcp_key === 'string' ? body.mcp_key : '';
        next();
    });

    const sdkRouter = mcpAuthRouter({
        provider,
        issuerUrl: new URL(env.MCP_OAUTH_ISSUER_URL),
        resourceServerUrl: new URL(`${env.MCP_OAUTH_ISSUER_URL}/api/mcp`),
        scopesSupported: [MCP_SCOPE],
        resourceName: 'Disciplina CRM',
    });

    return express.Router().use(consentHook).use(sdkRouter);
}
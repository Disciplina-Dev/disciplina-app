import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import { randomUUID } from 'crypto';
import { query } from '../../db/mysql/connection';
import { logger } from '../../external/logger';

interface McpOAuthClientRow {
    client_id: string;
    client_name: string | null;
    client_uri: string | null;
    logo_uri: string | null;
    redirect_uris: string;
    auth_method: string;
    scope: string | null;
    client_secret: string | null;
    client_id_issued_at: number | null;
    client_secret_expires_at: number | null;
}

function rowToClient(row: McpOAuthClientRow): OAuthClientInformationFull {
    const raw = row.redirect_uris;
    const redirect_uris: string[] = typeof raw === 'string' ? JSON.parse(raw) : (raw as unknown as string[]);
    const client: OAuthClientInformationFull = {
        client_id: row.client_id,
        redirect_uris,
        token_endpoint_auth_method: row.auth_method,
        scope: row.scope ?? undefined,
    };
    if (row.client_name) client.client_name = row.client_name;
    if (row.client_uri) client.client_uri = row.client_uri;
    if (row.logo_uri) client.logo_uri = row.logo_uri;
    if (row.client_secret) client.client_secret = row.client_secret;
    if (row.client_id_issued_at !== null) client.client_id_issued_at = row.client_id_issued_at;
    if (row.client_secret_expires_at !== null) client.client_secret_expires_at = row.client_secret_expires_at;
    return client;
}

// Persistance des clients OAuth enregistrés par DCR. Indispensable : le client
// est enregistré une seule fois par claude.ai, la table doit survivre aux
// redémarrages de container.
export class McpOAuthClientStore implements OAuthRegisteredClientsStore {
    async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
        const rows = await query<McpOAuthClientRow[]>(
            'SELECT client_id, client_name, client_uri, logo_uri, redirect_uris, auth_method, scope, client_secret, client_id_issued_at, client_secret_expires_at FROM mcp_oauth_clients WHERE client_id = ?',
            [clientId],
        );
        return rows.length > 0 ? rowToClient(rows[0]) : undefined;
    }

    async registerClient(client: OAuthClientInformationFull): Promise<OAuthClientInformationFull> {
        // Le handler /register du SDK a déjà posé client_id (UUID) et
        // client_secret le cas échéant ; on ne fait que persister.
        const registered = {
            ...client,
            client_id: client.client_id ?? randomUUID(),
        };
        await query(
            `INSERT INTO mcp_oauth_clients
                (client_id, client_name, client_uri, logo_uri, redirect_uris, auth_method, scope, client_secret, client_id_issued_at, client_secret_expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                registered.client_id,
                registered.client_name ?? null,
                registered.client_uri ?? null,
                registered.logo_uri ?? null,
                JSON.stringify(registered.redirect_uris),
                registered.token_endpoint_auth_method ?? 'none',
                registered.scope ?? null,
                registered.client_secret ?? null,
                registered.client_id_issued_at ?? null,
                registered.client_secret_expires_at ?? null,
            ],
        );
        logger.info({ clientId: registered.client_id }, 'MCP OAuth: client registered via DCR');
        return registered;
    }
}
import { query } from '../../db/mysql/connection';
import type { Region } from '../../types/tenant';

export interface McpOAuthRefreshTokenRow {
    id: number;
    client_id: string;
    user_id: number | null;
    region: Region;
    token_hash: string;
    expires_at: Date;
    revoked_at: Date | null;
}

// Miroir du RefreshTokenRepository applicatif (table `refresh_tokens`) mais pour
// les sessions OAuth MCP : token opaque haché sha256 (jamais stocké en clair),
// rotation à chaque échange, révocable. user_id + region : identité du compte
// CRM qui a autorisé la session — réinjectée dans l'access token au refresh.
export class McpOAuthRefreshTokenStore {
    async create(clientId: string, userId: number, region: Region, tokenHash: string, expiresAt: Date): Promise<void> {
        await query(
            'INSERT INTO mcp_oauth_refresh_tokens (client_id, user_id, region, token_hash, expires_at) VALUES (?, ?, ?, ?, ?)',
            [clientId, userId, region, tokenHash, expiresAt],
        );
    }

    async findValidByHash(clientId: string, tokenHash: string): Promise<McpOAuthRefreshTokenRow | null> {
        const rows = await query<McpOAuthRefreshTokenRow[]>(
            'SELECT * FROM mcp_oauth_refresh_tokens WHERE client_id = ? AND token_hash = ? AND revoked_at IS NULL AND expires_at > NOW()',
            [clientId, tokenHash],
        );
        return rows.length > 0 ? rows[0] : null;
    }

    async revokeByHash(clientId: string, tokenHash: string): Promise<void> {
        await query(
            'UPDATE mcp_oauth_refresh_tokens SET revoked_at = NOW() WHERE client_id = ? AND token_hash = ? AND revoked_at IS NULL',
            [clientId, tokenHash],
        );
    }

    // Purge des lignes expirées / révoquées depuis `graceDays` jours : sans elle
    // la table croît d'une ligne à chaque rotation de refresh token.
    async deleteExpired(graceDays: number): Promise<number> {
        const result = await query<{ affectedRows: number }>(
            `DELETE FROM mcp_oauth_refresh_tokens
             WHERE expires_at < NOW() - INTERVAL ? DAY
                OR revoked_at < NOW() - INTERVAL ? DAY`,
            [graceDays, graceDays],
        );
        return result.affectedRows;
    }
}
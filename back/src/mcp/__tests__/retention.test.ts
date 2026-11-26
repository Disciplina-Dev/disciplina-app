import { describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import pool from '../../db/mysql/connection';
import { McpAuditStore, AUDIT_RETENTION_DAYS } from '../auditStore';
import { McpOAuthClientStore } from '../oauth/clientStore';
import { McpOAuthRefreshTokenStore } from '../oauth/refreshTokenStore';

const MCP_ENDPOINT = `http://localhost:${env.API_PORT}/api/mcp`;

async function count(table: string): Promise<number> {
    const [rows] = await pool.query<any[]>(`SELECT COUNT(*) AS n FROM ${table}`);
    return Number(rows[0].n);
}

describe('MCP retention (RGPD Art. 5.1.e)', () => {
    beforeEach(async () => {
        await pool.query('DELETE FROM mcp_audit_log');
        await pool.query('DELETE FROM mcp_oauth_refresh_tokens');
        await pool.query('DELETE FROM mcp_oauth_clients');
    });

    it("purge le journal d'audit au-delà de la rétention", async () => {
        await pool.query(
            `INSERT INTO mcp_audit_log (user_id, tool, args_hash, status, created_at) VALUES
             (1, 'old', 'h', 'ok', NOW() - INTERVAL ? DAY), (1, 'recent', 'h', 'ok', NOW())`,
            [AUDIT_RETENTION_DAYS + 1],
        );
        expect(await new McpAuditStore().deleteOlderThan(AUDIT_RETENTION_DAYS)).toBe(1);
        expect(await count('mcp_audit_log')).toBe(1);
    });

    it('purge les refresh tokens expirés ou révoqués mais garde les actifs', async () => {
        await pool.query(
            `INSERT INTO mcp_oauth_refresh_tokens (client_id, user_id, token_hash, expires_at, revoked_at) VALUES
             ('c', 1, 'expired', NOW() - INTERVAL 40 DAY, NULL),
             ('c', 1, 'revoked', NOW() + INTERVAL 5 DAY, NOW() - INTERVAL 40 DAY),
             ('c', 1, 'active', NOW() + INTERVAL 5 DAY, NULL)`,
        );
        expect(await new McpOAuthRefreshTokenStore().deleteExpired(30)).toBe(2);
        const [rows] = await pool.query<any[]>('SELECT token_hash FROM mcp_oauth_refresh_tokens');
        expect(rows.map((r) => r.token_hash)).toEqual(['active']);
    });

    it('purge les clients OAuth inactifs depuis plus de 90 jours', async () => {
        await pool.query(
            `INSERT INTO mcp_oauth_clients (client_id, redirect_uris, created_at, last_used_at) VALUES
             ('stale', '[]', NOW() - INTERVAL 200 DAY, NOW() - INTERVAL 120 DAY),
             ('never', '[]', NOW() - INTERVAL 200 DAY, NULL),
             ('fresh', '[]', NOW() - INTERVAL 200 DAY, NOW() - INTERVAL 1 DAY)`,
        );
        expect(await new McpOAuthClientStore().deleteInactive(90)).toBe(2);
        const [rows] = await pool.query<any[]>('SELECT client_id FROM mcp_oauth_clients');
        expect(rows.map((r) => r.client_id)).toEqual(['fresh']);
    });
});

describe('MCP access token expiry', () => {
    it('refuse un access token expiré', async () => {
        const secret = env.MCP_JWT_SECRET ?? env.JWT_SECRET;
        const expired = jwt.sign(
            { typ: 'mcp_access', clientId: 'c', sub: 1, region: 'reunion', scope: ['mcp:call'] },
            secret,
            { expiresIn: -10, algorithm: 'HS256' },
        );
        const res = await fetch(MCP_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json, text/event-stream',
                Authorization: `Bearer ${expired}`,
            },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
        });
        expect(res.status).toBe(401);
    });
});

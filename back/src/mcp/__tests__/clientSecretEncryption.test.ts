import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { RowDataPacket } from 'mysql2';
import pool from '../../db/mysql/connection';
import { runMysqlMigrations } from '../../db/mysql/migrations';
import { McpOAuthClientStore } from '../oauth/clientStore';
import { isEncryptedToken } from '../../external/crypto/token-cipher';

// #1120 : client_secret DCR chiffré au repos (AES-256-GCM).
const SECRET = 'plain-secret-0123456789abcdef0123456789abcdef';
const CLIENT_ID = 'test-1120-client';

async function storedSecret(): Promise<string | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT client_secret FROM mcp_oauth_clients WHERE client_id = ?',
        [CLIENT_ID],
    );
    return rows[0]?.client_secret ?? null;
}

async function insertRaw(secret: string): Promise<void> {
    await pool.query(
        "INSERT INTO mcp_oauth_clients (client_id, redirect_uris, auth_method, client_secret) VALUES (?, '[\"http://localhost/cb\"]', 'client_secret_post', ?)",
        [CLIENT_ID, secret],
    );
}

beforeEach(async () => {
    await pool.query('DELETE FROM mcp_oauth_clients WHERE client_id = ?', [CLIENT_ID]);
});
afterEach(async () => {
    await pool.query('DELETE FROM mcp_oauth_clients WHERE client_id = ?', [CLIENT_ID]);
});

describe('MCP OAuth client_secret — chiffrement au repos', () => {
    it('stocke le secret chiffré et le restitue en clair via getClient', async () => {
        const store = new McpOAuthClientStore();
        await store.registerClient({
            client_id: CLIENT_ID,
            client_secret: SECRET,
            redirect_uris: ['http://localhost/cb'],
            token_endpoint_auth_method: 'client_secret_post',
        });

        const raw = await storedSecret();
        expect(raw).not.toBeNull();
        expect(raw).not.toContain(SECRET);
        expect(isEncryptedToken(raw as string)).toBe(true);

        const client = await store.getClient(CLIENT_ID);
        expect(client?.client_secret).toBe(SECRET);
    });

    it('lit encore un secret legacy en clair', async () => {
        await insertRaw(SECRET);
        const client = await new McpOAuthClientStore().getClient(CLIENT_ID);
        expect(client?.client_secret).toBe(SECRET);
    });

    it('la migration élargit la colonne et chiffre les secrets legacy, idempotente', async () => {
        await pool.query('ALTER TABLE mcp_oauth_clients MODIFY COLUMN client_secret VARCHAR(128) DEFAULT NULL');
        await insertRaw(SECRET);

        await runMysqlMigrations();

        const [cols] = await pool.query<RowDataPacket[]>(
            "SELECT CHARACTER_MAXIMUM_LENGTH AS len FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mcp_oauth_clients' AND COLUMN_NAME = 'client_secret'",
        );
        expect(Number(cols[0].len)).toBe(512);

        const first = await storedSecret();
        expect(isEncryptedToken(first as string)).toBe(true);
        expect(first).not.toContain(SECRET);

        await runMysqlMigrations();
        expect(await storedSecret()).toBe(first); // pas de double chiffrement

        const client = await new McpOAuthClientStore().getClient(CLIENT_ID);
        expect(client?.client_secret).toBe(SECRET);
    });
});

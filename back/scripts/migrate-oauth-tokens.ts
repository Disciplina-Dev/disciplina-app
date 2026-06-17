/**
 * Migration script: re-encrypt existing OAuth tokens with the new key.
 *
 * Background:
 * - Old key (leaked): 7325fd3fc113dc0034d98ee93eb9a50fc4c71d2798c819bc4e3f7e7e2fb7a940
 * - New key: environment variable OAUTH_ENCRYPTION_KEY
 *
 * This script:
 * 1. Connects to the database
 * 2. Finds all users with encrypted oauth_token or refresh_token
 * 3. Decrypts using the OLD key
 * 4. Re-encrypts using the NEW key
 * 5. Updates the database
 *
 * Usage:
 *   npm run build
 *   OLD_OAUTH_ENCRYPTION_KEY="7325fd3fc113dc0034d98ee93eb9a50fc4c71d2798c819bc4e3f7e7e2fb7a940" \
 *   OAUTH_ENCRYPTION_KEY="<new-key>" \
 *   node dist/scripts/migrate-oauth-tokens.js
 */

import mysql from 'mysql2/promise';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

// Read env vars
const oldKey = process.env.OLD_OAUTH_ENCRYPTION_KEY;
const newKey = process.env.OAUTH_ENCRYPTION_KEY;
const dbHost = process.env.MYSQL_HOST || 'localhost';
const dbUser = process.env.MYSQL_USER || 'root';
const dbPassword = process.env.MYSQL_ROOT_PASSWORD || '';
const dbName = process.env.MYSQL_DATABASE || 'disciplina';

if (!oldKey || !newKey) {
    console.error('❌ Missing environment variables:');
    if (!oldKey) console.error('  OLD_OAUTH_ENCRYPTION_KEY (old key to decrypt with)');
    if (!newKey) console.error('  OAUTH_ENCRYPTION_KEY (new key to encrypt with)');
    process.exit(1);
}

function isEncryptedToken(s: string): boolean {
    return /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/.test(s);
}

function decryptTokenWithKey(stored: string, keyHex: string): string {
    const parts = stored.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted token format');
    const [ivHex, tagHex, dataHex] = parts;
    const key = Buffer.from(keyHex, 'hex');
    const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return decipher.update(dataHex, 'hex', 'utf8') + decipher.final('utf8');
}

function encryptTokenWithKey(plain: string, keyHex: string): string {
    const key = Buffer.from(keyHex, 'hex');
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGO, key, iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

async function migrate() {
    const pool = mysql.createPool({
        host: dbHost,
        user: dbUser,
        password: dbPassword,
        database: dbName,
    });

    try {
        const conn = await pool.getConnection();

        // Find all users with encrypted tokens
        const [rows] = await conn.query(
            'SELECT id, oauth_token, refresh_token FROM users WHERE oauth_token IS NOT NULL AND oauth_token != "" OR refresh_token IS NOT NULL AND refresh_token != ""'
        );

        const users = rows as any[];
        let migrated = 0;

        for (const user of users) {
            let newOauthToken = user.oauth_token;
            let newRefreshToken = user.refresh_token;

            // Decrypt and re-encrypt oauth_token
            if (user.oauth_token && isEncryptedToken(user.oauth_token)) {
                try {
                    const plainToken = decryptTokenWithKey(user.oauth_token, oldKey);
                    newOauthToken = encryptTokenWithKey(plainToken, newKey);
                    console.log(`✅ Re-encrypted oauth_token for user ${user.id}`);
                } catch (err: any) {
                    console.error(`❌ Failed to re-encrypt oauth_token for user ${user.id}: ${err.message}`);
                    continue;
                }
            }

            // Decrypt and re-encrypt refresh_token
            if (user.refresh_token && isEncryptedToken(user.refresh_token)) {
                try {
                    const plainToken = decryptTokenWithKey(user.refresh_token, oldKey);
                    newRefreshToken = encryptTokenWithKey(plainToken, newKey);
                    console.log(`✅ Re-encrypted refresh_token for user ${user.id}`);
                } catch (err: any) {
                    console.error(`❌ Failed to re-encrypt refresh_token for user ${user.id}: ${err.message}`);
                    continue;
                }
            }

            // Update database
            if (newOauthToken !== user.oauth_token || newRefreshToken !== user.refresh_token) {
                await conn.query('UPDATE users SET oauth_token = ?, refresh_token = ? WHERE id = ?', [
                    newOauthToken,
                    newRefreshToken,
                    user.id,
                ]);
                migrated++;
            }
        }

        console.log(`\n✅ Migration complete: ${migrated}/${users.length} users updated`);
        await conn.release();
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();

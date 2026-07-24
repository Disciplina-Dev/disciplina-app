import { query } from '../../db/mysql/connection';
import { RefreshTokenRow } from '../../types/db-rows.types';

export class RefreshTokenRepository {
    async create(userId: number, tokenHash: string, expiresAt: Date): Promise<void> {
        await query('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)', [
            userId,
            tokenHash,
            expiresAt,
        ]);
    }

    async findValidByHash(tokenHash: string): Promise<RefreshTokenRow | null> {
        const rows = await query<RefreshTokenRow[]>(
            'SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > NOW()',
            [tokenHash],
        );
        return rows.length > 0 ? rows[0] : null;
    }

    async findByHash(tokenHash: string): Promise<RefreshTokenRow | null> {
        const rows = await query<RefreshTokenRow[]>('SELECT * FROM refresh_tokens WHERE token_hash = ?', [tokenHash]);
        return rows.length > 0 ? rows[0] : null;
    }

    async revokeById(id: number): Promise<void> {
        await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?', [id]);
    }

    async revokeAllForUser(userId: number): Promise<void> {
        await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL', [userId]);
    }
}

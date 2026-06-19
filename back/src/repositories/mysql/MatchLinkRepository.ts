import { query, getConnection } from '../../db/mysql/connection';
import { MatchLinkRow } from '../../types/db-rows.types';

export class MatchLinkRepository {
    async create(row: Omit<MatchLinkRow, 'status' | 'attempts' | 'created_at' | 'updated_at'>): Promise<void> {
        await query(
            `INSERT INTO match_link (signature, code, identifier, rh_email, company_email, job_uuid, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [row.signature, row.code, row.identifier, row.rh_email, row.company_email, row.job_uuid, row.expires_at],
        );
    }

    async findBySignature(signature: string): Promise<MatchLinkRow | null> {
        const rows = await query<MatchLinkRow[]>('SELECT * FROM match_link WHERE signature = ?', [signature]);
        return rows.length > 0 ? rows[0] : null;
    }

    async incrementAttempts(signature: string): Promise<number> {
        const conn = await getConnection();
        try {
            await conn.execute('UPDATE match_link SET attempts = attempts + 1 WHERE signature = ?', [signature]);
            const rows = (await conn.execute('SELECT attempts FROM match_link WHERE signature = ?', [signature]))[0];
            return Number((rows as { attempts: number }[])[0]?.attempts ?? 0);
        } finally {
            conn.release();
        }
    }

    async setStatus(signature: string, status: MatchLinkRow['status']): Promise<void> {
        await query('UPDATE match_link SET status = ? WHERE signature = ?', [status, signature]);
    }

    async regenerate(signature: string, code: string, identifier: string, expiresAt: Date): Promise<void> {
        await query(
            `UPDATE match_link
             SET code = ?, identifier = ?, expires_at = ?, attempts = 0, status = 'PENDING'
             WHERE signature = ?`,
            [code, identifier, expiresAt, signature],
        );
    }
}

import { query, getConnection } from '../../db/mysql/connection';
import { InterviewAccessRow } from '../../types/db-rows.types';

export class InterviewAccessRepository {
    async create(row: Omit<InterviewAccessRow, 'status' | 'attempts' | 'created_at' | 'updated_at'>): Promise<void> {
        await query(
            `INSERT INTO interview_access (signature, code, offer_uuid, candidate_id, rh_email, expires_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [row.signature, row.code, row.offer_uuid, row.candidate_id, row.rh_email, row.expires_at],
        );
    }

    async findBySignature(signature: string): Promise<InterviewAccessRow | null> {
        const rows = await query<InterviewAccessRow[]>('SELECT * FROM interview_access WHERE signature = ?', [
            signature,
        ]);
        return rows.length > 0 ? rows[0] : null;
    }

    async incrementAttempts(signature: string): Promise<number> {
        const conn = await getConnection();
        try {
            await conn.execute('UPDATE interview_access SET attempts = attempts + 1 WHERE signature = ?', [signature]);
            const rows = (
                await conn.execute('SELECT attempts FROM interview_access WHERE signature = ?', [signature])
            )[0];
            return Number((rows as { attempts: number }[])[0]?.attempts ?? 0);
        } finally {
            conn.release();
        }
    }

    async setStatus(signature: string, status: InterviewAccessRow['status']): Promise<void> {
        await query('UPDATE interview_access SET status = ? WHERE signature = ?', [status, signature]);
    }
}

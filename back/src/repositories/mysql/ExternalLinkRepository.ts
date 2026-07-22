import { query, getConnection } from '../../db/mysql/connection';
import { ExternalLinkRow } from '../../types/db-rows.types';

export class ExternalLinkRepository {
    async create(
        row: Omit<ExternalLinkRow, 'id' | 'status' | 'attempts' | 'created_at' | 'updated_at'>,
    ): Promise<void> {
        await query(
            `INSERT INTO external_link (signature, code, external_email, rh_email, guest_type, external_uuid, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                row.signature,
                row.code,
                row.external_email,
                row.rh_email,
                row.guest_type,
                row.external_uuid,
                row.expires_at,
            ],
        );
    }

    async findBySignature(signature: string): Promise<ExternalLinkRow | null> {
        const rows = await query<ExternalLinkRow[]>('SELECT * FROM external_link WHERE signature = ?', [signature]);
        return rows.length > 0 ? rows[0] : null;
    }

    async incrementAttempts(signature: string): Promise<number> {
        const conn = await getConnection();
        try {
            await conn.execute('UPDATE external_link SET attempts = attempts + 1 WHERE signature = ?', [signature]);
            const rows = (await conn.execute('SELECT attempts FROM external_link WHERE signature = ?', [signature]))[0];
            return Number((rows as { attempts: number }[])[0]?.attempts ?? 0);
        } finally {
            conn.release();
        }
    }

    async setStatus(signature: string, status: ExternalLinkRow['status']): Promise<void> {
        await query('UPDATE external_link SET status = ? WHERE signature = ?', [status, signature]);
    }
}

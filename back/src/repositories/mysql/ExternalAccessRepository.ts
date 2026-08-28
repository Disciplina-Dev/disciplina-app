import { query } from '../../db/mysql/connection';
import { ExternalAccessRow } from '../../types/db-rows.types';

type CreateExternalAccessRow = Omit<ExternalAccessRow, 'created_at' | 'updated_at'>;

export class ExternalAccessRepository {
    async findBySignature(signature: string): Promise<ExternalAccessRow | null> {
        const rows = await query<ExternalAccessRow[]>(
            'SELECT * FROM external_access WHERE signature = ?',
            [signature],
        );
        return rows.length > 0 ? rows[0] : null;
    }

    async create(row: CreateExternalAccessRow): Promise<void> {
        await query(
            `INSERT INTO external_access
                (signature, code, user_id, external_id, external_type, external_email, external_first_name, reference_id, reference_key, status, attempts, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                row.signature,
                row.code,
                row.user_id,
                row.external_id,
                row.external_type,
                row.external_email,
                row.external_first_name,
                row.reference_id,
                row.reference_key,
                row.status,
                row.attempts,
                row.expires_at,
            ],
        );
    }

    async setStatus(
        signature: string,
        status: ExternalAccessRow['status'],
    ): Promise<void> {
        await query('UPDATE external_access SET status = ? WHERE signature = ?', [
            status,
            signature,
        ]);
    }

    async setToken(signature: string, token: string): Promise<void> {
        await query('UPDATE external_access SET token = ? WHERE signature = ?', [
            token,
            signature,
        ]);
    }

    async setCode(signature: string, code: string): Promise<void> {
        await query('UPDATE external_access SET code = ? WHERE signature = ?', [
            code,
            signature,
        ]);
    }

    async delete(signature: string): Promise<void> {
        await query('DELETE FROM external_access WHERE signature = ?', [signature]);
    }

    async incrementAttempts(signature: string): Promise<number> {
        await query(
            'UPDATE external_access SET attempts = attempts + 1 WHERE signature = ?',
            [signature],
        );
        const rows = await query<ExternalAccessRow[]>(
            'SELECT attempts FROM external_access WHERE signature = ?',
            [signature],
        );
        return rows.length > 0 ? rows[0].attempts : 0;
    }
}

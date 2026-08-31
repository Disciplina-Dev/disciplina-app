import { query } from '../../db/mysql/connection';
import { ExternalAccessRow } from '../../types/db-rows.types';
import { DEFAULT_PAGE_SIZE, decodeCursor } from '../../services/pagination';

export const encodeExternalAccessCursor = (createdAt: string | Date, signature: string): string =>
    Buffer.from(`${new Date(createdAt).toISOString()}|${signature}`).toString('base64');

type CreateExternalAccessRow = Omit<ExternalAccessRow, 'created_at' | 'updated_at'>;

export interface ExternalAccessFilter {
    first?: number;
    after?: string | null;
    search?: string | null;
    types?: string[];
    statuses?: string[];
    userId?: number | null;
}

export interface ExternalAccessListRow extends ExternalAccessRow {
    creator_first_name: string;
    creator_last_name: string;
}

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

    async deleteExpired(graceDays: number): Promise<number> {
        const result = await query('DELETE FROM external_access WHERE expires_at < NOW() - INTERVAL ? DAY', [
            graceDays,
        ]);
        return (result as unknown as { affectedRows: number }).affectedRows;
    }

    async findAllFiltered(filter: ExternalAccessFilter = {}): Promise<ExternalAccessListRow[]> {
        const conditions: string[] = [];
        const params: unknown[] = [];

        if (filter.search?.trim()) {
            conditions.push('LOWER(ea.external_first_name) LIKE ?');
            params.push(`%${filter.search.trim().toLowerCase()}%`);
        }

        if (filter.types && filter.types.length > 0) {
            conditions.push(`ea.external_type IN (${filter.types.map(() => '?').join(', ')})`);
            params.push(...filter.types);
        }

        if (filter.statuses && filter.statuses.length > 0) {
            conditions.push(`ea.status IN (${filter.statuses.map(() => '?').join(', ')})`);
            params.push(...filter.statuses);
        }

        if (filter.userId != null) {
            conditions.push('ea.user_id = ?');
            params.push(filter.userId);
        }

        if (filter.after) {
            const [createdAt, signature] = decodeCursor(filter.after).split('|');
            conditions.push('(ea.created_at, ea.signature) > (?, ?)');
            params.push(createdAt, signature);
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const limit = Math.max(1, Math.floor(Number(filter.first ?? DEFAULT_PAGE_SIZE)) + 1);

        return query<ExternalAccessListRow[]>(
            `SELECT ea.*, u.first_name AS creator_first_name, u.last_name AS creator_last_name
             FROM external_access ea
             JOIN users u ON u.id = ea.user_id
             ${where}
             ORDER BY ea.created_at DESC, ea.signature DESC
             LIMIT ${limit}`,
            params,
        );
    }
}

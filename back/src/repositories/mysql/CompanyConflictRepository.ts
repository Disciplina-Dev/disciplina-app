import { query, getConnection } from '../../db/mysql/connection';
import { CompanyConflictRow } from '../../types/db-rows.types';
import { DEFAULT_PAGE_SIZE, decodeCursor } from '../../services/pagination';

export class CompanyConflictRepository {
    async findAll(
        first: number = DEFAULT_PAGE_SIZE,
        after?: string,
        search?: string,
        conflictType?: string,
    ): Promise<CompanyConflictRow[]> {
        const conclusionFilter = conflictType ? `Conflit : ${conflictType}` : undefined;

        if (search?.trim()) {
            const pattern = `%${search.trim()}%`;
            const conditions = ['(name LIKE ? OR siret LIKE ?)'];
            const params: unknown[] = [pattern, pattern];
            if (conclusionFilter) {
                conditions.push('conclusion = ?');
                params.push(conclusionFilter);
            }
            return query<CompanyConflictRow[]>(
                `SELECT * FROM company_conflict WHERE ${conditions.join(' AND ')} ORDER BY id`,
                params,
            );
        }

        const conditions: string[] = [];
        const params: unknown[] = [];

        if (after) {
            const decodedId = Math.floor(Number(decodeCursor(after)));
            conditions.push('id > ?');
            params.push(decodedId);
        }
        if (conclusionFilter) {
            conditions.push('conclusion = ?');
            params.push(conclusionFilter);
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const limit = Math.max(1, Math.floor(Number(first)) + 1);
        return query<CompanyConflictRow[]>(`SELECT * FROM company_conflict ${where} ORDER BY id LIMIT ${limit}`, params);
    }

    async findById(id: number): Promise<CompanyConflictRow | null> {
        const results = await query<CompanyConflictRow[]>('SELECT * FROM company_conflict WHERE id = ?', [id]);
        return results.length > 0 ? results[0] : null;
    }

    async update(id: number, data: Partial<CompanyConflictRow>): Promise<boolean> {
        const conn = await getConnection();
        try {
            const cleaned = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
            if (Object.keys(cleaned).length === 0) return false;
            const sets = Object.keys(cleaned)
                .map((key) => `${key} = ?`)
                .join(', ');
            const values = [...Object.values(cleaned), id];
            const result = await conn.execute(`UPDATE company_conflict SET ${sets} WHERE id = ?`, values);
            return (result[0] as any).affectedRows > 0;
        } finally {
            conn.release();
        }
    }

    async delete(id: number): Promise<boolean> {
        const conn = await getConnection();
        try {
            const result = await conn.execute('DELETE FROM company_conflict WHERE id = ?', [id]);
            return (result[0] as any).affectedRows > 0;
        } finally {
            conn.release();
        }
    }

    async deleteByConclusion(conclusion: string): Promise<number> {
        const conn = await getConnection();
        try {
            const result = await conn.execute('DELETE FROM company_conflict WHERE conclusion = ?', [conclusion]);
            return (result[0] as any).affectedRows as number;
        } finally {
            conn.release();
        }
    }
}

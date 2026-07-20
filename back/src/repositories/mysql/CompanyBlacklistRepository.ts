import { query, getConnection } from '../../db/mysql/connection';
import { buildInsert } from '../../db/mysql/queryBuilder';
import { CompaniesBlacklistRow } from '../../types/db-rows.types';
import { DEFAULT_PAGE_SIZE, decodeCursor } from '../../services/pagination';

export class CompanyBlacklistRepository {
    async findBySiren(siren: string): Promise<CompaniesBlacklistRow[]> {
        return query<CompaniesBlacklistRow[]>('SELECT * FROM companies_blacklist WHERE siret LIKE ?', [`${siren}%`]);
    }

    async findBySiret(siret: string): Promise<CompaniesBlacklistRow | null> {
        const results = await query<CompaniesBlacklistRow[]>('SELECT * FROM companies_blacklist WHERE siret = ?', [
            siret,
        ]);
        return results.length > 0 ? results[0] : null;
    }

    async findAll(
        first: number = DEFAULT_PAGE_SIZE,
        after?: string,
        search?: string,
    ): Promise<CompaniesBlacklistRow[]> {
        if (search?.trim()) {
            const pattern = `%${search.trim()}%`;
            return query<CompaniesBlacklistRow[]>(
                'SELECT * FROM companies_blacklist WHERE name LIKE ? OR siret LIKE ? ORDER BY id',
                [pattern, pattern],
            );
        }

        const conditions: string[] = [];
        const params: unknown[] = [];

        if (after) {
            const decodedId = Math.floor(Number(decodeCursor(after)));
            conditions.push('id > ?');
            params.push(decodedId);
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const limit = Math.max(1, Math.floor(Number(first)) + 1);
        return query<CompaniesBlacklistRow[]>(
            `SELECT * FROM companies_blacklist ${where} ORDER BY id LIMIT ${limit}`,
            params,
        );
    }

    async findById(id: number): Promise<CompaniesBlacklistRow | null> {
        const results = await query<CompaniesBlacklistRow[]>('SELECT * FROM companies_blacklist WHERE id = ?', [id]);
        return results.length > 0 ? results[0] : null;
    }

    async delete(id: number): Promise<boolean> {
        const conn = await getConnection();
        try {
            const result = await conn.execute('DELETE FROM companies_blacklist WHERE id = ?', [id]);
            return (result[0] as any).affectedRows > 0;
        } finally {
            conn.release();
        }
    }

    async create(data: Partial<CompaniesBlacklistRow>): Promise<number> {
        const conn = await getConnection();
        try {
            const { sql, values } = buildInsert('companies_blacklist', data);
            const result = await conn.execute(sql, values);
            return (result[0] as any).insertId;
        } finally {
            conn.release();
        }
    }
}

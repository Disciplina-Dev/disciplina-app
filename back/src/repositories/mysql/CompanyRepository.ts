import { query, getConnection } from '../../db/mysql/connection';
import { CompaniesRow } from '../../types/db-rows.types';
import { DEFAULT_PAGE_SIZE, decodeCursor } from '../../services/pagination';

export class CompanyRepository {
    async findAll(first: number = DEFAULT_PAGE_SIZE, after?: string, search?: string): Promise<CompaniesRow[]> {
        if (search && search.trim()) {
            const pattern = `%${search.trim()}%`;
            return query<CompaniesRow[]>('SELECT * FROM companies WHERE name LIKE ? OR siret LIKE ? ORDER BY id', [
                pattern,
                pattern,
            ]);
        }
        const limit = (first + 1).toString();
        if (after) {
            const decodedId = Math.floor(Number(decodeCursor(after)));
            return query<CompaniesRow[]>('SELECT * FROM companies WHERE id > ? ORDER BY id LIMIT ?', [
                decodedId,
                limit,
            ]);
        }
        return query<CompaniesRow[]>('SELECT * FROM companies ORDER BY id LIMIT ?', [limit]);
    }

    async findByCommercial(userID: number): Promise<CompaniesRow[]> {
        return query<CompaniesRow[]>('SELECT * FROM companies WHERE user_id = ?', [userID]);
    }

    async findBySiret(siret: string): Promise<CompaniesRow | null> {
        const sql = siret.includes('%')
            ? 'SELECT * FROM companies WHERE siret LIKE ?'
            : 'SELECT * FROM companies WHERE siret = ?';
        const results = await query<CompaniesRow[]>(sql, [siret]);
        return results.length > 0 ? results[0] : null;
    }

    async findBySirets(sirets: string[]): Promise<CompaniesRow[]> {
        if (sirets.length === 0) return [];
        const placeholders = sirets.map(() => '?').join(', ');
        return query<CompaniesRow[]>(`SELECT * FROM companies WHERE siret IN (${placeholders})`, sirets);
    }

    async findById(id: number): Promise<CompaniesRow | null> {
        const results = await query<CompaniesRow[]>('SELECT * FROM companies WHERE id = ?', [id]);
        return results.length > 0 ? results[0] : null;
    }

    async create(data: Partial<CompaniesRow>): Promise<number> {
        const conn = await getConnection();
        try {
            const fields = Object.keys(data).join(', ');
            const placeholders = Object.keys(data)
                .map(() => '?')
                .join(', ');
            const values = Object.values(data);
            const result = await conn.execute(`INSERT INTO companies (${fields}) VALUES (${placeholders})`, values);
            return (result[0] as any).insertId;
        } finally {
            conn.release();
        }
    }

    async update(id: number, data: Partial<CompaniesRow>): Promise<boolean> {
        const conn = await getConnection();
        try {
            const cleaned = Object.fromEntries(Object.entries(data).filter(([_, v]) => v != null));
            const sets = Object.keys(cleaned)
                .map((key) => `${key} = ?`)
                .join(', ');
            const values = [...Object.values(cleaned), id];
            const result = await conn.execute(`UPDATE companies SET ${sets} WHERE id = ?`, values);
            return (result[0] as any).affectedRows > 0;
        } finally {
            conn.release();
        }
    }

    async delete(id: number): Promise<boolean> {
        const conn = await getConnection();
        try {
            const result = await conn.execute('DELETE FROM companies WHERE id = ?', [id]);
            return (result[0] as any).affectedRows > 0;
        } finally {
            conn.release();
        }
    }
}

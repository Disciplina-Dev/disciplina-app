import { query, getConnection } from '../../db/mysql/connection';
import { CompaniesRow } from '../../types/db-rows.types';
import { DEFAULT_PAGE_SIZE, decodeCursor } from '../../services/pagination';

const ALLOWED_STATUSES = new Set(['Oui', 'Non', 'À Réfléchir', 'Relance', 'Réponds pas', 'Fermé']);
const ALLOWED_RELANCE = new Set(['today', 'past', 'future']);
const ALLOWED_SECTORS = new Set(['Nord-Est', 'Ouest', 'Sud']);

export interface CompanyFilters {
    status?: string[];
    userID?: number | null;
    sector?: string | null;
    relance?: string | null;
    unassigned?: boolean | null;
    createdFrom?: string | null;
    createdTo?: string | null;
}

export class CompanyRepository {
    async findAll(first: number = DEFAULT_PAGE_SIZE, after?: string, search?: string, filters?: CompanyFilters): Promise<CompaniesRow[]> {
        if (search?.trim()) {
            const pattern = `%${search.trim()}%`;
            return query<CompaniesRow[]>('SELECT * FROM companies WHERE name LIKE ? OR siret LIKE ? ORDER BY id', [
                pattern,
                pattern,
            ]);
        }

        const conditions: string[] = [];
        const params: unknown[] = [];

        if (filters?.status?.length) {
            const valid = filters.status.filter(s => ALLOWED_STATUSES.has(s));
            if (valid.length) {
                conditions.push(`status IN (${valid.map(() => '?').join(', ')})`);
                params.push(...valid);
            }
        }

        if (filters?.unassigned) {
            conditions.push('user_id IS NULL');
        } else if (filters?.userID != null) {
            conditions.push('user_id = ?');
            params.push(filters.userID);
        }

        if (filters?.sector && ALLOWED_SECTORS.has(filters.sector)) {
            conditions.push('sector = ?');
            params.push(filters.sector);
        }

        const relance = filters?.relance && ALLOWED_RELANCE.has(filters.relance) ? filters.relance : null;
        if (relance === 'today') {
            conditions.push('DATE(relance_date) = CURDATE()');
        } else if (relance === 'past') {
            conditions.push('relance_date < CURDATE()');
        } else if (relance === 'future') {
            conditions.push('relance_date > CURDATE()');
        }

        if (filters?.createdFrom) {
            conditions.push('DATE(created_at) >= ?');
            params.push(filters.createdFrom);
        }
        if (filters?.createdTo) {
            conditions.push('DATE(created_at) <= ?');
            params.push(filters.createdTo);
        }

        // Relance mode: return all sorted results, no cursor pagination
        if (relance) {
            const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
            const orderBy = relance === 'past'
                ? 'ORDER BY relance_date DESC, id'
                : 'ORDER BY relance_date ASC, id';
            return query<CompaniesRow[]>(`SELECT * FROM companies ${where} ${orderBy}`, params);
        }

        // Cursor pagination
        if (after) {
            const decodedId = Math.floor(Number(decodeCursor(after)));
            conditions.push('id > ?');
            params.push(decodedId);
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const limit = Math.max(1, Math.floor(Number(first)) + 1);
        return query<CompaniesRow[]>(`SELECT * FROM companies ${where} ORDER BY id LIMIT ${limit}`, params);
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

import { set } from 'mongoose';
import { query, getConnection } from '../../db/mysql/connection';
import { CompaniesRow } from '../../types/db-rows.types';

export class CompanyRepository {
    async findAll(): Promise<CompaniesRow[]> {
        return query<CompaniesRow[]>('SELECT * FROM companies');
    }

    async findByCommercial(userID: number): Promise<CompaniesRow[]> {
        return query<CompaniesRow[]>('SELECT * FROM companies WHERE user_id = ?', [userID]);
    }

    async findBySiret(siret: string): Promise<CompaniesRow | null> {
        const results = await query<CompaniesRow[]>('SELECT * FROM companies WHERE siret = ?', [siret]);
        return results.length > 0 ? results[0] : null;
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

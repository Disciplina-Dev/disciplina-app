import { query, getConnection } from '../../db/mysql/connection';
import { CompaniesBlacklistRow } from '../../types/db-rows.types';

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

    async create(data: Partial<CompaniesBlacklistRow>): Promise<number> {
        const conn = await getConnection();
        try {
            const fields = Object.keys(data).join(', ');
            const placeholders = Object.keys(data)
                .map(() => '?')
                .join(', ');
            const values = Object.values(data);
            const result = await conn.execute(
                `INSERT INTO companies_blacklist (${fields}) VALUES (${placeholders})`,
                values,
            );
            return (result[0] as any).insertId;
        } finally {
            conn.release();
        }
    }
}

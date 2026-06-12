import { query, getConnection } from '../../db/mysql/connection';
import { CompanyHistoryRow } from '../../types/db-rows.types';

export class CompanyHistoryRepository {
    async create(data: Partial<CompanyHistoryRow>): Promise<number> {
        const conn = await getConnection();
        try {
            const fields = Object.keys(data).join(', ');
            const placeholders = Object.keys(data)
                .map(() => '?')
                .join(', ');
            const values = Object.values(data);
            const result = await conn.execute(
                `INSERT INTO company_history (${fields}) VALUES (${placeholders})`,
                values,
            );
            return (result[0] as any).insertId;
        } finally {
            conn.release();
        }
    }

    async findByCompanyId(companyID: number): Promise<CompanyHistoryRow[]> {
        return query<CompanyHistoryRow[]>(
            'SELECT * FROM company_history WHERE company_id = ? ORDER BY updated_at DESC',
            [companyID],
        );
    }
}

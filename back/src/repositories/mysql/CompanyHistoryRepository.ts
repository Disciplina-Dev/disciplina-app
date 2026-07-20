import { query, getConnection } from '../../db/mysql/connection';
import { buildInsert } from '../../db/mysql/queryBuilder';
import { CompanyHistoryRow } from '../../types/db-rows.types';

export class CompanyHistoryRepository {
    async create(data: Partial<CompanyHistoryRow>): Promise<number> {
        const conn = await getConnection();
        try {
            const { sql, values } = buildInsert('company_history', data);
            const result = await conn.execute(sql, values);
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

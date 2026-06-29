import { query, getConnection } from '../../db/mysql/connection';
import { RelanceHistoryRow } from '../../types/db-rows.types';

export interface CreateRelanceHistoryInput {
    companyID: number;
    userID: number | null;
    typeRelance: number | null;
    channel: 'PHONE' | 'MAIL';
    subject?: string | null;
    note?: string | null;
}

export class RelanceHistoryRepository {
    async create(data: CreateRelanceHistoryInput): Promise<number> {
        const conn = await getConnection();
        try {
            const result = await conn.execute(
                `INSERT INTO relance_history (company_id, user_id, type_relance, channel, subject, note)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [data.companyID, data.userID, data.typeRelance, data.channel, data.subject ?? null, data.note ?? null],
            );
            return (result[0] as any).insertId;
        } finally {
            conn.release();
        }
    }

    async findByCompanyId(companyID: number): Promise<RelanceHistoryRow[]> {
        return query<RelanceHistoryRow[]>(
            'SELECT * FROM relance_history WHERE company_id = ? ORDER BY created_at DESC',
            [companyID],
        );
    }
}

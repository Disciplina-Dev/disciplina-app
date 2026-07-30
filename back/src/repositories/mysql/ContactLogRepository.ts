import { query, getConnection } from '../../db/mysql/connection';
import { ContactLogRow } from '../../types/db-rows.types';

export class ContactLogRepository {
    async create(companyID: number, userID: number, comment: string): Promise<number> {
        const conn = await getConnection();
        try {
            const result = await conn.execute(
                'INSERT INTO contact_logs (company_id, user_id, comment) VALUES (?, ?, ?)',
                [companyID, userID, comment],
            );
            return (result[0] as any).insertId;
        } finally {
            conn.release();
        }
    }

    async findById(id: number): Promise<ContactLogRow | null> {
        const rows = await query<ContactLogRow[]>('SELECT * FROM contact_logs WHERE id = ?', [id]);
        return rows[0] ?? null;
    }

    /** Logs d'une entreprise. `userID` restreint aux logs d'un commercial donné. */
    async findByCompanyId(companyID: number, userID?: number): Promise<ContactLogRow[]> {
        if (userID != null) {
            return query<ContactLogRow[]>(
                'SELECT * FROM contact_logs WHERE company_id = ? AND user_id = ? ORDER BY created_at DESC',
                [companyID, userID],
            );
        }
        return query<ContactLogRow[]>('SELECT * FROM contact_logs WHERE company_id = ? ORDER BY created_at DESC', [
            companyID,
        ]);
    }

    async countByCompany(companyID: number): Promise<number> {
        const rows = await query<{ count: number }[]>(
            'SELECT COUNT(*) AS count FROM contact_logs WHERE company_id = ?',
            [companyID],
        );
        return Number(rows[0]?.count ?? 0);
    }

    async countAll(): Promise<number> {
        const rows = await query<{ count: number }[]>('SELECT COUNT(*) AS count FROM contact_logs');
        return Number(rows[0]?.count ?? 0);
    }

    async countByUser(): Promise<{ user_id: number; count: number }[]> {
        return query<{ user_id: number; count: number }[]>(
            'SELECT user_id, COUNT(*) AS count FROM contact_logs GROUP BY user_id',
        );
    }
}

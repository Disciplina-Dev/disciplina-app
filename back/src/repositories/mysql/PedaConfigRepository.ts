import { query } from '../../db/mysql/connection';

export interface PedaConfigRow {
    user_id: number;
    sheet_id: string;
    created_at?: string | Date;
    updated_at?: string | Date;
}

export class PedaConfigRepository {
    async findByUserId(userId: number): Promise<PedaConfigRow | null> {
        const rows = await query<PedaConfigRow[]>('SELECT * FROM peda_config WHERE user_id = ?', [userId]);
        return rows[0] ?? null;
    }

    async findAll(): Promise<PedaConfigRow[]> {
        return query<PedaConfigRow[]>('SELECT * FROM peda_config');
    }

    async upsert(userId: number, sheetId: string): Promise<void> {
        await query(
            `INSERT INTO peda_config (user_id, sheet_id) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE sheet_id = VALUES(sheet_id)`,
            [userId, sheetId],
        );
    }

    async remove(userId: number): Promise<void> {
        await query('DELETE FROM peda_config WHERE user_id = ?', [userId]);
    }
}

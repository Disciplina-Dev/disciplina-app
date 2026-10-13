import { query } from '../../db/mysql/connection';

export interface CreatePedaDraftHistoryInput {
    dedupKey: string;
    userId: number | null;
    level: string;
    recipient: string;
}

export class PedaDraftHistoryRepository {
    async exists(dedupKey: string): Promise<boolean> {
        const rows = await query<{ id: number }[]>('SELECT id FROM peda_draft_history WHERE dedup_key = ? LIMIT 1', [
            dedupKey,
        ]);
        return rows.length > 0;
    }

    /** Insertion idempotente : renvoie false si la clé existait déjà (brouillon déjà généré). */
    async create(data: CreatePedaDraftHistoryInput): Promise<boolean> {
        const result = await query<{ affectedRows: number }>(
            `INSERT IGNORE INTO peda_draft_history (dedup_key, user_id, level, recipient)
             VALUES (?, ?, ?, ?)`,
            [data.dedupKey, data.userId, data.level, data.recipient],
        );
        return (result as unknown as { affectedRows: number }).affectedRows > 0;
    }

    /** Volume de brouillons générés par niveau et par mois (agrégat, sans destinataire). */
    async countByLevelAndMonth(year: number): Promise<Array<{ level: string; month: number; count: number }>> {
        const rows = await query<Array<{ level: string; month: number; count: number }>>(
            `SELECT level, MONTH(created_at) AS month, COUNT(*) AS count
             FROM peda_draft_history
             WHERE YEAR(created_at) = ?
             GROUP BY level, MONTH(created_at)
             ORDER BY month, level`,
            [year],
        );
        return rows.map((r) => ({ level: r.level, month: Number(r.month), count: Number(r.count) }));
    }
}

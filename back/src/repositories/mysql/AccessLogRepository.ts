import { query } from '../../db/mysql/connection';
import { AccessEventInput, AccessLogEntry } from '../../types/accessLog.types';
import { AccessLogRow } from '../../types/db-rows.types';

/**
 * Journal d'accès aux données candidat (GDPR_INF_06.5). Ajout seul côté
 * applicatif : la seule suppression est la purge de rétention.
 *
 * Les dates passent par UNIX_TIMESTAMP pour ne pas dépendre du fuseau de
 * session MySQL (le pool est en `dateStrings`).
 */
export class AccessLogRepository {
    async insert(event: AccessEventInput): Promise<void> {
        await query(
            `INSERT INTO candidate_access_log (candidate_id, actor_id, actor_type, action, result_count)
             VALUES (?, ?, ?, ?, ?)`,
            [event.candidateId, event.actorId, event.actorType, event.action, event.resultCount ?? 1],
        );
    }

    async findByCandidate(candidateId: string, limit: number): Promise<AccessLogEntry[]> {
        const rows = await query<AccessLogRow[]>(
            `SELECT l.id, l.candidate_id, l.actor_id,
                    NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), '') AS actor_name,
                    l.actor_type, l.action, l.result_count,
                    UNIX_TIMESTAMP(l.created_at) AS created_at_epoch
             FROM candidate_access_log l
             LEFT JOIN users u ON u.id = l.actor_id
             WHERE l.candidate_id = ?
             ORDER BY l.created_at DESC, l.id DESC
             LIMIT ?`,
            [candidateId, limit],
        );
        return rows.map(toEntry);
    }

    async deleteOlderThan(days: number): Promise<number> {
        const result = await query<{ affectedRows: number }>(
            'DELETE FROM candidate_access_log WHERE created_at < NOW() - INTERVAL ? DAY',
            [days],
        );
        return result.affectedRows;
    }
}

function toEntry(row: AccessLogRow): AccessLogEntry {
    return {
        id: Number(row.id),
        candidateId: row.candidate_id,
        actorId: row.actor_id === null ? null : Number(row.actor_id),
        actorName: row.actor_name,
        actorType: row.actor_type,
        action: row.action,
        resultCount: Number(row.result_count),
        createdAt: new Date(Number(row.created_at_epoch) * 1000),
    };
}

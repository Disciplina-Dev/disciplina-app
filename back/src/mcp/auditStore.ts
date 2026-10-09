import { createHash } from 'node:crypto';
import { query } from '../db/mysql/connection';

// Journal d'accès MCP (RGPD Art. 5.2 / 30 / 32, cf. MCP_RGPD_AUDIT.md M4-M5) :
// qui (user_id) a appelé quel outil, sur quelle fiche, combien d'enregistrements
// sont sortis. Jamais de résultat ni d'argument en clair (hash uniquement).
export const AUDIT_RETENTION_DAYS = 365;

export interface McpAuditEntry {
    userId: number;
    clientId: string | null;
    tool: string;
    subjectRef: string | null;
    argsHash: string;
    resultCount: number;
    status: 'ok' | 'error' | 'denied' | 'quota';
}

// Clés d'arguments qui désignent une fiche précise (consultation nominative).
const SUBJECT_KEYS = ['id', 'companyId', 'candidateId', 'offerId', 'siret'];

export function hashArgs(args: unknown): string {
    return createHash('sha256')
        .update(JSON.stringify(args ?? {}))
        .digest('hex')
        .slice(0, 32);
}

export function subjectRef(args: unknown): string | null {
    if (!args || typeof args !== 'object') return null;
    const record = args as Record<string, unknown>;
    for (const key of SUBJECT_KEYS) {
        const value = record[key];
        if (typeof value === 'string' || typeof value === 'number') return `${key}:${String(value).slice(0, 64)}`;
    }
    return null;
}

export class McpAuditStore {
    async record(entry: McpAuditEntry): Promise<void> {
        await query(
            `INSERT INTO mcp_audit_log (user_id, client_id, tool, subject_ref, args_hash, result_count, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                entry.userId,
                entry.clientId,
                entry.tool,
                entry.subjectRef,
                entry.argsHash,
                entry.resultCount,
                entry.status,
            ],
        );
    }

    /** Appels réussis et enregistrements sortis par cet utilisateur sur les dernières 24 h. */
    async usageLast24h(userId: number): Promise<{ calls: number; records: number }> {
        const rows = await query<{ calls: number; records: number | null }[]>(
            `SELECT COUNT(*) AS calls, COALESCE(SUM(result_count), 0) AS records
             FROM mcp_audit_log
             WHERE user_id = ? AND status = 'ok' AND created_at > NOW() - INTERVAL 1 DAY`,
            [userId],
        );
        return { calls: Number(rows[0]?.calls ?? 0), records: Number(rows[0]?.records ?? 0) };
    }

    async deleteOlderThan(days: number): Promise<number> {
        const result = await query<{ affectedRows: number }>(
            'DELETE FROM mcp_audit_log WHERE created_at < NOW() - INTERVAL ? DAY',
            [days],
        );
        return result.affectedRows;
    }
}

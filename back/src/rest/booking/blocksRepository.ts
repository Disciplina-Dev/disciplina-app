import { query } from '../../db/mysql/connection';

/** Portée d'un blocage de date : un seul RH ('SELF') ou tout le monde ('ALL'). */
export type DayBlockScope = 'SELF' | 'ALL';

/**
 * Ligne `calendar_day_blocks`.
 * - `BLOCK` : le jour est bloqué (user_id NULL = pour tout le monde).
 * - `OPEN` : dérogation personnelle (« me rendre disponible ») qui annule un
 *   blocage global pour ce seul utilisateur — toujours avec `user_id` renseigné.
 */
export interface DayBlockRow {
    id: number;
    /** Date locale `YYYY-MM-DD` (la connexion est en `dateStrings: true`). */
    day: string;
    user_id: number | null;
    kind: 'BLOCK' | 'OPEN';
    reason: string;
    created_by: number | null;
    created_at: string;
}

interface DayBlockJoinedRow extends DayBlockRow {
    created_by_name: string | null;
}

/** Blocage tel qu'exposé à l'API (une ligne = un jour). */
export interface DayBlock {
    id: number;
    day: string;
    scope: DayBlockScope;
    reason: string;
    createdByName: string | null;
    createdAt: string;
    /** Blocage global dont l'utilisateur courant s'est rendu disponible. */
    releasedForMe?: boolean;
}

export class DayBlockRepository {
    /** Blocages visibles par `userId` : les siens + les blocages globaux. */
    async findVisible(userId: number, from?: string, to?: string): Promise<DayBlock[]> {
        const filters = ["b.kind = 'BLOCK'", '(b.user_id IS NULL OR b.user_id = ?)'];
        const params: unknown[] = [userId];
        if (from) {
            filters.push('b.day >= ?');
            params.push(from);
        }
        if (to) {
            filters.push('b.day <= ?');
            params.push(to);
        }
        const rows = await query<DayBlockJoinedRow[]>(
            `SELECT b.id, b.day, b.user_id, b.kind, b.reason, b.created_by, b.created_at,
                    CONCAT_WS(' ', u.first_name, u.last_name) AS created_by_name
             FROM calendar_day_blocks b
             LEFT JOIN users u ON u.id = b.created_by
             WHERE ${filters.join(' AND ')}
             ORDER BY b.day, b.id`,
            params,
        );

        const openDays = await this.openDays(userId, from, to);
        return rows.map((r) => ({
            id: r.id,
            day: r.day,
            scope: r.user_id == null ? 'ALL' : 'SELF',
            reason: r.reason,
            createdByName: r.created_by_name || null,
            createdAt: r.created_at,
            ...(r.user_id == null ? { releasedForMe: openDays.has(r.day) } : {}),
        }));
    }

    /** Jours où `userId` s'est rendu disponible malgré un blocage global. */
    private async openDays(userId: number, from?: string, to?: string): Promise<Set<string>> {
        const filters = ["user_id = ?", "kind = 'OPEN'"];
        const params: unknown[] = [userId];
        if (from) {
            filters.push('day >= ?');
            params.push(from);
        }
        if (to) {
            filters.push('day <= ?');
            params.push(to);
        }
        const rows = await query<{ day: string }[]>(
            `SELECT day FROM calendar_day_blocks WHERE ${filters.join(' AND ')}`,
            params,
        );
        return new Set(rows.map((r) => r.day));
    }

    async findById(id: number): Promise<DayBlockRow | null> {
        const rows = await query<DayBlockRow[]>(
            'SELECT id, day, user_id, kind, reason, created_by, created_at FROM calendar_day_blocks WHERE id = ?',
            [id],
        );
        return rows[0] ?? null;
    }

    /** Ligne de `userId` pour ce jour (blocage personnel ou dérogation), s'il y en a une. */
    async findPersonal(userId: number, day: string): Promise<DayBlockRow | null> {
        const rows = await query<DayBlockRow[]>(
            `SELECT id, day, user_id, kind, reason, created_by, created_at
             FROM calendar_day_blocks WHERE user_id = ? AND day = ?`,
            [userId, day],
        );
        return rows[0] ?? null;
    }

    /**
     * Pose (ou met à jour) la ligne d'une portée : `userId = null` → blocage
     * global, sinon blocage/dérogation de cet utilisateur. La clé unique
     * (scope_key, day) garantit une seule ligne par jour et par portée.
     */
    async upsert(
        day: string,
        userId: number | null,
        kind: 'BLOCK' | 'OPEN',
        reason: string,
        createdBy: number,
    ): Promise<DayBlockRow> {
        await query(
            `INSERT INTO calendar_day_blocks (day, user_id, kind, reason, created_by, scope_key)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE kind = VALUES(kind), reason = VALUES(reason), created_by = VALUES(created_by)`,
            [day, userId, kind, reason, createdBy, userId == null ? 'ALL' : `U${userId}`],
        );
        const rows = userId == null
            ? await query<DayBlockRow[]>(
                'SELECT id, day, user_id, kind, reason, created_by, created_at FROM calendar_day_blocks WHERE user_id IS NULL AND day = ?',
                [day],
            )
            : await query<DayBlockRow[]>(
                'SELECT id, day, user_id, kind, reason, created_by, created_at FROM calendar_day_blocks WHERE user_id = ? AND day = ?',
                [userId, day],
            );
        return rows[0];
    }

    async deleteById(id: number): Promise<void> {
        await query('DELETE FROM calendar_day_blocks WHERE id = ?', [id]);
    }

    /** Supprime un blocage global et les dérogations qui l'annulaient. */
    async deleteGlobalBlock(day: string): Promise<void> {
        await query("DELETE FROM calendar_day_blocks WHERE day = ? AND (user_id IS NULL OR kind = 'OPEN')", [day]);
    }

    /**
     * Jours bloqués effectifs de `userId` sur la plage : blocages globaux et
     * personnels, moins ses dérogations personnelles.
     */
    async blockedDays(userId: number, from: string, to: string): Promise<Set<string>> {
        const rows = await query<{ day: string; user_id: number | null; kind: string }[]>(
            `SELECT day, user_id, kind FROM calendar_day_blocks
             WHERE day BETWEEN ? AND ? AND (user_id IS NULL OR user_id = ?)`,
            [from, to, userId],
        );
        const blocked = new Set<string>();
        const open = new Set<string>();
        for (const row of rows) {
            if (row.user_id != null && row.kind === 'OPEN') open.add(row.day);
            else blocked.add(row.day);
        }
        for (const day of open) blocked.delete(day);
        return blocked;
    }
}

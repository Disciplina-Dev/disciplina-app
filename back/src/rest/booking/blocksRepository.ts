import { shortHash } from '../../external/crypto';
import { query } from '../../db/mysql/connection';

/** Portée d'un blocage de date (colonne `calendar_day_blocks.scope`). */
export type DayBlockScope = 'SELF' | 'ALL' | 'SECTOR' | 'USERS';

/** Préfixes des cibles de `calendar_day_block_targets.target`. */
export const USER_TARGET_PREFIX = 'U:';
export const SECTOR_TARGET_PREFIX = 'S:';

/**
 * Ligne `calendar_day_blocks`.
 * - `BLOCK` : le jour est bloqué. `scope` dit pour qui :
 *   `SELF` (`user_id` renseigné) ou `ALL`/`SECTOR`/`USERS` (cibles dans
 *   `calendar_day_block_targets`).
 * - `OPEN` : dérogation personnelle (« me rendre disponible ») qui annule un
 *   blocage collectif pour ce seul utilisateur — toujours avec `user_id` renseigné.
 *
 * `group_key` regroupe les jours d'une même saisie (« Congés du 12 au 23 ») :
 * une période = N lignes mais une seule entrée dans l'interface.
 */
export interface DayBlockRow {
    id: number;
    /** Date locale `YYYY-MM-DD` (la connexion est en `dateStrings: true`). */
    day: string;
    user_id: number | null;
    kind: 'BLOCK' | 'OPEN';
    scope: DayBlockScope;
    reason: string;
    created_by: number | null;
    created_at: string;
    group_key: string;
    scope_key: string;
}

interface DayBlockJoinedRow extends DayBlockRow {
    created_by_name: string | null;
    /** 1 si le blocage s'applique au lecteur (indépendamment de ses dérogations). */
    applies_to_me: number;
}

/** Blocage tel qu'exposé à l'API (une ligne = un jour, rattaché à une période). */
export interface DayBlock {
    id: number;
    day: string;
    scope: DayBlockScope;
    reason: string;
    createdByName: string | null;
    createdAt: string;
    /** Période de saisie : identique pour tous les jours d'un même blocage. */
    groupKey: string;
    /** Libellés ciblés : secteurs (`SECTOR`) ou noms des personnes (`USERS`). */
    targetLabels: string[];
    /** Nombre de cibles (`USERS`), même quand leurs noms ne sont pas divulgués. */
    targetCount: number;
    /** Le blocage s'applique-t-il au lecteur ? (un auteur voit aussi ses blocages ciblés ailleurs) */
    appliesToMe: boolean;
    /** Blocage collectif dont l'utilisateur courant s'est rendu disponible. */
    releasedForMe?: boolean;
}

export interface DayBlockSave {
    /** Jours à poser (une ligne par jour, même portée). */
    days: string[];
    /** Propriétaire pour `SELF`/`OPEN`, `null` pour un blocage collectif. */
    userId: number | null;
    scope: DayBlockScope;
    kind: 'BLOCK' | 'OPEN';
    reason: string;
    createdBy: number;
    groupKey: string;
    /** Cibles (`U:<id>` / `S:<sector_id>`), vide hors `SECTOR`/`USERS`. */
    targets?: string[];
}

/**
 * Condition SQL « ce blocage s'applique à `userId` » : le sien, un blocage « tout le
 * monde », ou un blocage ciblé sur lui — directement (`U:<id>`) ou via l'un de
 * ses secteurs (`S:<sector_id>` de `user_sectors`, donc une personne qui change
 * de secteur suit le blocage de son nouveau secteur).
 */
const APPLIES_TO_USER = `(
    b.user_id = ?
    OR b.scope = 'ALL'
    OR EXISTS (
        SELECT 1 FROM calendar_day_block_targets t
        WHERE t.block_id = b.id
          AND (
              t.target = CONCAT('U:', ?)
              OR t.target IN (SELECT CONCAT('S:', us.sector_id) FROM user_sectors us WHERE us.user_id = ?)
          )
    )
)`;

/** Condition SQL « ce blocage est visible par `userId` » : il le concerne, ou il l'a posé. */
const VISIBLE_TO_USER = `(b.created_by = ? OR ${APPLIES_TO_USER})`;

const BLOCK_COLUMNS =
    'b.id, b.day, b.user_id, b.kind, b.scope, b.reason, b.created_by, b.created_at, b.group_key, b.scope_key';

/**
 * Clé de portée, unique avec `day` : `ALL`, `U<user_id>` (blocage/dérogation
 * personnels) ou `G<hash>` (jeu de cibles d'un blocage sectoriel/nominatif).
 * MySQL n'indexe pas les NULL d'une clé unique et interdit une colonne générée
 * dépendant d'une clé étrangère : cette colonne matérialise donc la portée.
 */
export function scopeKeyFor(scope: DayBlockScope, userId: number | null, targets: string[] = []): string {
    if (scope === 'ALL') return 'ALL';
    if (scope === 'SELF' || targets.length === 0) return `U${userId}`;
    const hash = shortHash([...targets].sort().join('|'));
    return `G${hash}`;
}

export class DayBlockRepository {
    /** Blocages visibles par `userId` : ceux qui le concernent + ceux qu'il a posés. */
    async findVisible(userId: number, from?: string, to?: string): Promise<DayBlock[]> {
        const filters = ["b.kind = 'BLOCK'", VISIBLE_TO_USER];
        // `applies_to_me` est évalué dans le SELECT : ses paramètres passent avant
        // ceux de la clause WHERE.
        const params: unknown[] = [userId, userId, userId, userId, userId, userId, userId];
        if (from) {
            filters.push('b.day >= ?');
            params.push(from);
        }
        if (to) {
            filters.push('b.day <= ?');
            params.push(to);
        }
        const rows = await query<DayBlockJoinedRow[]>(
            `SELECT ${BLOCK_COLUMNS}, CONCAT_WS(' ', u.first_name, u.last_name) AS created_by_name,
                    (${APPLIES_TO_USER}) AS applies_to_me
             FROM calendar_day_blocks b
             LEFT JOIN users u ON u.id = b.created_by
             WHERE ${filters.join(' AND ')}
             ORDER BY b.day, b.id`,
            params,
        );

        const [targets, openDays] = await Promise.all([
            this.targetsByBlock(rows.map((r) => r.id)),
            this.openDays(userId, from, to),
        ]);
        return rows.map((r) => {
            const target = targets.get(r.id) ?? { labels: [], count: 0 };
            const appliesToMe = Number(r.applies_to_me) === 1;
            // Un blocage nominatif n'expose les noms qu'à son auteur : les autres
            // RH concernés ne voient qu'un nombre, pas l'identité de collègues
            // hors de leur périmètre.
            const showNames = r.scope !== 'USERS' || r.created_by === userId;
            return {
                id: r.id,
                day: r.day,
                scope: r.scope,
                reason: r.reason,
                createdByName: r.created_by_name || null,
                createdAt: r.created_at,
                groupKey: r.group_key,
                targetLabels: showNames ? target.labels : [],
                targetCount: target.count,
                appliesToMe,
                // Dérogation seulement pertinente pour un blocage qui s'applique à soi.
                ...(appliesToMe && r.user_id == null ? { releasedForMe: openDays.has(r.day) } : {}),
            };
        });
    }

    /** Libellés des cibles, par blocage (secteur, ou nom de la personne), et leur nombre. */
    private async targetsByBlock(blockIds: number[]): Promise<Map<number, { labels: string[]; count: number }>> {
        const map = new Map<number, { labels: string[]; count: number }>();
        if (blockIds.length === 0) return map;
        const placeholders = blockIds.map(() => '?').join(', ');
        const rows = await query<{ block_id: number; label: string }[]>(
            `SELECT t.block_id,
                    COALESCE(
                        NULLIF(CONCAT_WS(' ', u.first_name, u.last_name), ''),
                        s.label,
                        t.target
                    ) AS label
             FROM calendar_day_block_targets t
             LEFT JOIN users u ON t.target = CONCAT('U:', u.id)
             LEFT JOIN sectors s ON t.target = CONCAT('S:', s.id)
             WHERE t.block_id IN (${placeholders})
             ORDER BY t.block_id, label`,
            blockIds,
        );
        for (const row of rows) {
            const entry = map.get(row.block_id);
            if (entry) {
                entry.labels.push(row.label);
                entry.count += 1;
            } else {
                map.set(row.block_id, { labels: [row.label], count: 1 });
            }
        }
        return map;
    }

    /** Jours où `userId` s'est rendu disponible malgré un blocage collectif. */
    async openDays(userId: number, from?: string, to?: string): Promise<Set<string>> {
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
            `SELECT ${BLOCK_COLUMNS} FROM calendar_day_blocks b WHERE b.id = ?`,
            [id],
        );
        return rows[0] ?? null;
    }

    /** Tous les jours d'une période (`group_key`), blocages seulement. */
    async findGroup(groupKey: string): Promise<DayBlockRow[]> {
        return query<DayBlockRow[]>(
            `SELECT ${BLOCK_COLUMNS} FROM calendar_day_blocks b
             WHERE b.group_key = ? AND b.kind = 'BLOCK' ORDER BY b.day, b.id`,
            [groupKey],
        );
    }

    /** Ligne de `userId` pour ce jour (blocage personnel ou dérogation), s'il y en a une. */
    async findPersonal(userId: number, day: string): Promise<DayBlockRow | null> {
        const rows = await query<DayBlockRow[]>(
            `SELECT ${BLOCK_COLUMNS} FROM calendar_day_blocks b WHERE b.user_id = ? AND b.day = ?`,
            [userId, day],
        );
        return rows[0] ?? null;
    }

    /** Blocages et dérogations personnels de `userId` sur ces jours. */
    async findPersonalOnDays(userId: number, days: string[]): Promise<DayBlockRow[]> {
        if (days.length === 0) return [];
        return query<DayBlockRow[]>(
            `SELECT ${BLOCK_COLUMNS} FROM calendar_day_blocks b
             WHERE b.user_id = ? AND b.day IN (${days.map(() => '?').join(', ')})`,
            [userId, ...days],
        );
    }

    /** Retire les dérogations personnelles de `userId` sur ces jours (« me re-bloquer »). */
    async deleteOpenDays(userId: number, days: string[]): Promise<void> {
        if (days.length === 0) return;
        await query(
            `DELETE FROM calendar_day_blocks
             WHERE user_id = ? AND kind = 'OPEN' AND day IN (${days.map(() => '?').join(', ')})`,
            [userId, ...days],
        );
    }

    /** Secteurs de `userId` (id + libellé), pour résoudre une cible « mon secteur ». */
    async findUserSectors(userId: number): Promise<{ id: number; label: string }[]> {
        return query<{ id: number; label: string }[]>(
            `SELECT s.id, s.label
             FROM user_sectors us JOIN sectors s ON s.id = us.sector_id
             WHERE us.user_id = ? ORDER BY s.id`,
            [userId],
        );
    }

    /**
     * Pose (ou met à jour) une portée sur une période. (scope_key, day) est
     * unique : rebloquer la même portée le même jour met à jour le motif et
     * rattache le jour à la nouvelle période. L'auteur d'origine n'est jamais
     * réécrit (la reprise d'un blocage d'autrui est refusée en amont).
     */
    async save(input: DayBlockSave): Promise<void> {
        const days = [...new Set(input.days)];
        if (days.length === 0) return;
        const scopeKey = scopeKeyFor(input.scope, input.userId, input.targets);
        const values = days.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        const params: unknown[] = [];
        for (const day of days) {
            params.push(day, input.userId, input.kind, input.scope, input.reason, input.createdBy, input.groupKey, scopeKey);
        }
        await query(
            `INSERT INTO calendar_day_blocks (day, user_id, kind, scope, reason, created_by, group_key, scope_key)
             VALUES ${values}
             ON DUPLICATE KEY UPDATE kind = VALUES(kind), scope = VALUES(scope), reason = VALUES(reason),
                 group_key = VALUES(group_key)`,
            params,
        );

        // Cibles : communes à tous les jours de la période, réécrites à chaque saisie.
        const rows = await query<{ id: number }[]>(
            `SELECT id FROM calendar_day_blocks WHERE scope_key = ? AND day IN (${days.map(() => '?').join(', ')})`,
            [scopeKey, ...days],
        );
        const ids = rows.map((r) => r.id);
        if (ids.length === 0) return;
        await query(
            `DELETE FROM calendar_day_block_targets WHERE block_id IN (${ids.map(() => '?').join(', ')})`,
            ids,
        );
        const targets = input.targets ?? [];
        if (targets.length === 0) return;
        const targetValues = ids.flatMap(() => targets.map(() => '(?, ?)'));
        const targetParams = ids.flatMap((id) => targets.map((target) => [id, target])).flat();
        await query(
            `INSERT INTO calendar_day_block_targets (block_id, target) VALUES ${targetValues.join(', ')}`,
            targetParams,
        );
    }

    /** Jours déjà bloqués par cette portée (même `scope_key`), quel qu'en soit l'auteur. */
    async findByScopeKey(scopeKey: string, days: string[]): Promise<DayBlockRow[]> {
        if (days.length === 0) return [];
        return query<DayBlockRow[]>(
            `SELECT ${BLOCK_COLUMNS} FROM calendar_day_blocks b
             WHERE b.scope_key = ? AND b.kind = 'BLOCK' AND b.day IN (${days.map(() => '?').join(', ')})`,
            [scopeKey, ...days],
        );
    }

    /** Ce blocage concerne-t-il `userId` ? (même règle que la visibilité) */
    async concernsUser(blockId: number, userId: number): Promise<boolean> {
        const rows = await query<{ id: number }[]>(
            `SELECT b.id FROM calendar_day_blocks b WHERE b.id = ? AND ${APPLIES_TO_USER}`,
            [blockId, userId, userId, userId],
        );
        return rows.length > 0;
    }

    /** Tous ces blocages concernent-ils `userId` ? */
    async allConcernUser(blockIds: number[], userId: number): Promise<boolean> {
        const ids = [...new Set(blockIds)];
        if (ids.length === 0) return false;
        const rows = await query<{ count: number }[]>(
            `SELECT COUNT(*) AS count FROM calendar_day_blocks b
             WHERE b.id IN (${ids.map(() => '?').join(', ')}) AND ${APPLIES_TO_USER}`,
            [...ids, userId, userId, userId],
        );
        return Number(rows[0]?.count) === ids.length;
    }

    async deleteById(id: number): Promise<void> {
        await query('DELETE FROM calendar_day_blocks WHERE id = ?', [id]);
    }

    /**
     * Supprime tous les jours d'une période. Un blocage collectif emporte aussi
     * les dérogations personnelles des jours qu'il était seul à bloquer ;
     * un blocage personnel ne touche que ses propres lignes.
     */
    async deleteGroup(groupKey: string): Promise<void> {
        const rows = await query<{ day: string; user_id: number | null }[]>(
            'SELECT day, user_id FROM calendar_day_blocks WHERE group_key = ?',
            [groupKey],
        );
        if (rows.length === 0) return;
        await query('DELETE FROM calendar_day_blocks WHERE group_key = ?', [groupKey]);
        if (rows.some((r) => r.user_id == null)) {
            await this.deleteOrphanOpenDays([...new Set(rows.map((r) => r.day))]);
        }
    }

    /** Supprime un blocage collectif d'un jour (et les dérogations devenues sans objet). */
    async deleteCollectiveDay(id: number, day: string): Promise<void> {
        await query('DELETE FROM calendar_day_blocks WHERE id = ?', [id]);
        await this.deleteOrphanOpenDays([day]);
    }

    /**
     * Retire les dérogations personnelles des jours où plus aucun blocage
     * collectif ne subsiste. Les autres jours gardent les leurs : annuler un
     * blocage sectoriel ne doit pas re-bloquer qui s'était dérogé d'un autre.
     */
    private async deleteOrphanOpenDays(days: string[]): Promise<void> {
        if (days.length === 0) return;
        const rows = await query<{ day: string }[]>(
            `SELECT DISTINCT day FROM calendar_day_blocks
             WHERE kind = 'BLOCK' AND user_id IS NULL AND day IN (${days.map(() => '?').join(', ')})`,
            days,
        );
        const stillBlocked = new Set(rows.map((r) => r.day));
        const orphanDays = days.filter((day) => !stillBlocked.has(day));
        if (orphanDays.length === 0) return;
        await query(
            `DELETE FROM calendar_day_blocks WHERE kind = 'OPEN' AND day IN (${orphanDays.map(() => '?').join(', ')})`,
            orphanDays,
        );
    }

    /**
     * Jours bloqués effectifs de `userId` sur la plage : blocages qui le
     * concernent, moins ses dérogations personnelles (journalières, cf. #1080).
     */
    async blockedDays(userId: number, from: string, to: string): Promise<Set<string>> {
        const rows = await query<{ day: string; user_id: number | null; kind: string }[]>(
            `SELECT b.day, b.user_id, b.kind FROM calendar_day_blocks b
             WHERE b.day BETWEEN ? AND ? AND ${APPLIES_TO_USER}`,
            [from, to, userId, userId, userId],
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

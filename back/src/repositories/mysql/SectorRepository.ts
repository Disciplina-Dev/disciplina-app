import { query } from '../../db/mysql/connection';

export type SectorLevel = 'region' | 'sector' | 'commune';

export interface Sector {
    id: number;
    code: string;
    label: string;
    level: SectorLevel;
    parentId: number | null;
    location: string;
}

interface SectorRow {
    id: number;
    code: string;
    label: string;
    level: SectorLevel;
    parent_id: number | null;
    location: string;
}

const COLUMNS = 'id, code, label, level, parent_id, location';

function toSector(row: SectorRow): Sector {
    return {
        id: row.id,
        code: row.code,
        label: row.label,
        level: row.level,
        parentId: row.parent_id,
        location: row.location,
    };
}

export class SectorRepository {
    /** Tout le référentiel du tenant courant, ordonné par id (parents avant enfants à l'insertion). */
    async findAll(): Promise<Sector[]> {
        const rows = await query<SectorRow[]>(`SELECT ${COLUMNS} FROM sectors ORDER BY id`);
        return rows.map(toSector);
    }

    /** Le nœud et tous ses descendants (CTE récursif), nœud racine inclus. */
    async findSubtree(id: number): Promise<Sector[]> {
        const rows = await query<SectorRow[]>(
            `WITH RECURSIVE tree AS (
                SELECT ${COLUMNS} FROM sectors WHERE id = ?
                UNION ALL
                SELECT s.id, s.code, s.label, s.level, s.parent_id, s.location
                FROM sectors s JOIN tree t ON s.parent_id = t.id
            ) SELECT ${COLUMNS} FROM tree ORDER BY id`,
            [id],
        );
        return rows.map(toSector);
    }

    /** Le nœud et ses ancêtres jusqu'à la région (CTE récursif), du nœud vers la racine. */
    async findAncestors(id: number): Promise<Sector[]> {
        const rows = await query<SectorRow[]>(
            `WITH RECURSIVE chain AS (
                SELECT ${COLUMNS}, 0 AS depth FROM sectors WHERE id = ?
                UNION ALL
                SELECT s.id, s.code, s.label, s.level, s.parent_id, s.location, c.depth + 1
                FROM sectors s JOIN chain c ON s.id = c.parent_id
            ) SELECT ${COLUMNS} FROM chain ORDER BY depth`,
            [id],
        );
        return rows.map(toSector);
    }
}

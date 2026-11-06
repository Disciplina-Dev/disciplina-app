import type { PoolConnection } from 'mysql2/promise';
import { query } from '../../db/mysql/connection';

/**
 * Id du secteur correspondant à `companies.sector` (libellé, éventuellement
 * multi-valeurs « a, b » : le premier fait foi). Null si vide ou hors référentiel.
 * `sector_id` est écrit à partir du libellé reçu, comme le backfill.
 */
export async function resolveSectorId(label: string | null | undefined): Promise<number | null> {
    const first = label?.split(',')[0]?.trim();
    if (!first) return null;
    const rows = await query<{ id: number }[]>("SELECT id FROM sectors WHERE level = 'sector' AND label = ? LIMIT 1", [
        first,
    ]);
    return rows[0]?.id ?? null;
}

/**
 * Remplace `sector` (libellé) par `sector_id` dans les données d'écriture : la colonne
 * libellé n'est plus écrite, le libellé est dérivé du référentiel à la lecture.
 * Un `sector_id` explicite l'emporte.
 */
export async function withSectorId<T extends { sector?: string | null; sector_id?: number | null }>(
    data: T,
): Promise<Omit<T, 'sector'>> {
    const { sector, ...rest } = data;
    if (sector === undefined || rest.sector_id !== undefined) return rest;
    return { ...rest, sector_id: await resolveSectorId(sector) };
}

/** Libellés (« a, b », ordre du référentiel) des secteurs rattachés à `table`.id via company_sectors. */
export function companySectorLabelsSql(table: string): string {
    return `(SELECT GROUP_CONCAT(s.label ORDER BY s.id SEPARATOR ', ')
             FROM company_sectors cs JOIN sectors s ON s.id = cs.sector_id AND s.level = 'sector'
             WHERE cs.company_id = ${table}.id)`;
}

/** Libellé du secteur unique `table`.sector_id (conflits, blacklist). */
export function sectorLabelSql(table: string): string {
    return `(SELECT s.label FROM sectors s WHERE s.id = ${table}.sector_id)`;
}

/** Libellés d'un `companies.sector` multi-valeurs (« a, b »), dédoublonnés. */
function splitSectorLabels(label: string | null | undefined): string[] {
    return [
        ...new Set(
            (label ?? '')
                .split(',')
                .map((l) => l.trim())
                .filter(Boolean),
        ),
    ];
}

/**
 * Double écriture de `company_sectors` : remplace les liaisons de l'entreprise par
 * celles de son libellé `sector`. Les libellés hors référentiel sont ignorés.
 * S'exécute sur la connexion fournie, pour partager la transaction éventuelle.
 */
export async function syncCompanySectors(
    conn: PoolConnection,
    companyId: number,
    label: string | null | undefined,
): Promise<void> {
    await conn.execute('DELETE FROM company_sectors WHERE company_id = ?', [companyId]);
    const labels = splitSectorLabels(label);
    if (labels.length === 0) return;
    await conn.execute(
        `INSERT IGNORE INTO company_sectors (company_id, sector_id) SELECT ?, id FROM sectors WHERE level = 'sector' AND label IN (${labels.map(() => '?').join(', ')})`,
        [companyId, ...labels],
    );
}

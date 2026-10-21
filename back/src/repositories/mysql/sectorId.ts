import type { PoolConnection } from 'mysql2/promise';
import { query } from '../../db/mysql/connection';

/**
 * Id du secteur correspondant à `companies.sector` (libellé, éventuellement
 * multi-valeurs « a, b » : le premier fait foi). Null si vide ou hors référentiel.
 * Double écriture : `sector_id` suit `sector` à chaque écriture, comme le backfill.
 */
export async function resolveSectorId(label: string | null | undefined): Promise<number | null> {
    const first = label?.split(',')[0]?.trim();
    if (!first) return null;
    const rows = await query<{ id: number }[]>("SELECT id FROM sectors WHERE level = 'sector' AND label = ? LIMIT 1", [
        first,
    ]);
    return rows[0]?.id ?? null;
}

/** Ajoute `sector_id` aux données d'écriture quand `sector` y figure (sauf `sector_id` explicite). */
export async function withSectorId<T extends { sector?: string | null; sector_id?: number | null }>(
    data: T,
): Promise<T> {
    if (data.sector === undefined || data.sector_id !== undefined) return data;
    return { ...data, sector_id: await resolveSectorId(data.sector) };
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

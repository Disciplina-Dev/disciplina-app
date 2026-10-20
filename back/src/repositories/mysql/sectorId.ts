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

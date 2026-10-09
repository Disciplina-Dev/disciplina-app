// Plafonds anti-export en masse (RGPD Art. 5.1.c / 32, MCP_RGPD_AUDIT.md M5).
// Une page ne dépasse jamais MAX_PAGE_SIZE fiches ; un utilisateur (ou la clé
// statique, id 0) est borné sur 24 h glissantes, indépendamment de son IP.
export const MAX_PAGE_SIZE = 50;
export const DAILY_CALL_LIMIT = 1000;
export const DAILY_RECORD_LIMIT = 2000;

export interface ListPage<T> {
    total: number;
    offset: number;
    /** offset à passer pour la page suivante, null en fin de liste. */
    nextOffset: number | null;
    items: T[];
}

/** Pagination en mémoire pour les listes que les services renvoient en bloc (pas de curseur natif). */
export function pageOf<T>(rows: T[], first = MAX_PAGE_SIZE, offset = 0): ListPage<T> {
    const items = rows.slice(offset, offset + first);
    const next = offset + items.length;
    return { total: rows.length, offset, nextOffset: next < rows.length ? next : null, items };
}

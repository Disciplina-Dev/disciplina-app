const MAX_SEARCH_LENGTH = 100;

/** Terme de recherche utilisateur → fragment de regex littéral (échappé, longueur plafonnée). */
export function searchNeedle(search: string): string {
    return search
        .trim()
        .slice(0, MAX_SEARCH_LENGTH)
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

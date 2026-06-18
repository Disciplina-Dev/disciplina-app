/** Colonnes de compteurs du KPI RH (ordre stable, réutilisé en SQL et au mapping). */
export const RH_KPI_COLUMNS = [
    'interviews_placed',
    'interviews_attended',
    'interviews_noshow',
    'immersions',
    'contracts',
    'ruptures',
] as const;

export type RhKpiColumn = (typeof RH_KPI_COLUMNS)[number];

export type RhKpiMetrics = Record<RhKpiColumn, number>;

/** Ligne brute de la table rh_kpi. */
export interface RhKpiRow extends RhKpiMetrics {
    id: number;
    user_id: number;
    year: number;
    month: number;
    week: number;
}

export function emptyRhMetrics(): RhKpiMetrics {
    return Object.fromEntries(RH_KPI_COLUMNS.map((c) => [c, 0])) as RhKpiMetrics;
}

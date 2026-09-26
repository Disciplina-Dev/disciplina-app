export type KpiSite = 'NORD' | 'OUEST' | 'SUD';

export const KPI_SITES: KpiSite[] = ['NORD', 'OUEST', 'SUD'];

export interface KpiRow {
    user_id: number | null;
    user_name: string;
    year: number;
    month: number;
    /** 0 = monthly aggregate row, 1-53 = ISO-like week from the "C.R Sem." sheets */
    week: number;
    site: KpiSite;
    count_oui: number;
    count_oui_of: number;
    count_non: number;
    count_ne_repond_pas: number;
    count_a_reflechir: number;
    count_relance: number;
    total_appels: number;
    total_trie: number;
    nbre_ent_ferme: number;
    nbre_ent_ouvert: number;
    visites_terrain: number;
    // pool runs with dateStrings: true, so TIMESTAMP columns arrive as strings
    created_at?: string | Date;
    updated_at?: string | Date;
}

export interface KpiUpsertInput {
    /** Requis pour la saisie manuelle ; rempli après résolution du nom à l'import. */
    user_id?: number | null;
    /** Snapshot d'affichage ; rempli côté serveur depuis le user en saisie manuelle. */
    user_name?: string;
    year: number;
    month: number;
    /** 0 (default) = monthly row, 1-53 = weekly row */
    week?: number;
    site: KpiSite;
    count_oui?: number;
    count_oui_of?: number;
    count_non?: number;
    count_ne_repond_pas?: number;
    count_a_reflechir?: number;
    count_relance?: number;
    total_appels?: number;
    total_trie?: number;
    nbre_ent_ferme?: number;
    nbre_ent_ouvert?: number;
    visites_terrain?: number;
}

export const KPI_METRIC_COLUMNS = [
    'count_oui',
    'count_oui_of',
    'count_non',
    'count_ne_repond_pas',
    'count_a_reflechir',
    'count_relance',
    'total_appels',
    'total_trie',
    'nbre_ent_ferme',
    'nbre_ent_ouvert',
    'visites_terrain',
] as const;

export type KpiMetricColumn = (typeof KPI_METRIC_COLUMNS)[number];

import type { KpiMetricColumn, KpiMetrics } from '@/api/kpi';
import { KPI_METRIC_COLUMNS } from '@/api/kpi';

export interface KpiMetricDef {
  key: KpiMetricColumn;
  label: string;
  /** Couleur sobre issue de la palette index.css */
  color: string;
  /** true = statut de réponse entreprise (affiché dans le diagramme en bâtons) */
  isStatus: boolean;
}

export const KPI_METRICS: KpiMetricDef[] = [
  { key: 'count_oui', label: 'Oui', color: 'var(--color-success)', isStatus: true },
  { key: 'count_oui_of', label: 'Oui OF', color: 'var(--color-blue)', isStatus: true },
  { key: 'count_non', label: 'Non', color: 'var(--color-danger)', isStatus: true },
  { key: 'count_ne_repond_pas', label: 'Ne répond pas', color: 'var(--color-gray-300)', isStatus: true },
  { key: 'count_a_reflechir', label: 'À réfléchir', color: 'var(--color-warning)', isStatus: true },
  { key: 'count_relance', label: 'Relance', color: 'var(--color-purple)', isStatus: true },
  { key: 'total_appels', label: "Total d'appels", color: 'var(--color-gray-700)', isStatus: false },
  { key: 'total_trie', label: 'Total trié', color: 'var(--color-gray-500)', isStatus: false },
  { key: 'nbre_ent_ferme', label: 'Ent. fermées', color: 'var(--color-gray-900)', isStatus: false },
  { key: 'nbre_ent_ouvert', label: 'Ent. ouvertes', color: 'var(--color-blue-dark)', isStatus: false },
  { key: 'visites_terrain', label: 'Visites terrain', color: 'var(--color-pink)', isStatus: false },
];

export const KPI_STATUS_METRICS = KPI_METRICS.filter((m) => m.isStatus);
export const KPI_VOLUME_METRICS = KPI_METRICS.filter((m) => !m.isStatus);

export const KPI_LABELS: Record<KpiMetricColumn, string> = Object.fromEntries(
  KPI_METRICS.map((m) => [m.key, m.label]),
) as Record<KpiMetricColumn, string>;

export const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

export const MONTH_FULL_LABELS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export function emptyMetrics(): KpiMetrics {
  return Object.fromEntries(KPI_METRIC_COLUMNS.map((c) => [c, 0])) as KpiMetrics;
}

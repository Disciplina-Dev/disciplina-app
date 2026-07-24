import { apiFetch } from '@/api/httpClient';

export type KpiSite = 'NORD' | 'OUEST' | 'SUD';
export const KPI_SITES: KpiSite[] = ['NORD', 'OUEST', 'SUD'];

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
export type KpiMetrics = Record<KpiMetricColumn, number>;

export interface KpiMonthEntry {
  month: number;
  metrics: KpiMetrics;
}

export interface KpiUserSummary {
  userId: number | null;
  userName: string;
  totals: KpiMetrics;
  months: KpiMonthEntry[];
}

export interface KpiAnnualSummary {
  year: number;
  site: string;
  totals: KpiMetrics;
  users: KpiUserSummary[];
}

export interface KpiWeekEntry {
  week: number;
  month: number;
  totals: KpiMetrics;
  users: { userId: number | null; userName: string; metrics: KpiMetrics }[];
}

export interface KpiWeeklyDetail {
  year: number;
  site: string;
  weeks: KpiWeekEntry[];
}

export interface KpiSiteOverview {
  site: KpiSite;
  totals: KpiMetrics;
  users: { userId: number | null; userName: string; totals: KpiMetrics }[];
}

export interface KpiOverview {
  year: number;
  totals: KpiMetrics;
  sites: KpiSiteOverview[];
}

/**
 * Source des graphiques/tableaux :
 * - 'combine' : Excel prioritaire, portefeuille en complément (zéro doublon) ;
 * - 'portefeuille' : activité datée du CRM seule ;
 * - 'excel' : table commercial_kpi seule (imports + saisie manuelle).
 */
export type KpiSource = 'combine' | 'portefeuille' | 'excel';

/** Activité datée du portefeuille — mêmes formes que summary/weekly. */
export interface KpiActivity {
  summary: KpiAnnualSummary;
  weekly: KpiWeeklyDetail;
}

/** Snapshot temps réel calculé depuis le portefeuille (companies + contact_logs). */
export interface KpiLiveSnapshot {
  totals: KpiMetrics;
  sites: KpiSiteOverview[];
}

export interface KpiUserSiteDetail {
  site: KpiSite;
  totals: KpiMetrics;
  months: KpiMonthEntry[];
  weeks: { week: number; month: number; metrics: KpiMetrics }[];
}

export interface KpiUserDetail {
  year: number;
  userId: number;
  userName: string;
  totals: KpiMetrics;
  sites: KpiUserSiteDetail[];
}

export interface KpiUpsertInput {
  /** Commercial ciblé : un vrai user (plus de nom libre). */
  user_id: number;
  year: number;
  month: number;
  /** 0 = ligne mensuelle, 1-53 = semaine */
  week?: number;
  site: KpiSite;
  [metric: string]: string | number | undefined;
}

export interface KpiImportResult {
  imported: number;
  errors: string[];
  /** Noms Excel sans user correspondant : lignes ignorées. */
  unmatched: string[];
}

export interface KpiSelectableUser {
  id: number;
  firstName: string;
  lastName: string;
  role: string;
}

async function kpiFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await apiFetch(`/api/kpi${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Requête KPI échouée (${res.status})`);
  }
  return res;
}

export async function fetchKpiUsers(): Promise<KpiSelectableUser[]> {
  const res = await kpiFetch('/users');
  const data = (await res.json()) as { users: KpiSelectableUser[] };
  return data.users;
}

export async function fetchKpiYears(): Promise<number[]> {
  const res = await kpiFetch('/years');
  const data = (await res.json()) as { years: number[] };
  return data.years;
}

export async function fetchKpiSummary(year: number, site: KpiSite): Promise<KpiAnnualSummary> {
  const res = await kpiFetch(`/summary?year=${year}&site=${site}`);
  return (await res.json()) as KpiAnnualSummary;
}

export async function fetchKpiWeekly(year: number, site: KpiSite): Promise<KpiWeeklyDetail> {
  const res = await kpiFetch(`/weekly?year=${year}&site=${site}`);
  return (await res.json()) as KpiWeeklyDetail;
}

export async function fetchKpiActivity(year: number, site: KpiSite): Promise<KpiActivity> {
  const res = await kpiFetch(`/activity?year=${year}&site=${site}`);
  return (await res.json()) as KpiActivity;
}

export async function fetchKpiCombined(year: number, site: KpiSite): Promise<KpiActivity> {
  const res = await kpiFetch(`/combined?year=${year}&site=${site}`);
  return (await res.json()) as KpiActivity;
}

export async function fetchKpiLive(): Promise<KpiLiveSnapshot> {
  const res = await kpiFetch('/live');
  return (await res.json()) as KpiLiveSnapshot;
}

export async function fetchKpiOverview(year: number): Promise<KpiOverview> {
  const res = await kpiFetch(`/overview?year=${year}`);
  return (await res.json()) as KpiOverview;
}

export async function fetchKpiUserDetail(userId: number, year: number): Promise<KpiUserDetail> {
  const res = await kpiFetch(`/user/${userId}?year=${year}`);
  return (await res.json()) as KpiUserDetail;
}

export async function saveKpi(input: KpiUpsertInput): Promise<void> {
  await kpiFetch('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function importKpiExcel(file: File, site: KpiSite): Promise<KpiImportResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('site', site);
  const res = await kpiFetch('/import', { method: 'POST', body: form });
  return (await res.json()) as KpiImportResult;
}

const API_BASE = import.meta.env.VITE_API_URL;

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

export interface KpiUpsertInput {
  user_name: string;
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
}

async function kpiFetch(token: string, path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${API_BASE}/api/kpi${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Requête KPI échouée (${res.status})`);
  }
  return res;
}

export async function fetchKpiYears(token: string): Promise<number[]> {
  const res = await kpiFetch(token, '/years');
  const data = (await res.json()) as { years: number[] };
  return data.years;
}

export async function fetchKpiSummary(token: string, year: number, site: KpiSite): Promise<KpiAnnualSummary> {
  const res = await kpiFetch(token, `/summary?year=${year}&site=${site}`);
  return (await res.json()) as KpiAnnualSummary;
}

export async function fetchKpiWeekly(token: string, year: number, site: KpiSite): Promise<KpiWeeklyDetail> {
  const res = await kpiFetch(token, `/weekly?year=${year}&site=${site}`);
  return (await res.json()) as KpiWeeklyDetail;
}

export async function saveKpi(token: string, input: KpiUpsertInput): Promise<void> {
  await kpiFetch(token, '/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function importKpiExcel(token: string, file: File, site: KpiSite): Promise<KpiImportResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('site', site);
  const res = await kpiFetch(token, '/import', { method: 'POST', body: form });
  return (await res.json()) as KpiImportResult;
}

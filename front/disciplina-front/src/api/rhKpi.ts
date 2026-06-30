const API_BASE = import.meta.env.VITE_API_URL;

/** Colonnes de compteurs du KPI RH (ordre stable). */
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

export interface RhKpiUserMetrics {
  userId: number;
  userName: string;
  /** Secteur (snapshot) ; '' = inconnu/global. */
  sector: string;
  metrics: RhKpiMetrics;
}
export interface RhKpiWeek {
  week: number;
  month: number;
  totals: RhKpiMetrics;
  users: RhKpiUserMetrics[];
}
export interface RhKpiReport {
  year: number;
  scope: 'self' | 'all';
  weeks: RhKpiWeek[];
}

export function emptyRhMetrics(): RhKpiMetrics {
  return Object.fromEntries(RH_KPI_COLUMNS.map((c) => [c, 0])) as RhKpiMetrics;
}

/** Entretiens « à venir » = placés non encore résolus (ni venus, ni absents). Jamais négatif. */
export function upcoming(m: RhKpiMetrics): number {
  return Math.max(0, m.interviews_placed - m.interviews_attended - m.interviews_noshow);
}

/** Additionne plusieurs jeux de métriques. */
export function sumMetrics(list: RhKpiMetrics[]): RhKpiMetrics {
  return list.reduce<RhKpiMetrics>((acc, m) => {
    for (const c of RH_KPI_COLUMNS) acc[c] += m[c] ?? 0;
    return acc;
  }, emptyRhMetrics());
}

async function rhKpiFetch(token: string, path: string): Promise<Response> {
  const res = await fetch(`${API_BASE}/api/rh-kpi${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Requête KPI RH échouée (${res.status})`);
  }
  return res;
}

export async function fetchRhKpiYears(token: string): Promise<number[]> {
  const res = await rhKpiFetch(token, '/years');
  return ((await res.json()) as { years: number[] }).years;
}

export async function fetchRhKpiReport(token: string, year: number): Promise<RhKpiReport> {
  const res = await rhKpiFetch(token, `/report?year=${year}`);
  return (await res.json()) as RhKpiReport;
}

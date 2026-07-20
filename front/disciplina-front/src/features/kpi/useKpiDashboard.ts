import { useCallback, useEffect, useState } from 'react';

import { useAuthStore } from '@/store/authStore';
import {
  fetchKpiActivity,
  fetchKpiCombined,
  fetchKpiSummary,
  fetchKpiWeekly,
  fetchKpiYears,
  type KpiActivity,
  type KpiAnnualSummary,
  type KpiSite,
  type KpiSource,
  type KpiWeeklyDetail,
} from '@/api/kpi';

interface KpiState {
  key: string;
  years: number[];
  summary: KpiAnnualSummary | null;
  previousSummary: KpiAnnualSummary | null;
  weekly: KpiWeeklyDetail | null;
  error: string | null;
}

/**
 * Données du dashboard KPI selon la source :
 * - 'combine' : Excel prioritaire + portefeuille en complément ;
 * - 'excel' : table commercial_kpi (imports Excel + saisie manuelle) ;
 * - 'portefeuille' : activité datée du portefeuille (changements de statut,
 *   créations, appels) — mêmes formes, mêmes composants.
 */
export function useKpiDashboard(year: number, site: KpiSite, source: KpiSource = 'combine') {
  const token = useAuthStore((s) => s.token);

  const [refreshKey, setRefreshKey] = useState(0);
  const [state, setState] = useState<KpiState>({
    key: '',
    years: [],
    summary: null,
    previousSummary: null,
    weekly: null,
    error: null,
  });

  const key = `${year}|${site}|${source}|${refreshKey}`;
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const fetchActivityLike = source === 'combine' ? fetchKpiCombined : fetchKpiActivity;
    const load =
      source !== 'excel'
        ? Promise.all([
            fetchKpiYears(token),
            fetchActivityLike(token, year, site),
            fetchActivityLike(token, year - 1, site).catch(() => null),
          ]).then(
            ([years, current, previous]: [number[], KpiActivity, KpiActivity | null]): [
              number[],
              KpiAnnualSummary,
              KpiAnnualSummary | null,
              KpiWeeklyDetail,
            ] => [years, current.summary, previous?.summary ?? null, current.weekly],
          )
        : Promise.all([
            fetchKpiYears(token),
            fetchKpiSummary(token, year, site),
            fetchKpiSummary(token, year - 1, site).catch(() => null),
            fetchKpiWeekly(token, year, site),
          ]).then(
            ([years, current, previous, weekly]): [
              number[],
              KpiAnnualSummary,
              KpiAnnualSummary | null,
              KpiWeeklyDetail,
            ] => [years, current, previous, weekly],
          );

    load
      .then(([years, summary, previousSummary, weekly]) => {
        if (!cancelled) setState({ key, years, summary, previousSummary, weekly, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            key,
            error: err instanceof Error ? err.message : 'Erreur de chargement des KPI',
          }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, year, site, source, key]);

  // fetching = la requête correspondant aux filtres courants n'a pas encore répondu
  return {
    years: state.years,
    summary: state.summary,
    previousSummary: state.previousSummary,
    weekly: state.weekly,
    error: state.error,
    fetching: state.key !== key,
    refresh,
  };
}

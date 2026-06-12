import { useCallback, useEffect, useState } from 'react';

import { useAuthStore } from '@/store/authStore';
import {
  fetchKpiSummary,
  fetchKpiWeekly,
  fetchKpiYears,
  type KpiAnnualSummary,
  type KpiSite,
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

export function useKpiDashboard(year: number, site: KpiSite) {
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

  const key = `${year}|${site}|${refreshKey}`;
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    Promise.all([
      fetchKpiYears(token),
      fetchKpiSummary(token, year, site),
      fetchKpiSummary(token, year - 1, site),
      fetchKpiWeekly(token, year, site),
    ])
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
  }, [token, year, site, key]);

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

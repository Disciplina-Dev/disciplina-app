import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  Users,
  FileSignature,
  Search,
  Briefcase,
  Loader2,
  AlertCircle,
  RefreshCw,
  Bell,
  X,
  Building2,
  ChevronDown,
} from 'lucide-react';
import { useCurrentUser, Permission } from '@/store/authStore';
import { useCandidateStats, useNeedsAnalysesForDashboard, useNeedsAnalysesPage, type StatBucket, type TpStatusBucket } from '@/graphql/hooks';
import { OFFERS_BY_NEEDS_ANALYSIS, GET_OFFER_HISTORY } from '@/graphql/queries';
import { offerGraphqlClient } from '@/graphql/client';
import type { NeedsAnalysis } from '@/types/needsAnalysis';
import RhKpiPanel from '@/features/kpi/components/RhKpiPanel';
import { CandidateStatus, TitleProfessionalType, TrainingSite } from '@/types/candidate';
import { CANDIDATE_STATUS_LABELS, CANDIDATE_STATUS_CHART_COLOR, CANDIDATE_STATUS_ORDER } from '@/constants/candidateStatus';
import { SECTEUR_LABELS, SECTEUR_VALUES, SECTEUR_KEYS, type SecteurKey } from '@/constants/secteurs';
import { Sector, formatEnumLabel } from '@/features/matching/constants/jobEnums';

// --- Charte graphique (cf. index.css) ---
const COLORS = {
  blue: '#1130A7',
  purple: '#60207E',
  pink: '#B10F55',
  success: '#1A7A4A',
  warning: '#A65C00',
  danger: '#C0152A',
  gray500: '#6B6B6B',
  grid: '#E8E8E4',
};

const TP_LABELS: Record<string, string> = {
  [TitleProfessionalType.AD]: 'AD · Assistante de Direction',
  [TitleProfessionalType.CC]: 'CC · Conseiller Commercial',
  [TitleProfessionalType.NTC]: 'NTC · Négociateur technico-commercial',
  [TitleProfessionalType.REM]: "REM · Responsable d'établissement Marchand",
  [TitleProfessionalType.SA]: 'SA',
};

// Palette dédiée aux TP (cf. ListeCandidats).
const TP_COLORS: Record<string, string> = {
  [TitleProfessionalType.AD]: '#0F766E',
  [TitleProfessionalType.CC]: '#4338CA',
  [TitleProfessionalType.NTC]: '#A21CAF',
  [TitleProfessionalType.REM]: '#4D7C0F',
  [TitleProfessionalType.SA]: '#334155',
};

const TP_ORDER = Object.values(TitleProfessionalType) as string[];

// Secteurs géographiques (créateur du dossier). Filtre global du tableau de bord.
const CANON_SECTORS: string[] = SECTEUR_VALUES;

const SITE_LABELS: Record<string, string> = {
  [TrainingSite.NORD_SAINTE_MARIE]: `${SECTEUR_LABELS.NORD} · Sainte-Marie`,
  [TrainingSite.OUEST_SAINT_PAUL]: `${SECTEUR_LABELS.OUEST} · Saint-Paul`,
  [TrainingSite.SUD_SAINT_PIERRE]: `${SECTEUR_LABELS.SUD} · Saint-Pierre`,
};

const DISMISSED_AB_KEY = 'disciplina:dismissed-ab-ids';

/** Index un tableau de buckets `{ key, count }` en map clé → count. */
function indexBuckets(buckets: StatBucket[]): Record<string, number> {
  return buckets.reduce<Record<string, number>>((acc, b) => {
    acc[b.key] = b.count;
    return acc;
  }, {});
}

// --- Sous-composants présentationnels ---

function AbCallout() {
  const navigate = useNavigate()
  const { items, totalCount, loading } = useNeedsAnalysesForDashboard(10)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(DISMISSED_AB_KEY) ?? '[]') as string[])
    } catch {
      return new Set<string>()
    }
  })

  const visible = items.filter((item) => !dismissedIds.has(item.id))
  if (loading || visible.length === 0) return null

  const dismiss = (id: string) => {
    const updated = new Set(dismissedIds)
    updated.add(id)
    setDismissedIds(updated)
    localStorage.setItem(DISMISSED_AB_KEY, JSON.stringify([...updated]))
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Bell className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-bold text-amber-900">
              {totalCount > visible.length
                ? `${visible.length} analyse${visible.length > 1 ? 's' : ''} de besoin récente${visible.length > 1 ? 's' : ''} à traiter`
                : `${visible.length} analyse${visible.length > 1 ? 's' : ''} de besoin à traiter`}
            </p>
            <ul className="mt-2 space-y-1">
              {visible.slice(0, 5).map((item) => (
                <li key={item.id} className="group flex items-center justify-between gap-2">
                  <button
                    onClick={() => navigate(`/rh/matching?needsAnalysis=${item.id}`)}
                    className="flex items-center gap-2 text-left text-sm text-amber-800 underline-offset-2 hover:underline"
                  >
                    <span className="font-medium">{item.companyName ?? 'Entreprise'}</span>
                    <span className="text-amber-600">· {item.positionsCount} poste{item.positionsCount > 1 ? 's' : ''}</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); dismiss(item.id) }}
                    className="shrink-0 rounded p-0.5 text-amber-400 opacity-0 transition hover:text-amber-600 group-hover:opacity-100"
                    title="Ignorer"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${accent}14`, color: accent }}
      >
        <Icon size={24} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-gray-500">{label}</p>
        <p className="text-2xl font-extrabold text-black">{value}</p>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-lg font-bold text-gray-900">{title}</h3>
      {children}
    </div>
  );
}

const DIRECTORY_PAGE_SIZE = 500;

function primaryTp(analysis: NeedsAnalysis): string | null {
  const tps = analysisTps(analysis);
  return tps.length > 0 ? tps[0] : null;
}

function analysisTps(analysis: NeedsAnalysis): string[] {
  return [...new Set((analysis.positions ?? []).flatMap((p) => (p.desiredTp ?? []).map((t) => t.tpType).filter(Boolean) as string[]))].sort();
}

/** Statut affiché (reflète `AbActiveBadge`) : `abStatus` manquant = Inactive. */
function effectiveAbStatus(analysis: NeedsAnalysis): string {
  return analysis.abStatus ?? 'INACTIVE';
}

const DIRECTORY_STATUSES = ['ACTIVE', 'ARCHIVED', 'INACTIVE'] as const;

const DIRECTORY_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  ARCHIVED: 'Archivée',
  INACTIVE: 'Inactive',
};

// Secteurs d'activité (issus de `companyInfos.activities`) proposés dans le filtre.
const DIRECTORY_ACTIVITY_SECTORS = Object.values(Sector).filter((s) => s !== Sector.NONE);

/**
 * Date d'activation de l'AB : dernier passage au statut effectif ACTIVE.
 * Repli sur la date de création pour les documents antérieurs au suivi.
 */
function activationDateOf(analysis: NeedsAnalysis): string | null | undefined {
  return analysis.lastActiveAt ?? analysis.createdAt;
}

interface DirectoryHistoryEntry {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  text: string;
  createdAt: string;
}

interface DirectoryHistoryState {
  expanded: boolean;
  loaded: boolean;
  loading: boolean;
  error: string | null;
  offers: { id: string; title?: string | null }[];
  selectedOfferId: string | null;
  latestByOffer: Record<string, DirectoryHistoryEntry | null>;
  textOpen: boolean;
}

function freshHistoryState(): DirectoryHistoryState {
  return {
    expanded: false,
    loaded: false,
    loading: false,
    error: null,
    offers: [],
    selectedOfferId: null,
    latestByOffer: {},
    textOpen: false,
  };
}

function historyAuthor(entry: DirectoryHistoryEntry): string {
  const name = `${entry.firstName ?? ''} ${entry.lastName ?? ''}`.trim();
  return name || 'Système';
}

function formatDirectoryDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

function AbActiveBadge({ status }: { status?: string | null }) {
  if (status === 'ACTIVE') {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700 ring-1 ring-inset ring-green-200">
        Active
      </span>
    );
  }
  if (status === 'ARCHIVED') {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
        Archivée
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600 ring-1 ring-inset ring-gray-200">
      Inactive
    </span>
  );
}

/**
 * Annuaire des entreprises issues des analyses de besoin.
 * Tri : TP (ordre canonique AD, CC, NTC, REM, SA) puis date d'activation croissante.
 */
function CompanyDirectoryModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { items, pageInfo, loading, error, refetch } = useNeedsAnalysesPage(DIRECTORY_PAGE_SIZE);

  const [selectedTps, setSelectedTps] = useState<Set<string>>(new Set());
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [selectedZone, setSelectedZone] = useState<SecteurKey | null>(null);
  const [selectedActivities, setSelectedActivities] = useState<Set<string>>(new Set());
  const [minDate, setMinDate] = useState('');
  const [maxDate, setMaxDate] = useState('');
  const [historyByAnalysis, setHistoryByAnalysis] = useState<Record<string, DirectoryHistoryState>>({});

  const toggleTp = (tp: string) =>
    setSelectedTps((prev) => {
      const next = new Set(prev);
      if (next.has(tp)) next.delete(tp);
      else next.add(tp);
      return next;
    });
  const toggleStatus = (s: string) =>
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  const toggleActivity = (s: string) =>
    setSelectedActivities((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  const hasActiveFilters = selectedTps.size > 0 || selectedStatuses.size > 0 || selectedZone !== null || selectedActivities.size > 0 || minDate !== '' || maxDate !== '';
  const resetFilters = () => {
    setSelectedTps(new Set());
    setSelectedStatuses(new Set());
    setSelectedZone(null);
    setSelectedActivities(new Set());
    setMinDate('');
    setMaxDate('');
  };

  const loadHistory = async (analysisId: string) => {
    try {
      const offersResult = await offerGraphqlClient
        .query(OFFERS_BY_NEEDS_ANALYSIS, { needsAnalysisId: analysisId })
        .toPromise();
      if (offersResult.error) throw new Error(offersResult.error.message);
      const offers = (offersResult.data?.offersByNeedsAnalysis ?? []) as {
        id: string;
        title?: string | null;
      }[];
      const latestByOffer: Record<string, DirectoryHistoryEntry | null> = {};
      await Promise.all(
        offers.map(async (offer) => {
          const historyResult = await offerGraphqlClient
            .query(GET_OFFER_HISTORY, { offerId: offer.id })
            .toPromise();
          if (historyResult.error) throw new Error(historyResult.error.message);
          const entries = (historyResult.data?.offerHistory ?? []) as DirectoryHistoryEntry[];
          latestByOffer[offer.id] = entries[0] ?? null;
        }),
      );
      setHistoryByAnalysis((prev) => ({
        ...prev,
        [analysisId]: {
          ...(prev[analysisId] ?? freshHistoryState()),
          expanded: true,
          loaded: true,
          loading: false,
          error: null,
          offers,
          selectedOfferId: offers[0]?.id ?? null,
          latestByOffer,
          textOpen: false,
        },
      }));
    } catch (err) {
      setHistoryByAnalysis((prev) => ({
        ...prev,
        [analysisId]: {
          ...(prev[analysisId] ?? freshHistoryState()),
          expanded: true,
          loading: false,
          error: err instanceof Error ? err.message : 'Erreur de chargement',
        },
      }));
    }
  };

  const toggleHistory = (analysisId: string) => {
    const current = historyByAnalysis[analysisId] ?? freshHistoryState();
    if (current.expanded) {
      setHistoryByAnalysis((prev) => ({ ...prev, [analysisId]: { ...current, expanded: false } }));
      return;
    }
    setHistoryByAnalysis((prev) => ({
      ...prev,
      [analysisId]: { ...current, expanded: true, loading: !current.loaded, error: null },
    }));
    if (!current.loaded) void loadHistory(analysisId);
  };

  const rows = useMemo(() => {
    const order = new Map(TP_ORDER.map((tp, i) => [tp, i]));
    const minTime = minDate ? new Date(`${minDate}T00:00:00`).getTime() : null;
    const maxTime = maxDate ? new Date(`${maxDate}T23:59:59.999`).getTime() : null;
    return [...items]
      .filter((a) => {
        if (selectedTps.size > 0) {
          const tps = analysisTps(a);
          if (!tps.some((t) => selectedTps.has(t))) return false;
        }
        if (selectedStatuses.size > 0 && !selectedStatuses.has(effectiveAbStatus(a))) return false;
        if (selectedZone !== null && a.companyInfos?.sector !== selectedZone) return false;
        if (selectedActivities.size > 0) {
          const activities = a.companyInfos?.activities ?? [];
          if (!activities.some((act) => selectedActivities.has(act))) return false;
        }
        if (minTime != null || maxTime != null) {
          const activated = activationDateOf(a) ? new Date(activationDateOf(a) as string).getTime() : Number.NaN;
          if (Number.isNaN(activated)) return false;
          if (minTime != null && activated < minTime) return false;
          if (maxTime != null && activated > maxTime) return false;
        }
        return true;
      })
      .map((a) => ({ analysis: a, tp: primaryTp(a) }))
      .sort((x, y) => {
        const ox = x.tp != null ? (order.get(x.tp) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
        const oy = y.tp != null ? (order.get(y.tp) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
        if (ox !== oy) return ox - oy;
        const dx = activationDateOf(x.analysis) ? new Date(activationDateOf(x.analysis) as string).getTime() : Number.MAX_SAFE_INTEGER;
        const dy = activationDateOf(y.analysis) ? new Date(activationDateOf(y.analysis) as string).getTime() : Number.MAX_SAFE_INTEGER;
        return dx - dy;
      });
  }, [items, selectedTps, selectedStatuses, selectedZone, selectedActivities, minDate, maxDate]);

  const renderHistoryCell = (analysis: NeedsAnalysis) => {
    const state = historyByAnalysis[analysis.id] ?? freshHistoryState();

    if (!state.expanded) {
      return (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggleHistory(analysis.id); }}
          className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 transition hover:bg-gray-200"
        >
          Historique <ChevronDown size={12} />
        </button>
      );
    }

    const selectedEntry = state.selectedOfferId ? (state.latestByOffer[state.selectedOfferId] ?? null) : null;

    return (
      <div className="min-w-52 max-w-72 space-y-1.5">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggleHistory(analysis.id); }}
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue hover:underline"
        >
          Masquer <ChevronDown size={12} className="rotate-180" />
        </button>
        {state.loading ? (
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <Loader2 size={12} className="animate-spin" /> Chargement…
          </p>
        ) : state.error ? (
          <div className="space-y-1">
            <p className="text-xs text-danger">Erreur de chargement.</p>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); void loadHistory(analysis.id); }}
              className="text-xs font-semibold text-blue hover:underline"
            >
              Réessayer
            </button>
          </div>
        ) : state.offers.length === 0 ? (
          <p className="text-xs text-gray-400">Aucune offre — pas d'historique.</p>
        ) : (
          <>
            {state.offers.length > 1 && (
              <select
                value={state.selectedOfferId ?? ''}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  e.stopPropagation();
                  const selectedOfferId = e.target.value;
                  setHistoryByAnalysis((prev) => ({
                    ...prev,
                    [analysis.id]: { ...(prev[analysis.id] ?? freshHistoryState()), selectedOfferId, textOpen: false },
                  }));
                }}
                className="w-full rounded-md border border-gray-200 px-1.5 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue"
                aria-label="Choisir l'offre dont voir l'historique"
              >
                {state.offers.map((offer, i) => (
                  <option key={offer.id} value={offer.id}>
                    {offer.title ? `#${i + 1} · ${offer.title}` : `Offre #${i + 1}`}
                  </option>
                ))}
              </select>
            )}
            {selectedEntry ? (
              <div className="space-y-0.5">
                <p className="text-[11px] font-medium text-gray-400">
                  {historyAuthor(selectedEntry)} · {formatDirectoryDate(selectedEntry.createdAt)}
                </p>
                <p className={`text-xs text-gray-700 ${state.textOpen ? '' : 'line-clamp-2'}`}>
                  {selectedEntry.text}
                </p>
                {selectedEntry.text.length > 120 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setHistoryByAnalysis((prev) => ({
                        ...prev,
                        [analysis.id]: { ...(prev[analysis.id] ?? freshHistoryState()), textOpen: !state.textOpen },
                      }));
                    }}
                    className="text-xs font-semibold text-blue hover:underline"
                  >
                    {state.textOpen ? 'Voir moins' : 'Voir plus'}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-400">Aucune entrée pour cette offre.</p>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Liste des entreprises">
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 cursor-default bg-black/40" />
      <div className="relative flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Entreprises</h2>
            <p className="text-xs text-gray-500">
              Triées par TP puis par date d'activation · {rows.length} entreprise{rows.length > 1 ? 's' : ''}
              {hasActiveFilters && items.length > 0 ? ` sur ${items.length}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            title="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2 border-b border-gray-100 px-5 py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-gray-500">TP :</span>
            {TP_ORDER.map((tp) => {
              const active = selectedTps.has(tp);
              return (
                <button
                  key={tp}
                  type="button"
                  onClick={() => toggleTp(tp)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                    active ? 'bg-blue text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {tp}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-gray-500">Statut :</span>
            {DIRECTORY_STATUSES.map((s) => {
              const active = selectedStatuses.has(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleStatus(s)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                    active ? 'bg-blue text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {DIRECTORY_STATUS_LABELS[s]}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-gray-500">Zone :</span>
            <button
              type="button"
              onClick={() => setSelectedZone(null)}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                selectedZone === null ? 'bg-blue text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Toutes
            </button>
            {SECTEUR_KEYS.map((zone) => (
              <button
                key={zone}
                type="button"
                onClick={() => setSelectedZone((prev) => (prev === zone ? null : zone))}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                  selectedZone === zone ? 'bg-blue text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {SECTEUR_LABELS[zone]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-gray-500">Secteur d'activité :</span>
            {DIRECTORY_ACTIVITY_SECTORS.map((sector) => {
              const active = selectedActivities.has(sector);
              return (
                <button
                  key={sector}
                  type="button"
                  onClick={() => toggleActivity(sector)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                    active ? 'bg-blue text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {formatEnumLabel(sector)}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-500">Activée entre :</span>
            <input
              type="date"
              value={minDate}
              max={maxDate || undefined}
              onChange={(e) => setMinDate(e.target.value)}
              className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue"
              aria-label="Date d'activation minimale"
            />
            <span className="text-xs text-gray-400">et</span>
            <input
              type="date"
              value={maxDate}
              min={minDate || undefined}
              onChange={(e) => setMaxDate(e.target.value)}
              className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue"
              aria-label="Date d'activation maximale"
            />
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="ml-auto rounded-full border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:border-gray-300 hover:text-gray-900"
              >
                Réinitialiser
              </button>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading && rows.length === 0 ? (
            <div className="flex h-48 items-center justify-center gap-2 text-sm text-gray-500">
              <Loader2 size={18} className="animate-spin text-blue" /> Chargement des entreprises…
            </div>
          ) : error ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3 text-sm text-danger">
              <p className="font-medium">Erreur de chargement des entreprises</p>
              <button
                onClick={() => refetch()}
                className="flex items-center gap-2 rounded-md bg-blue px-4 py-2 text-sm font-medium text-white"
              >
                <RefreshCw size={16} /> Réessayer
              </button>
            </div>
          ) : rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">
              {hasActiveFilters ? 'Aucune entreprise ne correspond aux filtres.' : 'Aucune entreprise.'}
            </p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Entreprise</th>
                      <th className="px-4 py-2.5 font-semibold">TP</th>
                      <th className="px-4 py-2.5 font-semibold">Date d'activation</th>
                      <th className="px-4 py-2.5 font-semibold">Statut</th>
                      <th className="px-4 py-2.5 font-semibold">Historique</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map(({ analysis, tp }) => (
                      <tr
                        key={analysis.id}
                        onClick={() => navigate(`/rh/matching?needsAnalysis=${analysis.id}`)}
                        className="cursor-pointer transition hover:bg-gray-50"
                        title="Ouvrir le matching"
                      >
                        <td className="px-4 py-2.5 font-medium text-gray-900">{analysis.companyInfos?.name ?? '—'}</td>
                        <td className="px-4 py-2.5 text-gray-600">{tp ?? '—'}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-gray-600">{formatDirectoryDate(activationDateOf(analysis))}</td>
                        <td className="px-4 py-2.5">
                          <AbActiveBadge status={analysis.abStatus} />
                        </td>
                        <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                          {renderHistoryCell(analysis)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pageInfo?.hasNextPage && (
                <p className="mt-3 text-xs text-gray-400">
                  Liste limitée aux {DIRECTORY_PAGE_SIZE} premières analyses — affinez la recherche depuis la page Matching.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardRH() {
  const currentUser = useCurrentUser();
  const canViewAll = currentUser?.permission === Permission.ADMIN || currentUser?.permission === Permission.RESPONSABLE;

  // Filtre secteur global : null = tous ; sinon 1, 2 ou 3 secteurs cumulés.
  // Pilote à la fois les indicateurs candidats, les diagrammes et les KPI RH.
  // RH -> restreint à son secteur ; Admin/Resp -> libre (tous par défaut).
  const [selectedSectors, setSelectedSectors] = useState<Set<string> | null>(
    () => canViewAll ? null : new Set(currentUser?.sectors ?? []),
  );
  const sectorArray = useMemo(
    () => (selectedSectors ? [...selectedSectors] : undefined),
    [selectedSectors],
  );
  const { stats, loading, error, refetch } = useCandidateStats(sectorArray);
  const [showCompanies, setShowCompanies] = useState(false);

  const toggleSector = (s: string) =>
    setSelectedSectors((prev) => {
      // Depuis « Tous » : un clic sélectionne uniquement ce secteur.
      if (!prev) return new Set([s]);
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      // Plus rien coché, ou tout coché = retour à « Tous ».
      if (next.size === 0 || next.size === CANON_SECTORS.length) return null;
      return next;
    });
  const isSectorOn = (s: string) => !selectedSectors || selectedSectors.has(s);

  const statusData = useMemo(() => {
    if (!stats) return [];
    const idx = indexBuckets(stats.byStatus);
    return CANDIDATE_STATUS_ORDER.filter((s) => idx[s]).map((s) => ({
      key: s,
      name: CANDIDATE_STATUS_LABELS[s] ?? s,
      value: idx[s],
      color: CANDIDATE_STATUS_CHART_COLOR[s] ?? COLORS.gray500,
    }));
  }, [stats]);

  const tpData = useMemo(() => {
    if (!stats) return [];
    const idx = indexBuckets(stats.byTpType);
    return TP_ORDER.map((tp) => ({
      key: tp,
      name: tp,
      value: idx[tp] ?? 0,
      color: TP_COLORS[tp] ?? COLORS.blue,
    }));
  }, [stats]);

  const siteData = useMemo(() => {
    if (!stats) return [];
    return stats.byTrainingSite.map((b) => ({
      name: SITE_LABELS[b.key] ?? b.key,
      value: b.count,
    }));
  }, [stats]);

  // Histogramme empilé : une ligne par TP, une série par statut.
  const tpStatusData = useMemo(() => {
    if (!stats) return [];
    const matrix: Record<string, Record<string, number>> = {};
    stats.byTpAndStatus.forEach((r: TpStatusBucket) => {
      (matrix[r.tpType] ??= {})[r.status] = r.count;
    });
    return TP_ORDER.map((tp) => ({
      name: tp,
      ...CANDIDATE_STATUS_ORDER.reduce<Record<string, number>>((acc, s) => {
        acc[s] = matrix[tp]?.[s] ?? 0;
        return acc;
      }, {}),
    }));
  }, [stats]);

  // Statuts réellement présents (pour ne pas afficher de séries vides).
  const activeStatuses = useMemo(
    () => CANDIDATE_STATUS_ORDER.filter((s) => statusData.some((d) => d.key === s)),
    [statusData],
  );

  const contracted = stats?.byStatus.find((b) => b.key === CandidateStatus.CONTRACT)?.count ?? 0;
  const seeking = stats?.byStatus.find((b) => b.key === CandidateStatus.SEEKING)?.count ?? 0;
  const immersing = stats?.byStatus.find((b) => b.key === CandidateStatus.IMMERSING)?.count ?? 0;

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="animate-spin text-blue" size={36} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3 text-danger">
        <AlertCircle size={36} />
        <p className="font-medium">Erreur de chargement des statistiques</p>
        <button
          onClick={refetch}
          className="flex items-center gap-2 rounded-md bg-blue px-4 py-2 text-sm font-medium text-white"
        >
          <RefreshCw size={16} /> Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center justify-between">
        <div>
          <h1>Tableau de bord RH</h1>
          <p className="mt-1 text-gray-500">Vue d'ensemble des candidats</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Filtre secteur global — réservé Admin/Resp ; RH voit uniquement son secteur. */}
          {canViewAll && (
            <div className="flex items-center gap-1 rounded-[10px] border border-gray-100 bg-white p-0.5 shadow-sm">
              <button
                onClick={() => setSelectedSectors(null)}
                className={`rounded-[8px] px-3 py-1.5 text-[13px] font-bold transition-colors ${!selectedSectors ? 'bg-blue text-white' : 'text-gray-500 hover:text-gray-800'}`}
              >
                Tous
              </button>
              {CANON_SECTORS.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleSector(s)}
                  className={`rounded-[8px] px-3 py-1.5 text-[13px] font-bold transition-colors ${selectedSectors && isSectorOn(s) ? 'bg-blue text-white' : 'text-gray-500 hover:text-gray-800'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setShowCompanies(true)}
            className="flex items-center gap-2 rounded-md bg-blue px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
          >
            <Building2 size={16} /> Entreprises
          </button>
          <button
            onClick={refetch}
            className="flex items-center gap-2 rounded-md border border-gray-100 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            <RefreshCw size={16} /> Actualiser
          </button>
        </div>
      </div>

      <AbCallout />

      {/* KPI RH par semaine / mois / année — piloté par le filtre secteur global */}
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <RhKpiPanel sectors={sectorArray ?? null} hideSelector />
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={Users} label="Total candidats" value={stats?.total ?? 0} accent={COLORS.blue} />
        <KpiCard icon={FileSignature} label="En contrat" value={contracted} accent={COLORS.success} />
        <KpiCard icon={Search} label="En recherche" value={seeking} accent={COLORS.blue} />
        <KpiCard icon={Briefcase} label="En immersion" value={immersing} accent={COLORS.pink} />
      </div>

      {/* Répartition par statut + par TP */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Répartition par statut">
          {statusData.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={2}
                >
                  {statusData.map((d) => (
                    <Cell key={d.key} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Candidats par type de titre (TP)">
          {tpData.every((d) => d.value === 0) ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={tpData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 13 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(v) => [`${v}`, 'Candidats']}
                  labelFormatter={(l) => TP_LABELS[l as string] ?? (l as string)}
                />
                <Bar dataKey="value" name="Candidats" radius={[6, 6, 0, 0]}>
                  {tpData.map((d) => (
                    <Cell key={d.key} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Croisement TP x statut */}
      <ChartCard title="Statuts par type de titre (TP)">
        {tpStatusData.every((row) => activeStatuses.every((s) => (row as unknown as Record<string, number>)[s] === 0)) ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={tpStatusData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 13 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              {activeStatuses.map((s) => (
                <Bar
                  key={s}
                  dataKey={s}
                  stackId="tp"
                  name={CANDIDATE_STATUS_LABELS[s] ?? s}
                  fill={CANDIDATE_STATUS_CHART_COLOR[s] ?? COLORS.gray500}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Par site de formation */}
      {siteData.length > 0 && (
        <ChartCard title="Candidats par site de formation">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={siteData}
              layout="vertical"
              margin={{ top: 8, right: 16, left: 40, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => [`${v}`, 'Candidats']} />
              <Bar dataKey="value" name="Candidats" fill={COLORS.purple} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {showCompanies && <CompanyDirectoryModal onClose={() => setShowCompanies(false)} />}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[300px] items-center justify-center text-gray-300">
      Aucune donnée disponible
    </div>
  );
}

import { useSectors } from '@/hooks/useSectors';
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
import { IconAlert, IconBell, IconClose, IconCompany, IconJob, IconLoader, IconRefresh, IconSearch, IconSignature, IconUsers } from '@/components/ui/icons'
import { useCurrentUser, Permission } from '@/store/authStore';
import { useCandidateStats, useCandidatesPage, useNeedsAnalysesForDashboard, type StatBucket, type TpStatusBucket } from '@/graphql/hooks';
import CompanyDirectory from '@/features/entreprises/CompanyDirectory';
import RhKpiPanel from '@/features/kpi/components/RhKpiPanel';
import { CandidateStatus, TitleProfessionalType, TrainingSite } from '@/types/candidate';
import { CANDIDATE_STATUS_LABELS, CANDIDATE_STATUS_CHART_COLOR, CANDIDATE_STATUS_ORDER } from '@/constants/candidateStatus';
import { SECTEUR_LABELS } from '@/constants/secteurs';
import { getTrialPeriodStatus } from '@/utils/trialPeriod';
import ChipGroup from '@/components/ui/ChipGroup'

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
  [TitleProfessionalType.CADGA]: "CADGA · Chargé d'accueil et de gestion administrative",
};

// Palette dédiée aux TP (cf. ListeCandidats).
const TP_COLORS: Record<string, string> = {
  [TitleProfessionalType.AD]: '#0F766E',
  [TitleProfessionalType.CC]: '#4338CA',
  [TitleProfessionalType.NTC]: '#A21CAF',
  [TitleProfessionalType.REM]: '#4D7C0F',
  [TitleProfessionalType.CADGA]: '#334155',
};

const TP_ORDER = Object.values(TitleProfessionalType) as string[];

const SITE_LABELS: Record<string, string> = {
  [TrainingSite.NORD_SAINTE_MARIE]: `${SECTEUR_LABELS.NORD} · Sainte-Marie`,
  [TrainingSite.OUEST_SAINT_PAUL]: `${SECTEUR_LABELS.OUEST} · Saint-Paul`,
  [TrainingSite.SUD_SAINT_PIERRE]: `${SECTEUR_LABELS.SUD} · Saint-Pierre`,
};

const DISMISSED_AB_KEY = 'disciplina:dismissed-ab-ids';

function formatDirectoryDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

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
    <div className="rounded-xl border border-[var(--ds-warning)] bg-[var(--ds-warning-bg)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <IconBell className="mt-0.5 h-5 w-5 shrink-0 text-[var(--ds-warning)]" />
          <div>
            <p className="text-sm font-bold text-[var(--ds-warning)]">
              {totalCount > visible.length
                ? `${visible.length} analyse${visible.length > 1 ? 's' : ''} de besoin récente${visible.length > 1 ? 's' : ''} à traiter`
                : `${visible.length} analyse${visible.length > 1 ? 's' : ''} de besoin à traiter`}
            </p>
            <ul className="mt-2 space-y-1">
              {visible.slice(0, 5).map((item) => (
                <li key={item.id} className="group flex items-center justify-between gap-2">
                  <button
                    onClick={() => navigate(`/rh/matching?needsAnalysis=${item.id}`)}
                    className="flex items-center gap-2 text-left text-sm text-[var(--ds-warning)] underline-offset-2 hover:underline"
                  >
                    <span className="font-medium">{item.companyName ?? 'Entreprise'}</span>
                    <span className="text-[var(--ds-warning)]">· {item.positionsCount} poste{item.positionsCount > 1 ? 's' : ''}</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); dismiss(item.id) }}
                    className="shrink-0 rounded p-0.5 text-amber-400 opacity-0 transition hover:text-[var(--ds-warning)] group-hover:opacity-100"
                    title="Ignorer"
                  >
                    <IconClose width={14} height={14} />
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
  onClick,
}: {
  icon: typeof IconUsers;
  label: string;
  value: number;
  accent: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      className={`flex items-center gap-4 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-5 shadow-sm${onClick ? ' cursor-pointer transition hover:border-[var(--ds-border-strong)] hover:shadow-md' : ''}`}
    >
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${accent}14`, color: accent }}
      >
        <Icon width={24} height={24} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[var(--ds-text-subtle)]">{label}</p>
        <p className="text-2xl font-extrabold text-[var(--ds-text)]">{value}</p>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-5 shadow-sm">
      <h3 className="mb-4 text-lg font-bold text-[var(--ds-text)]">{title}</h3>
      {children}
    </div>
  );
}

const CONTRACTED_PAGE_SIZE = 500;

const IMMERSING_PAGE_SIZE = 500;

function TrialStatusBadge({ trialEndDate }: { trialEndDate?: string }) {
  const status = getTrialPeriodStatus(trialEndDate);
  if (status === 'done') {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--ds-success-bg)] px-2.5 py-0.5 text-xs font-semibold text-[var(--ds-success)] ring-1 ring-inset ring-[var(--ds-success)]">
        Période d'essai terminée
      </span>
    );
  }
  if (status === 'ongoing') {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--ds-warning-bg)] px-2.5 py-0.5 text-xs font-semibold text-[var(--ds-warning)] ring-1 ring-inset ring-amber-200">
        En période d'essai
      </span>
    );
  }
  return <span className="text-xs text-[var(--ds-text-subtle)]">—</span>;
}

/**
 * Liste des candidats en contrat, avec le statut de leur période d'essai
 * (45 jours ouvrés depuis le début du contrat). Triée par fin d'essai
 * croissante (sans date en dernier).
 */
function ContractedCandidatesModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { candidates, totalCount, loading, error, refetch } = useCandidatesPage(
    CONTRACTED_PAGE_SIZE,
    undefined,
    undefined,
    { status: CandidateStatus.CONTRACT },
  );

  const rows = useMemo(() => {
    const timeOf = (iso?: string) => {
      if (!iso) return Number.MAX_SAFE_INTEGER;
      const t = new Date(iso).getTime();
      return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
    };
    return [...candidates].sort((a, b) => {
      const diff = timeOf(a.contract_trial_end_date) - timeOf(b.contract_trial_end_date);
      if (diff !== 0) return diff;
      return (a.identity.full_name ?? '').localeCompare(b.identity.full_name ?? '', 'fr');
    });
  }, [candidates]);

  const ongoingCount = useMemo(
    () => candidates.filter((c) => getTrialPeriodStatus(c.contract_trial_end_date) === 'ongoing').length,
    [candidates],
  );
  const doneCount = useMemo(
    () => candidates.filter((c) => getTrialPeriodStatus(c.contract_trial_end_date) === 'done').length,
    [candidates],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Candidats en contrat">
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 cursor-default bg-black/40" />
      <div className="relative flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-[var(--ds-surface)] shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--ds-border)] px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-[var(--ds-text)]">Candidats en contrat</h2>
            <p className="text-xs text-[var(--ds-text-subtle)]">
              {rows.length} candidat{rows.length > 1 ? 's' : ''} · {ongoingCount} en période d'essai · {doneCount} terminée{doneCount > 1 ? 's' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--ds-text-subtle)] transition hover:bg-[var(--ds-surface-sunken)] hover:text-[var(--ds-text-muted)]"
            title="Fermer"
          >
            <IconClose width={18} height={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading && rows.length === 0 ? (
            <div className="flex h-48 items-center justify-center gap-2 text-sm text-[var(--ds-text-subtle)]">
              <IconLoader width={18} height={18} className="animate-spin text-blue" /> Chargement des candidats…
            </div>
          ) : error ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3 text-sm text-[var(--ds-danger)]">
              <p className="font-medium">Erreur de chargement des candidats</p>
              <button
                onClick={() => refetch()}
                className="flex items-center gap-2 rounded-md bg-blue px-4 py-2 text-sm font-medium text-white"
              >
                <IconRefresh width={16} height={16} /> Réessayer
              </button>
            </div>
          ) : rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-[var(--ds-text-subtle)]">
              Aucun candidat en contrat.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-[var(--ds-border)]">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--ds-surface-sunken)] text-xs uppercase tracking-wide text-[var(--ds-text-subtle)]">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Candidat</th>
                      <th className="px-4 py-2.5 font-semibold">Entreprise</th>
                      <th className="px-4 py-2.5 font-semibold">Début</th>
                      <th className="px-4 py-2.5 font-semibold">Fin de période d'essai</th>
                      <th className="px-4 py-2.5 font-semibold">Session</th>
                      <th className="px-4 py-2.5 font-semibold">Statut essai</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--ds-border)]">
                    {rows.map((candidate) => (
                      <tr
                        key={candidate._id}
                        onClick={() => navigate(`/rh/candidats/${candidate._id}`)}
                        className="cursor-pointer transition hover:bg-[var(--ds-surface-sunken)]"
                        title="Ouvrir la fiche candidat"
                      >
                        <td className="px-4 py-2.5 font-medium text-[var(--ds-text)]">{candidate.identity.full_name}</td>
                        <td className="px-4 py-2.5 text-[var(--ds-text-muted)]">{candidate.contract_company_name ?? '—'}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-[var(--ds-text-muted)]">{formatDirectoryDate(candidate.contract_start_date)}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-[var(--ds-text-muted)]">{formatDirectoryDate(candidate.contract_trial_end_date)}</td>
                        <td className="px-4 py-2.5 text-[var(--ds-text-muted)]">{candidate.contract_session_name ?? '—'}</td>
                        <td className="px-4 py-2.5">
                          <TrialStatusBadge trialEndDate={candidate.contract_trial_end_date} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalCount > CONTRACTED_PAGE_SIZE && (
                <p className="mt-3 text-xs text-[var(--ds-text-subtle)]">
                  Liste limitée aux {CONTRACTED_PAGE_SIZE} premiers candidats — affinez la recherche depuis la page Candidats.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Jours calendaires restant avant `iso` (négatif = date passée, null = absente/invalide). */
function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - today.getTime()) / 86_400_000);
}

function ImmersionStatusBadge({ immersionEndDate }: { immersionEndDate?: string }) {
  const days = daysUntil(immersionEndDate);
  if (days === null) {
    return <span className="text-xs text-[var(--ds-text-subtle)]">—</span>;
  }
  if (days < 0) {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--ds-surface-sunken)] px-2.5 py-0.5 text-xs font-semibold text-[var(--ds-text-muted)] ring-1 ring-inset ring-[var(--ds-border)]">
        Terminée
      </span>
    );
  }
  if (days <= 7) {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--ds-warning-bg)] px-2.5 py-0.5 text-xs font-semibold text-[var(--ds-warning)] ring-1 ring-inset ring-amber-200">
        {days === 0 ? "Se termine aujourd'hui" : `Se termine dans ${days} j`}
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--ds-success-bg)] px-2.5 py-0.5 text-xs font-semibold text-[var(--ds-success)] ring-1 ring-inset ring-[var(--ds-success)]">
      En cours
    </span>
  );
}

/**
 * Liste des candidats en immersion et de leur entreprise d'accueil.
 * Triée par fin d'immersion croissante (sans date en dernier).
 */
function ImmersingCandidatesModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { candidates, totalCount, loading, error, refetch } = useCandidatesPage(
    IMMERSING_PAGE_SIZE,
    undefined,
    undefined,
    { status: CandidateStatus.IMMERSING },
  );

  const rows = useMemo(() => {
    const timeOf = (iso?: string) => {
      if (!iso) return Number.MAX_SAFE_INTEGER;
      const t = new Date(iso).getTime();
      return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
    };
    return [...candidates].sort((a, b) => {
      const diff = timeOf(a.immersion_end_date) - timeOf(b.immersion_end_date);
      if (diff !== 0) return diff;
      const startDiff = timeOf(a.immersion_start_date) - timeOf(b.immersion_start_date);
      if (startDiff !== 0) return startDiff;
      return (a.identity.full_name ?? '').localeCompare(b.identity.full_name ?? '', 'fr');
    });
  }, [candidates]);

  const endingSoonCount = useMemo(
    () => candidates.filter((c) => {
      const days = daysUntil(c.immersion_end_date);
      return days !== null && days >= 0 && days <= 7;
    }).length,
    [candidates],
  );
  const finishedCount = useMemo(
    () => candidates.filter((c) => {
      const days = daysUntil(c.immersion_end_date);
      return days !== null && days < 0;
    }).length,
    [candidates],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Candidats en immersion">
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 cursor-default bg-black/40" />
      <div className="relative flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-[var(--ds-surface)] shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--ds-border)] px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-[var(--ds-text)]">Candidats en immersion</h2>
            <p className="text-xs text-[var(--ds-text-subtle)]">
              {rows.length} candidat{rows.length > 1 ? 's' : ''} en immersion
              {endingSoonCount > 0 ? ` · ${endingSoonCount} se terminant sous 7 jours` : ''}
              {finishedCount > 0 ? ` · ${finishedCount} terminée${finishedCount > 1 ? 's' : ''}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={loading}
              title="Actualiser la liste des candidats en immersion"
              aria-label="Actualiser la liste des candidats en immersion"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ds-border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ds-text-muted)] transition hover:bg-[var(--ds-surface-sunken)] hover:text-[var(--ds-text)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <IconRefresh width={14} height={14} className={loading ? 'animate-spin' : ''} />
              Actualiser
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-[var(--ds-text-subtle)] transition hover:bg-[var(--ds-surface-sunken)] hover:text-[var(--ds-text-muted)]"
              title="Fermer"
            >
              <IconClose width={18} height={18} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading && rows.length === 0 ? (
            <div className="flex h-48 items-center justify-center gap-2 text-sm text-[var(--ds-text-subtle)]">
              <IconLoader width={18} height={18} className="animate-spin text-blue" /> Chargement des candidats…
            </div>
          ) : error && rows.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3 text-sm text-[var(--ds-danger)]">
              <p className="font-medium">Erreur de chargement des candidats</p>
              <button
                onClick={() => refetch()}
                className="flex items-center gap-2 rounded-md bg-blue px-4 py-2 text-sm font-medium text-white"
              >
                <IconRefresh width={16} height={16} /> Réessayer
              </button>
            </div>
          ) : rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-[var(--ds-text-subtle)]">
              Aucun candidat en immersion.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-[var(--ds-border)]">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--ds-surface-sunken)] text-xs uppercase tracking-wide text-[var(--ds-text-subtle)]">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Candidat</th>
                      <th className="px-4 py-2.5 font-semibold">Entreprise</th>
                      <th className="px-4 py-2.5 font-semibold">Début</th>
                      <th className="px-4 py-2.5 font-semibold">Fin</th>
                      <th className="px-4 py-2.5 font-semibold">Convention</th>
                      <th className="px-4 py-2.5 font-semibold">Statut immersion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--ds-border)]">
                    {rows.map((candidate) => (
                      <tr
                        key={candidate._id}
                        onClick={() => navigate(`/rh/candidats/${candidate._id}`)}
                        className="cursor-pointer transition hover:bg-[var(--ds-surface-sunken)]"
                        title="Ouvrir la fiche candidat"
                      >
                        <td className="px-4 py-2.5 font-medium text-[var(--ds-text)]">{candidate.identity.full_name}</td>
                        <td className="px-4 py-2.5 text-[var(--ds-text-muted)]">{candidate.immersion_company_name ?? '—'}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-[var(--ds-text-muted)]">{formatDirectoryDate(candidate.immersion_start_date)}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-[var(--ds-text-muted)]">{formatDirectoryDate(candidate.immersion_end_date)}</td>
                        <td className="px-4 py-2.5 text-[var(--ds-text-muted)]">{candidate.immersion_convention_number ?? '—'}</td>
                        <td className="px-4 py-2.5">
                          <ImmersionStatusBadge immersionEndDate={candidate.immersion_end_date} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalCount > IMMERSING_PAGE_SIZE && (
                <p className="mt-3 text-xs text-[var(--ds-text-subtle)]">
                  Liste limitée aux {IMMERSING_PAGE_SIZE} premiers candidats — affinez la recherche depuis la page Candidats.
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
  // Secteurs géographiques (créateur du dossier). Filtre global du tableau de bord.
  // Réunion : Nord-Est/Ouest/Sud ; Annemasse : les 6 secteurs opérationnels.
  const { userSectors: canonSectors } = useSectors();

  // Filtre secteur global : null = tous ; sinon les secteurs cochés cumulés.
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
  const [showContracted, setShowContracted] = useState(false);
  const [showImmersing, setShowImmersing] = useState(false);

  const toggleSector = (s: string) =>
    setSelectedSectors((prev) => {
      // Depuis « Tous » : un clic sélectionne uniquement ce secteur.
      if (!prev) return new Set([s]);
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      // Plus rien coché, ou tout coché = retour à « Tous ».
      if (next.size === 0 || next.size === canonSectors.length) return null;
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
        <IconLoader className="animate-spin text-blue" width={36} height={36} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3 text-[var(--ds-danger)]">
        <IconAlert width={36} height={36} />
        <p className="font-medium">Erreur de chargement des statistiques</p>
        <button
          onClick={refetch}
          className="flex items-center gap-2 rounded-md bg-blue px-4 py-2 text-sm font-medium text-white"
        >
          <IconRefresh width={16} height={16} /> Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center justify-between">
        <div>
          <h1>Tableau de bord RH</h1>
          <p className="mt-1 text-[var(--ds-text-subtle)]">Vue d'ensemble des candidats</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Filtre secteur global — réservé Admin/Resp ; RH voit uniquement son secteur. */}
          {canViewAll && (
            <ChipGroup
              label="Secteurs affichés"
              tone="accent"
              selected={selectedSectors ? canonSectors.filter((s) => isSectorOn(s)) : []}
              onSelectAll={() => setSelectedSectors(null)}
              onToggle={toggleSector}
              options={canonSectors.map((s) => ({ value: s, label: s }))}
            />
          )}
          <button
            onClick={() => setShowCompanies(true)}
            className="flex items-center gap-2 rounded-md bg-blue px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
          >
            <IconCompany width={16} height={16} /> Entreprises
          </button>
          <button
            onClick={refetch}
            className="flex items-center gap-2 rounded-md border border-[var(--ds-border)] bg-[var(--ds-surface)] px-4 py-2 text-sm font-medium text-[var(--ds-text-muted)] shadow-sm transition hover:bg-[var(--ds-surface-sunken)]"
          >
            <IconRefresh width={16} height={16} /> Actualiser
          </button>
        </div>
      </div>

      <AbCallout />

      {/* KPI RH par semaine / mois / année — piloté par le filtre secteur global */}
      <div className="rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-5 shadow-sm">
        <RhKpiPanel sectors={sectorArray ?? null} hideSelector />
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={IconUsers} label="Total candidats" value={stats?.total ?? 0} accent={COLORS.blue} />
        <KpiCard icon={IconSignature} label="En contrat" value={contracted} accent={COLORS.success} onClick={() => setShowContracted(true)} />
        <KpiCard icon={IconSearch} label="En recherche" value={seeking} accent={COLORS.blue} />
        <KpiCard icon={IconJob} label="En immersion" value={immersing} accent={COLORS.pink} onClick={() => setShowImmersing(true)} />
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

      {showCompanies && <CompanyDirectory onClose={() => setShowCompanies(false)} />}
      {showContracted && <ContractedCandidatesModal onClose={() => setShowContracted(false)} />}
      {showImmersing && <ImmersingCandidatesModal onClose={() => setShowImmersing(false)} />}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[300px] items-center justify-center text-[var(--ds-text-subtle)]">
      Aucune donnée disponible
    </div>
  );
}

import { Suspense, useEffect, useMemo, useState } from 'react'
import { IconChart, IconPhone, IconPlus, IconUsers } from '@/components/ui/icons'
import {
  Button,
  Card,
  LoadingPanel,
  PageHeader,
  SectionHeader,
  SegmentedControl,
  Spinner,
} from '@/components/ui'
import { toast } from '@/store/toastStore'

import { KpiProfilView } from '@/pages/commercial/CommercialKpiProfil'

import { useCurrentUser, Permission } from '@/store/authStore'
import { useStaffDirectory } from '@/hooks/useStaffDirectory'
import { useContactLogStats } from '@/graphql/hooks'
import {
  fetchKpiUsers,
  KPI_SITES,
  type KpiAnnualSummary,
  type KpiImportResult,
  type KpiMetricColumn,
  type KpiMetrics,
  type KpiSelectableUser,
  type KpiSite,
  type KpiSource,
  type KpiWeeklyDetail,
} from '@/api/kpi'
import { KPI_STATUS_METRICS, SITE_LABELS, emptyMetrics } from '@/features/kpi/config'
import { useKpiDashboard } from '@/features/kpi/useKpiDashboard'
import KpiSummaryCards from '@/features/kpi/components/KpiSummaryCards'
import KpiTable from '@/features/kpi/components/KpiTable'
import KpiWeeklyTable from '@/features/kpi/components/KpiWeeklyTable'
import KpiImportButton from '@/features/kpi/components/KpiImportButton'
import KpiEntryModal, { type KpiEntryDraft } from '@/features/kpi/components/KpiEntryModal'
import KpiOverviewSection, { KpiLiveSection } from '@/features/kpi/components/KpiOverviewSection'
import type { ChartMode } from '@/features/kpi/components/KpiStatusChart'
import { lazyWithRetry } from '@/utils/lazyWithRetry'

// recharts est lourd : chargé à la demande pour ne pas grossir le bundle principal
const KpiStatusChart = lazyWithRetry(() => import('@/features/kpi/components/KpiStatusChart'))
const KpiYearComparison = lazyWithRetry(() => import('@/features/kpi/components/KpiYearComparison'))

/** Valeur sentinelle du segment « Tous » : aucun commercial n'a l'id 0. */
const ALL_USERS = 0

// ─── Dashboard Commercial ────────────────────────────────────────────────────
// ADMIN / RESPONSABLE : vue complète (tous secteurs, tous commerciaux).
// COMMERCIAL : ses propres KPI uniquement (le backend scope aussi les données).
export default function DashboardCommercial() {
  const currentUser = useCurrentUser()
  const isManager =
    currentUser?.permission === Permission.ADMIN || currentUser?.permission === Permission.RESPONSABLE

  if (!isManager) {
    return <KpiProfilView userId={Number(currentUser?.id)} canEdit={false} />
  }

  return <KpiDashboard />
}

// ─── Prises de contact (appels) — total + par commercial ────────────────────
function ContactStatsSection() {
  const { data, fetching } = useContactLogStats()
  const { directory } = useStaffDirectory()
  const stats = data?.contactLogStats as { total: number; byUser: { userID: number; count: number }[] } | undefined

  if (fetching && !stats) return null
  if (!stats) return null

  const byUser = [...stats.byUser].sort((a, b) => b.count - a.count)

  return (
    <section>
      <SectionHeader title="Prises de contact" icon={<IconPhone className="h-5 w-5" />} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <Card glass>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ds-text-subtle)]">Total appels</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-[30px] font-extrabold leading-none text-[var(--ds-text)]">{stats.total}</p>
        </Card>
        {byUser.map((u) => {
          const user = directory[String(u.userID)]
          return (
            <Card key={u.userID} glass>
              <div className="flex items-center gap-1.5">
                {user?.initials && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full text-white text-[10px] font-bold" style={{ backgroundColor: user.color }}>
                    {user.initials}
                  </span>
                )}
                <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ds-text-subtle)]">
                  {user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : `Utilisateur #${u.userID}`}
                </p>
              </div>
              <p className="mt-1 font-[family-name:var(--font-display)] text-[30px] font-extrabold leading-none text-[var(--ds-text)]">{u.count}</p>
            </Card>
          )
        })}
      </div>
    </section>
  )
}

function KpiDashboard() {
  const currentYear = new Date().getFullYear()

  const [year, setYear] = useState(currentYear)
  const [site, setSite] = useState<KpiSite>('NORD')
  // Source des chiffres : Combiné (défaut), portefeuille seul ou Excel/saisie seul
  const [source, setSource] = useState<KpiSource>('combine')
  const [chartMode, setChartMode] = useState<ChartMode>('commercial')
  const [tableMode, setTableMode] = useState<'month' | 'week'>('month')
  // Statuts cochés dans le diagramme ; par défaut seul « Oui » est affiché
  const [visibleStatuses, setVisibleStatuses] = useState<KpiMetricColumn[]>(['count_oui'])
  const [modalDraft, setModalDraft] = useState<KpiEntryDraft | null | 'new'>(null)
  // null = tous les commerciaux du secteur ; sinon vue d'un seul commercial
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [selectableUsers, setSelectableUsers] = useState<KpiSelectableUser[]>([])

  const { years, summary, previousSummary, weekly, fetching, error, refresh } = useKpiDashboard(year, site, source)
  // Édition/import seulement quand la source affichée est exactement la table éditée (Excel).
  const isEditableSource = source === 'excel'

  // Les erreurs de chargement remontent en toast plutôt qu'en bandeau : la
  // page reste lisible et le message ne pousse pas le contenu vers le bas.
  useEffect(() => {
    if (error) toast.errorMessage('Impossible de charger les indicateurs', error)
  }, [error])

  // Liste des commerciaux sélectionnables (saisie manuelle) — chargée une fois.
  useEffect(() => {
    fetchKpiUsers()
      .then(setSelectableUsers)
      .catch(() => setSelectableUsers([]))
  }, [])

  // Changer de secteur/année réinitialise la sélection d'un commercial.
  const selectSite = (s: KpiSite) => {
    setSite(s)
    setSelectedUserId(null)
  }
  const selectYear = (y: number) => {
    setYear(y)
    setSelectedUserId(null)
  }

  // Vue filtrée sur un seul commercial (ou tout le secteur si null).
  const viewSummary = useMemo<KpiAnnualSummary | null>(() => {
    if (!summary || selectedUserId == null) return summary
    const user = summary.users.find((u) => u.userId === selectedUserId)
    return { ...summary, users: user ? [user] : [], totals: user?.totals ?? emptyMetrics() }
  }, [summary, selectedUserId])

  const viewWeekly = useMemo<KpiWeeklyDetail | null>(() => {
    if (!weekly || selectedUserId == null) return weekly
    return {
      ...weekly,
      weeks: weekly.weeks
        .map((w) => {
          const user = w.users.find((u) => u.userId === selectedUserId)
          return { ...w, users: user ? [user] : [], totals: user?.metrics ?? emptyMetrics() }
        })
        .filter((w) => w.users.length > 0),
    }
  }, [weekly, selectedUserId])

  const toggleStatus = (key: KpiMetricColumn) => {
    setVisibleStatuses((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    )
  }

  // Années sélectionnables : celles présentes en base + l'année courante
  const selectableYears = [...new Set([currentYear, ...years])].sort((a, b) => a - b)

  const handleImported = (result: KpiImportResult) => {
    if (result.errors.length > 0) {
      toast.warning(
        `Import terminé avec ${result.errors.length} avertissement(s)`,
        `${result.imported} ligne(s) importée(s). ${result.errors.slice(0, 3).join(' · ')}`,
      )
    } else if (result.unmatched.length > 0) {
      toast.warning(
        `${result.imported} ligne(s) importée(s)`,
        `Lignes ignorées, aucun commercial ne correspond : ${result.unmatched.join(', ')}`,
      )
    } else {
      toast.success(`${result.imported} ligne(s) importée(s)`)
    }
    refresh()
  }

  const handleEditMonth = (userId: number, userName: string, month: number, metrics: KpiMetrics) => {
    setModalDraft({ userId, userName, month, week: 0, metrics })
  }

  const handleEditWeek = (userId: number, userName: string, month: number, week: number, metrics: KpiMetrics) => {
    setModalDraft({ userId, userName, month, week, metrics })
  }

  if (fetching && !summary) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Spinner size={32} label="Chargement des indicateurs" />
          <p className="text-sm text-[var(--ds-text-subtle)]">Chargement des indicateurs…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-screen-xl px-4 py-8 sm:px-6 lg:px-8">

        <PageHeader
          eyebrow="Suivi commercial"
          title="Tableau de bord commercial"
          description={
            selectedUserId != null && viewSummary?.users[0]
              ? `${viewSummary.users[0].userName} — secteur ${SITE_LABELS[site]}, ${year}.`
              : `Résultats annuels par commercial — secteur ${SITE_LABELS[site]}, ${year}.`
          }
          actions={
            isEditableSource && (
              <>
                <KpiImportButton
                  site={site}
                  onImported={handleImported}
                  onError={(text) => toast.errorMessage("L'import a échoué", text)}
                />
                <Button size="sm" leftIcon={<IconPlus className="h-4 w-4" />} onClick={() => setModalDraft('new')}>
                  Saisie manuelle
                </Button>
              </>
            )
          }
        />

        {/* ─── Filtres source / année / secteur ────────────────────────────── */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <SegmentedControl
            label="Source des chiffres"
            tone="accent"
            value={source}
            onChange={setSource}
            options={[
              { value: 'combine', label: 'Combiné' },
              { value: 'portefeuille', label: 'Portefeuille' },
              { value: 'excel', label: 'Excel / saisie' },
            ]}
          />
          <SegmentedControl
            label="Année"
            tone="accent"
            value={year}
            onChange={selectYear}
            options={selectableYears.map((y) => ({ value: y, label: y }))}
          />
          <SegmentedControl
            label="Secteur"
            value={site}
            onChange={selectSite}
            options={KPI_SITES.map((s) => ({ value: s, label: SITE_LABELS[s] }))}
          />
        </div>

        {/* ─── Commerciaux du secteur (clic = vue d'un seul) ───────────────── */}
        {summary && summary.users.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--ds-text-subtle)]">
              <IconUsers className="h-4 w-4" />
              Commerciaux
            </span>
            <SegmentedControl
              label="Commercial affiché"
              tone="accent"
              size="sm"
              value={selectedUserId ?? ALL_USERS}
              onChange={(id) => setSelectedUserId(id === ALL_USERS ? null : id)}
              options={[
                { value: ALL_USERS, label: 'Tous' },
                ...summary.users.map((u) => ({
                  // Un commercial archivé n'a plus d'identifiant : l'option
                  // reste visible pour expliquer les chiffres, mais inactive.
                  value: u.userId ?? -Math.abs(summary.users.indexOf(u) + 2),
                  label: u.userId == null ? `${u.userName} (archivé)` : u.userName,
                  disabled: u.userId == null,
                })),
              ]}
            />
          </div>
        )}

        {/* ─── Prises de contact (appels) ──────────────────────────────────── */}
        <div className="mb-8">
          <ContactStatsSection />
        </div>

        {/* ─── Portefeuille temps réel (statuts + appels) ──────────────────── */}
        <div className="mb-8">
          <KpiLiveSection />
        </div>

        {/* ─── Vue globale tous secteurs (clic = page profil) ──────────────── */}
        <div className="mb-8">
          <KpiOverviewSection year={year} />
        </div>

        {viewSummary && (
          <div className="space-y-8">
            {/* ─── Cartes de synthèse ──────────────────────────────────────── */}
            <KpiSummaryCards totals={viewSummary.totals} />

            {/* ─── Diagramme en bâtons ─────────────────────────────────────── */}
            <section>
              <SectionHeader
                title="Statuts de réponse"
                icon={<IconChart className="h-5 w-5" />}
                actions={
                  <SegmentedControl
                    label="Répartition du diagramme"
                    size="sm"
                    value={chartMode}
                    onChange={setChartMode}
                    options={[
                      { value: 'commercial', label: 'Par commercial' },
                      { value: 'month', label: 'Par mois' },
                      { value: 'week', label: 'Par semaine' },
                    ]}
                  />
                }
              />
              {/* Cases à cocher : statuts affichés dans le diagramme */}
              <fieldset className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] px-4 py-2.5 shadow-[var(--shadow-xs)]">
                <legend className="sr-only">Statuts affichés dans le diagramme</legend>
                {KPI_STATUS_METRICS.map((metric) => (
                  <label
                    key={metric.key}
                    className="flex cursor-pointer items-center gap-2 text-[13px] text-[var(--ds-text-muted)]"
                  >
                    <input
                      type="checkbox"
                      checked={visibleStatuses.includes(metric.key)}
                      onChange={() => toggleStatus(metric.key)}
                      className="h-3.5 w-3.5 accent-[var(--color-blue)]"
                    />
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: metric.color }} aria-hidden="true" />
                    {metric.label}
                  </label>
                ))}
              </fieldset>

              <Suspense
                fallback={<LoadingPanel message="Chargement du diagramme…" minHeight={360} />}
              >
                <KpiStatusChart summary={viewSummary} weekly={viewWeekly} mode={chartMode} visibleStatuses={visibleStatuses} />
              </Suspense>
            </section>

            {/* ─── Comparatif N-1 (vue secteur uniquement) ─────────────────── */}
            {previousSummary && selectedUserId == null && (
              <section>
                <SectionHeader title={`Comparatif global « Oui » — ${year - 1} vs ${year}`} />
                <Suspense
                  fallback={<LoadingPanel message="Chargement du comparatif…" minHeight={300} />}
                >
                  <KpiYearComparison year={year} current={viewSummary} previous={previousSummary} />
                </Suspense>
              </section>
            )}

            {/* ─── Tableau détaillé (mensuel / hebdomadaire) ───────────────── */}
            <section>
              <SectionHeader
                title={tableMode === 'month' ? 'Détail par commercial' : 'Détail par semaine'}
                actions={
                  <SegmentedControl
                    label="Granularité du tableau"
                    size="sm"
                    value={tableMode}
                    onChange={setTableMode}
                    options={[
                      { value: 'month', label: 'Par mois' },
                      { value: 'week', label: 'Par semaine' },
                    ]}
                  />
                }
              />
              {tableMode === 'month' ? (
                <KpiTable users={viewSummary.users} totals={viewSummary.totals} onEdit={handleEditMonth} readOnly={!isEditableSource} />
              ) : (
                <KpiWeeklyTable weeks={viewWeekly?.weeks ?? []} onEdit={handleEditWeek} readOnly={!isEditableSource} />
              )}
            </section>
          </div>
        )}
      </div>

      {modalDraft !== null && (
        <KpiEntryModal
          year={year}
          site={site}
          users={selectableUsers}
          draft={modalDraft === 'new' ? null : modalDraft}
          onClose={() => setModalDraft(null)}
          onSaved={() => {
            toast.success('KPI enregistrés')
            refresh()
          }}
        />
      )}
    </div>
  )
}

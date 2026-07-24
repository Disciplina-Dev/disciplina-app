import { Suspense, useEffect, useMemo, useState } from 'react'
import { BarChart3, Plus, AlertTriangle, CheckCircle2, PhoneCall, Users } from 'lucide-react'

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
      <h2 className="mb-4 flex items-center gap-2 text-[17px] font-bold text-gray-900">
        <PhoneCall className="h-5 w-5 text-gray-400" />
        Prises de contact
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_1px_4px_-1px_rgba(0,0,0,0.04)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">Total appels</p>
          <p className="mt-1 text-[28px] font-extrabold leading-none text-gray-900">{stats.total}</p>
        </div>
        {byUser.map((u) => {
          const user = directory[String(u.userID)]
          return (
            <div key={u.userID} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_1px_4px_-1px_rgba(0,0,0,0.04)]">
              <div className="flex items-center gap-1.5">
                {user?.initials && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full text-white text-[10px] font-bold" style={{ backgroundColor: user.color }}>
                    {user.initials}
                  </span>
                )}
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400 truncate">
                  {user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : `Utilisateur #${u.userID}`}
                </p>
              </div>
              <p className="mt-1 text-[28px] font-extrabold leading-none text-gray-900">{u.count}</p>
            </div>
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
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  // null = tous les commerciaux du secteur ; sinon vue d'un seul commercial
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [selectableUsers, setSelectableUsers] = useState<KpiSelectableUser[]>([])

  const { years, summary, previousSummary, weekly, fetching, error, refresh } = useKpiDashboard(year, site, source)
  // Édition/import seulement quand la source affichée est exactement la table éditée (Excel).
  const isEditableSource = source === 'excel'

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
    setNotice(
      result.errors.length > 0
        ? {
            kind: 'error',
            text: `${result.imported} ligne(s) importée(s), ${result.errors.length} avertissement(s) : ${result.errors.slice(0, 3).join(' · ')}`,
          }
        : {
            kind: 'success',
            text:
              result.unmatched.length > 0
                ? `${result.imported} ligne(s) importée(s). Non rattaché(s) à un user (ignoré) : ${result.unmatched.join(', ')}`
                : `${result.imported} ligne(s) importée(s) avec succès.`,
          },
    )
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
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: 'var(--color-background)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue border-t-transparent" />
          <p className="text-sm text-gray-400">Chargement des KPI...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="mx-auto max-w-screen-xl px-4 py-8 sm:px-6 lg:px-8">

        {/* ─── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">
              Suivi commercial
            </p>
            <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-gray-900">
              Tableau de bord Commercial
            </h1>
            <p className="mt-1.5 text-[13px] text-gray-400">
              {selectedUserId != null && viewSummary?.users[0]
                ? `${viewSummary.users[0].userName} — secteur ${SITE_LABELS[site]}, ${year}.`
                : `Résultats annuels par commercial — secteur ${SITE_LABELS[site]}, ${year}.`}
            </p>
          </div>

          {isEditableSource && (
            <div className="flex flex-wrap items-center gap-2">
              <KpiImportButton
                site={site}
                onImported={handleImported}
                onError={(text) => setNotice({ kind: 'error', text })}
              />
              <button
                onClick={() => setModalDraft('new')}
                className="flex items-center gap-2 rounded-lg bg-blue px-3.5 py-2 text-[13px] font-semibold text-white shadow-[0_1px_4px_-1px_rgba(0,0,0,0.08)] transition-colors hover:bg-blue-dark"
              >
                <Plus className="h-4 w-4" />
                Saisie manuelle
              </button>
            </div>
          )}
        </div>

        {/* ─── Filtres source / année / site ───────────────────────────────── */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-xl border border-gray-100 bg-white p-1 shadow-[0_1px_4px_-1px_rgba(0,0,0,0.04)]">
            {([['combine', 'Combiné'], ['portefeuille', 'Portefeuille'], ['excel', 'Excel / saisie']] as const).map(([s, label]) => (
              <button
                key={s}
                onClick={() => setSource(s)}
                className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                  s === source ? 'bg-blue text-white' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-gray-100 bg-white p-1 shadow-[0_1px_4px_-1px_rgba(0,0,0,0.04)]">
            {selectableYears.map((y) => (
              <button
                key={y}
                onClick={() => selectYear(y)}
                className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                  y === year ? 'bg-blue text-white' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {y}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 rounded-xl border border-gray-100 bg-white p-1 shadow-[0_1px_4px_-1px_rgba(0,0,0,0.04)]">
            {KPI_SITES.map((s) => (
              <button
                key={s}
                onClick={() => selectSite(s)}
                className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                  s === site ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {SITE_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* ─── Commerciaux du secteur (clic = vue d'un seul) ───────────────── */}
        {summary && summary.users.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-400">
              <Users className="h-4 w-4" />
              Commerciaux
            </span>
            <button
              onClick={() => setSelectedUserId(null)}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                selectedUserId == null ? 'bg-blue text-white' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'
              }`}
            >
              Tous
            </button>
            {summary.users.map((u) => (
              <button
                key={u.userName}
                onClick={() => u.userId != null && setSelectedUserId(u.userId)}
                disabled={u.userId == null}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                  selectedUserId === u.userId
                    ? 'bg-blue text-white'
                    : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100 disabled:opacity-50 disabled:hover:bg-white'
                }`}
              >
                {u.userName}
                {u.userId == null && <span className="ml-1 text-[10px] text-gray-400">archivé</span>}
              </button>
            ))}
          </div>
        )}

        {/* ─── Notifications ───────────────────────────────────────────────── */}
        {notice && (
          <div
            className={`mb-6 flex items-start gap-2 rounded-xl px-4 py-3 text-[13px] ${
              notice.kind === 'success' ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger'
            }`}
          >
            {notice.kind === 'success'
              ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{notice.text}</span>
            <button onClick={() => setNotice(null)} className="ml-auto font-semibold underline-offset-2 hover:underline">
              Fermer
            </button>
          </div>
        )}

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-xl bg-danger-bg px-4 py-3 text-[13px] text-danger">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
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
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-[17px] font-bold text-gray-900">
                  <BarChart3 className="h-5 w-5 text-gray-400" />
                  Statuts de réponse
                </h2>
                <div className="flex items-center gap-1.5 rounded-xl border border-gray-100 bg-white p-1 shadow-[0_1px_4px_-1px_rgba(0,0,0,0.04)]">
                  {([['commercial', 'Par commercial'], ['month', 'Par mois'], ['week', 'Par semaine']] as const).map(([m, label]) => (
                    <button
                      key={m}
                      onClick={() => setChartMode(m)}
                      className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                        m === chartMode ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Cases à cocher : statuts affichés dans le diagramme */}
              <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-gray-100 bg-white px-4 py-2.5 shadow-[0_1px_4px_-1px_rgba(0,0,0,0.04)]">
                {KPI_STATUS_METRICS.map((metric) => (
                  <label key={metric.key} className="flex cursor-pointer items-center gap-2 text-[13px] text-gray-700">
                    <input
                      type="checkbox"
                      checked={visibleStatuses.includes(metric.key)}
                      onChange={() => toggleStatus(metric.key)}
                      className="h-3.5 w-3.5 accent-[var(--color-blue)]"
                    />
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: metric.color }} />
                    {metric.label}
                  </label>
                ))}
              </div>

              <Suspense
                fallback={
                  <div className="flex h-[360px] items-center justify-center rounded-2xl border border-gray-100 bg-white">
                    <div className="h-6 w-6 animate-spin rounded-full border-4 border-blue border-t-transparent" />
                  </div>
                }
              >
                <KpiStatusChart summary={viewSummary} weekly={viewWeekly} mode={chartMode} visibleStatuses={visibleStatuses} />
              </Suspense>
            </section>

            {/* ─── Comparatif N-1 (vue secteur uniquement) ─────────────────── */}
            {previousSummary && selectedUserId == null && (
              <section>
                <h2 className="mb-4 text-[17px] font-bold text-gray-900">
                  Comparatif Global Oui — {year - 1} vs {year}
                </h2>
                <Suspense
                  fallback={
                    <div className="flex h-[300px] items-center justify-center rounded-2xl border border-gray-100 bg-white">
                      <div className="h-6 w-6 animate-spin rounded-full border-4 border-blue border-t-transparent" />
                    </div>
                  }
                >
                  <KpiYearComparison year={year} current={viewSummary} previous={previousSummary} />
                </Suspense>
              </section>
            )}

            {/* ─── Tableau détaillé (mensuel / hebdomadaire) ───────────────── */}
            <section>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[17px] font-bold text-gray-900">
                  {tableMode === 'month' ? 'Détail par commercial' : 'Détail par semaine'}
                </h2>
                <div className="flex items-center gap-1.5 rounded-xl border border-gray-100 bg-white p-1 shadow-[0_1px_4px_-1px_rgba(0,0,0,0.04)]">
                  {([['month', 'Par mois'], ['week', 'Par semaine']] as const).map(([m, label]) => (
                    <button
                      key={m}
                      onClick={() => setTableMode(m)}
                      className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                        m === tableMode ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
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
            setNotice({ kind: 'success', text: 'KPI enregistrés.' })
            refresh()
          }}
        />
      )}
    </div>
  )
}

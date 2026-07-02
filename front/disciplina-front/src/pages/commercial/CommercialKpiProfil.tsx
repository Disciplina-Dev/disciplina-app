import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, MapPin } from 'lucide-react'

import { useAuthStore, useCurrentUser, UserRole } from '@/store/authStore'
import {
  fetchKpiLive,
  fetchKpiUserDetail,
  fetchKpiUsers,
  fetchKpiYears,
  type KpiLiveSnapshot,
  type KpiMetrics,
  type KpiSelectableUser,
  type KpiUserDetail,
  type KpiUserSiteDetail,
} from '@/api/kpi'
import { SITE_LABELS, emptyMetrics, KPI_METRICS } from '@/features/kpi/config'
import KpiSummaryCards from '@/features/kpi/components/KpiSummaryCards'
import KpiTable from '@/features/kpi/components/KpiTable'
import KpiWeeklyTable from '@/features/kpi/components/KpiWeeklyTable'
import KpiEntryModal, { type KpiEntryDraft } from '@/features/kpi/components/KpiEntryModal'

/**
 * Page de profil KPI d'un commercial. ADMIN/RESPONSABLE consultent n'importe
 * quel profil ; un COMMERCIAL est ramené à son tableau de bord s'il tente
 * d'ouvrir le profil d'un autre (le backend refuse aussi, 403).
 */
export default function CommercialKpiProfil() {
  const currentUser = useCurrentUser()
  const { userId } = useParams<{ userId: string }>()
  const isManager =
    currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.RESPONSABLE
  const ownId = Number(currentUser?.id)

  if (!isManager && Number(userId) !== ownId) {
    return <Navigate to="/commercial" replace />
  }

  return <KpiProfilView userId={Number(userId)} canEdit={isManager} showBack />
}

interface KpiProfilViewProps {
  userId: number
  /** true = ADMIN/RESPONSABLE : édition des valeurs via le crayon. */
  canEdit: boolean
  /** Lien retour vers le dashboard (masqué quand la vue est intégrée au dashboard). */
  showBack?: boolean
}

/** Vue profil KPI réutilisable : page dédiée (managers) ou dashboard du commercial. */
export function KpiProfilView({ userId: id, canEdit, showBack = false }: KpiProfilViewProps) {
  const token = useAuthStore((s) => s.token)
  const currentYear = new Date().getFullYear()

  const [year, setYear] = useState(currentYear)
  const [years, setYears] = useState<number[]>([])
  const [detail, setDetail] = useState<KpiUserDetail | null>(null)
  const [live, setLive] = useState<KpiLiveSnapshot | null>(null)
  const [selectableUsers, setSelectableUsers] = useState<KpiSelectableUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  // Modal d'édition : le secteur vient de la section cliquée
  const [modal, setModal] = useState<{ site: KpiUserSiteDetail['site']; draft: KpiEntryDraft } | null>(null)

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  useEffect(() => {
    if (!token) return
    fetchKpiYears(token).then(setYears).catch(() => setYears([]))
    // Liste des commerciaux : réservée aux managers (saisie manuelle uniquement).
    if (canEdit) fetchKpiUsers(token).then(setSelectableUsers).catch(() => setSelectableUsers([]))
    fetchKpiLive(token).then(setLive).catch(() => setLive(null))
  }, [token, canEdit])

  useEffect(() => {
    if (!token || !Number.isInteger(id)) return
    let cancelled = false
    fetchKpiUserDetail(token, id, year)
      .then((data) => {
        if (!cancelled) {
          setDetail(data)
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erreur de chargement du profil KPI')
      })
    return () => {
      cancelled = true
    }
  }, [token, id, year, refreshKey])

  const selectableYears = [...new Set([currentYear, ...years])].sort((a, b) => a - b)

  if (error) {
    return (
      <div className="mx-auto max-w-screen-xl px-4 py-8 sm:px-6 lg:px-8">
        {showBack && <BackLink />}
        <div className="mt-6 flex items-center gap-2 rounded-xl bg-danger-bg px-4 py-3 text-[13px] text-danger">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: 'var(--color-background)' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue border-t-transparent" />
      </div>
    )
  }

  const handleEditMonth =
    (site: KpiUserSiteDetail['site']) => (uid: number, userName: string, month: number, metrics: KpiMetrics) =>
      setModal({ site, draft: { userId: uid, userName, month, week: 0, metrics } })

  const handleEditWeek =
    (site: KpiUserSiteDetail['site']) =>
    (uid: number, userName: string, month: number, week: number, metrics: KpiMetrics) =>
      setModal({ site, draft: { userId: uid, userName, month, week, metrics } })

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="mx-auto max-w-screen-xl px-4 py-8 sm:px-6 lg:px-8">
        {showBack && <BackLink />}

        {/* ─── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-8 mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">
              {showBack ? 'Profil KPI commercial' : 'Mes KPI'}
            </p>
            <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-gray-900">
              {detail.userName}
            </h1>
            <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-gray-400">
              <MapPin className="h-3.5 w-3.5" />
              {detail.sites.length > 0
                ? detail.sites.map((s) => SITE_LABELS[s.site]).join(' · ')
                : 'Aucun secteur avec des données cette année'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-gray-100 bg-white p-1 shadow-[0_1px_4px_-1px_rgba(0,0,0,0.04)]">
            {selectableYears.map((y) => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                  y === year ? 'bg-blue text-white' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-8">
          {/* ─── Portefeuille actuel du commercial ────────────────────────── */}
          <LivePortfolioSection live={live} userId={detail.userId} />

          {/* ─── Totaux annuels tous secteurs ─────────────────────────────── */}
          <section>
            <h2 className="mb-4 text-[17px] font-bold text-gray-900">KPI annuels — {year}</h2>
            <KpiSummaryCards totals={detail.totals} />
          </section>

          {detail.sites.length === 0 && (
            <p className="rounded-2xl border border-gray-100 bg-white px-4 py-10 text-center text-[13px] text-gray-400">
              Aucune donnée KPI pour {detail.userName} en {year}.
            </p>
          )}

          {/* ─── Détail par secteur ───────────────────────────────────────── */}
          {detail.sites.map((site) => (
            <section key={site.site}>
              <h2 className="mb-4 text-[17px] font-bold text-gray-900">
                Secteur {SITE_LABELS[site.site]}
              </h2>
              <div className="space-y-6">
                <KpiTable
                  users={[{ userId: detail.userId, userName: detail.userName, totals: site.totals, months: site.months }]}
                  totals={site.totals}
                  onEdit={handleEditMonth(site.site)}
                  readOnly={!canEdit}
                />
                {site.weeks.length > 0 && (
                  <KpiWeeklyTable
                    weeks={site.weeks.map((w) => ({
                      week: w.week,
                      month: w.month,
                      totals: w.metrics,
                      users: [{ userId: detail.userId, userName: detail.userName, metrics: w.metrics }],
                    }))}
                    onEdit={handleEditWeek(site.site)}
                    readOnly={!canEdit}
                  />
                )}
              </div>
            </section>
          ))}
        </div>
      </div>

      {canEdit && modal && (
        <KpiEntryModal
          year={year}
          site={modal.site}
          users={selectableUsers}
          draft={modal.draft}
          onClose={() => setModal(null)}
          onSaved={refresh}
        />
      )}
    </div>
  )
}

/** Valeurs actuelles du portefeuille du commercial, par secteur. */
function LivePortfolioSection({ live, userId }: { live: KpiLiveSnapshot | null; userId: number }) {
  if (!live) return null

  const sites = live.sites
    .map((site) => ({ site: site.site, user: site.users.find((u) => u.userId === userId) }))
    .filter((s): s is { site: (typeof live.sites)[number]['site']; user: NonNullable<(typeof live.sites)[number]['users'][number]> } => s.user != null)

  if (sites.length === 0) return null

  const totals = sites.reduce((acc, { user }) => {
    for (const m of KPI_METRICS) acc[m.key] += user.totals[m.key]
    return acc
  }, emptyMetrics())

  return (
    <section>
      <h2 className="mb-4 text-[17px] font-bold text-gray-900">
        Portefeuille — valeurs actuelles
        <span className="ml-2 text-[12px] font-medium text-gray-400">
          {sites.map((s) => SITE_LABELS[s.site]).join(' · ')} ·{' '}
          {totals.total_trie.toLocaleString('fr-FR')} entreprise(s)
        </span>
      </h2>
      <KpiSummaryCards totals={totals} />
    </section>
  )
}

function BackLink() {
  return (
    <Link
      to="/commercial"
      className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-gray-500 transition-colors hover:text-gray-900"
    >
      <ArrowLeft className="h-4 w-4" />
      Tableau de bord Commercial
    </Link>
  )
}

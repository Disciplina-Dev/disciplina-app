import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Globe2, Briefcase, ChevronRight } from 'lucide-react'

import { useAuthStore } from '@/store/authStore'
import {
  fetchKpiCombined,
  fetchKpiLive,
  KPI_SITES,
  type KpiMetricColumn,
  type KpiSiteOverview,
} from '@/api/kpi'
import { SITE_LABELS } from '../config'

/** Compteurs mis en avant sur chaque carte commercial. */
const ANNUAL_CARD_METRICS: { key: KpiMetricColumn; label: string }[] = [
  { key: 'count_oui', label: 'Oui' },
  { key: 'total_appels', label: 'Appels' },
  { key: 'visites_terrain', label: 'Visites' },
]

const LIVE_CARD_METRICS: { key: KpiMetricColumn; label: string }[] = [
  { key: 'count_oui', label: 'Oui' },
  { key: 'total_appels', label: 'Appels' },
  { key: 'nbre_ent_ouvert', label: 'Ent. ouvertes' },
]

interface SectorGridProps {
  sites: KpiSiteOverview[]
  cardMetrics: { key: KpiMetricColumn; label: string }[]
}

/** Grille par secteur : cartes commerciaux cliquables vers la page profil. */
function KpiSectorGrid({ sites, cardMetrics }: SectorGridProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {sites.map((site) => (
        <div
          key={site.site}
          className="rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]"
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[14px] font-bold text-gray-900">{SITE_LABELS[site.site]}</h3>
            <span className="text-[12px] text-gray-400">
              {site.totals.count_oui.toLocaleString('fr-FR')} Oui ·{' '}
              {site.totals.total_appels.toLocaleString('fr-FR')} appels
            </span>
          </div>
          <div className="space-y-2">
            {site.users.length === 0 && (
              <p className="px-1 py-2 text-[12px] text-gray-400">Aucune donnée pour ce secteur.</p>
            )}
            {site.users.map((user) => {
              const cells = (
                <span className="flex items-center gap-3">
                  {cardMetrics.map((m) => (
                    <span key={m.key} className="text-right">
                      <span className="block text-[10px] font-medium uppercase tracking-wide text-gray-400">
                        {m.label}
                      </span>
                      <span className="block text-[13px] font-bold tabular-nums text-gray-900">
                        {user.totals[m.key].toLocaleString('fr-FR')}
                      </span>
                    </span>
                  ))}
                </span>
              )
              return user.userId != null ? (
                <Link
                  key={`${user.userId}`}
                  to={`/commercial/kpi/${user.userId}`}
                  className="group flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2.5 transition-colors hover:border-blue/40 hover:bg-blue/5"
                >
                  <span className="text-[13px] font-semibold text-gray-900">{user.userName}</span>
                  <span className="flex items-center gap-2">
                    {cells}
                    <ChevronRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-blue" />
                  </span>
                </Link>
              ) : (
                <div
                  key={user.userName}
                  className="flex items-center justify-between rounded-xl border border-gray-50 bg-gray-50/50 px-3 py-2.5"
                >
                  <span className="text-[13px] font-semibold text-gray-400">{user.userName}</span>
                  {cells}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function SectionShell({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 flex items-center gap-2 text-[17px] font-bold text-gray-900">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  )
}

/**
 * Valeurs actuelles du portefeuille : statuts des entreprises et appels loggés,
 * par secteur et par commercial. Toujours à jour, indépendant de l'année.
 */
export function KpiLiveSection() {
  const token = useAuthStore((s) => s.token)
  const [sites, setSites] = useState<KpiSiteOverview[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    fetchKpiLive(token)
      .then((data) => {
        if (!cancelled) setSites(data.sites)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erreur de chargement du portefeuille')
      })
    return () => {
      cancelled = true
    }
  }, [token])

  if (error) return <p className="text-[13px] text-danger">{error}</p>
  if (!sites) return null

  return (
    <SectionShell
      icon={<Briefcase className="h-5 w-5 text-gray-400" />}
      title="Portefeuille — valeurs actuelles par secteur"
    >
      <KpiSectorGrid sites={sites} cardMetrics={LIVE_CARD_METRICS} />
    </SectionShell>
  )
}

/**
 * Vue globale annuelle combinée (Excel prioritaire + portefeuille) : tous les
 * commerciaux regroupés par secteur, chaque carte renvoie vers la page profil.
 */
export default function KpiOverviewSection({ year }: { year: number }) {
  const token = useAuthStore((s) => s.token)
  const [sites, setSites] = useState<KpiSiteOverview[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    Promise.allSettled(KPI_SITES.map((site) => fetchKpiCombined(token, year, site)))
      .then((results) => {
        if (cancelled) return
        const sites: KpiSiteOverview[] = results
          .map((r, i) => {
            if (r.status === 'fulfilled') {
              return {
                site: KPI_SITES[i],
                totals: r.value.summary.totals,
                users: r.value.summary.users.map((u) => ({ userId: u.userId, userName: u.userName, totals: u.totals })),
              }
            }
            return null
          })
          .filter((s): s is KpiSiteOverview => s != null)
        setSites(sites)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erreur de chargement de la vue globale')
      })
    return () => {
      cancelled = true
    }
  }, [token, year])

  if (error) return <p className="text-[13px] text-danger">{error}</p>
  if (!sites || sites.every((s) => s.users.length === 0)) return null

  return (
    <SectionShell
      icon={<Globe2 className="h-5 w-5 text-gray-400" />}
      title={`Vue globale par secteur — ${year}`}
    >
      <KpiSectorGrid sites={sites.filter((s) => s.users.length > 0)} cardMetrics={ANNUAL_CARD_METRICS} />
    </SectionShell>
  )
}

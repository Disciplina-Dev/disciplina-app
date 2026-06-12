import { lazy, Suspense, useMemo, useState } from 'react'
import { BarChart3, Users, Table2, AlertTriangle } from 'lucide-react'

import { useCurrentUser, UserRole, USERS } from '@/store/authStore'
import { useCompanyStats } from '@/features/dashboard/useCompanyStats'
import { TRACKED_COMMERCIALS, type PeriodMode } from '@/features/dashboard/stats'
import KpiCards from '@/features/dashboard/components/KpiCards'
import TeamStatusGrid from '@/features/dashboard/components/TeamStatusGrid'
import TotalsTable from '@/features/dashboard/components/TotalsTable'

// recharts est lourd : chargé à la demande pour ne pas grossir le bundle principal
const PeriodBarChart = lazy(() => import('@/features/dashboard/components/PeriodBarChart'))

// ─── Dashboard Commercial — vue analytique ──────────────────────────────────
export default function DashboardCommercial() {
  const currentUser = useCurrentUser()
  const currentYear = new Date().getFullYear()

  const [year, setYear] = useState(currentYear)
  const [mode, setMode] = useState<PeriodMode>('week')

  const { stats, fetching, error } = useCompanyStats(year)

  const isManager =
    currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.RESPONSABLE

  // Managers comparent toute l'équipe ; un commercial ne voit que ses propres chiffres
  // (le backend filtre déjà côté serveur, ceci ne fait qu'aligner l'affichage).
  const commercials = useMemo(() => {
    if (isManager) return TRACKED_COMMERCIALS
    const self = currentUser ? USERS[String(currentUser.id)] ?? currentUser : null
    return self ? [self] : []
  }, [isManager, currentUser])

  // Années sélectionnables : celles présentes en base + l'année courante
  const years = useMemo(() => {
    const set = new Set<number>([currentYear, ...(stats?.years ?? [])])
    return [...set].sort((a, b) => a - b)
  }, [stats, currentYear])

  if (fetching && !stats) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: 'var(--color-background)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue border-t-transparent" />
          <p className="text-sm text-gray-400">Chargement du dashboard...</p>
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
              Vue d'ensemble
            </p>
            <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-gray-900">
              Dashboard Commercial
            </h1>
            <p className="mt-1.5 text-[13px] text-gray-400">
              {isManager
                ? 'Suivez les performances de toute l\'équipe.'
                : 'Suivez vos performances commerciales.'}
            </p>
          </div>

          {/* Sélecteur d'année */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-gray-100 bg-white p-1 shadow-[0_1px_4px_-1px_rgba(0,0,0,0.04)]">
            {years.map((y) => (
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

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-danger/20 bg-danger-bg p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-danger" />
            <p className="text-[13px] font-medium text-danger">
              Erreur lors du chargement des statistiques : {error.message}
            </p>
          </div>
        )}

        {stats && (
          <>
            {/* ─── KPIs statuts (snapshot actuel) ──────────────────────────── */}
            <section className="mb-10">
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-gray-400" />
                <h2 className="text-[18px] font-bold text-gray-900">Statuts actuels</h2>
              </div>
              <KpiCards current={stats.current} />
            </section>

            {/* ─── Par commercial (managers uniquement) ────────────────────── */}
            {isManager && (
              <section className="mb-10">
                <div className="mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5 text-gray-400" />
                  <h2 className="text-[18px] font-bold text-gray-900">Par commercial</h2>
                </div>
                <TeamStatusGrid current={stats.current} />
              </section>
            )}

            {/* ─── Comparatif par période ──────────────────────────────────── */}
            <section className="mb-10">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-gray-400" />
                  <h2 className="text-[18px] font-bold text-gray-900">
                    {isManager ? `Comparatif équipe — ${year}` : `Mon activité — ${year}`}
                  </h2>
                </div>

                {/* Toggle semaine / mois */}
                <div className="flex items-center gap-1 rounded-xl border border-gray-100 bg-white p-1">
                  {(['week', 'month'] as PeriodMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                        m === mode ? 'bg-blue text-white' : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {m === 'week' ? 'Par semaine' : 'Par mois'}
                    </button>
                  ))}
                </div>
              </div>

              <Suspense
                fallback={
                  <div className="flex h-[340px] items-center justify-center rounded-2xl border border-gray-100 bg-white">
                    <div className="h-6 w-6 animate-spin rounded-full border-4 border-blue border-t-transparent" />
                  </div>
                }
              >
                <PeriodBarChart byPeriod={stats.byPeriod} commercials={commercials} mode={mode} year={year} />
              </Suspense>
            </section>

            {/* ─── Tableau des totaux ──────────────────────────────────────── */}
            <section className="mb-10">
              <div className="mb-4 flex items-center gap-2">
                <Table2 className="h-5 w-5 text-gray-400" />
                <h2 className="text-[18px] font-bold text-gray-900">
                  Totaux {mode === 'week' ? 'hebdomadaires' : 'mensuels'} — {year}
                </h2>
              </div>
              <TotalsTable byPeriod={stats.byPeriod} commercials={commercials} mode={mode} year={year} />
            </section>
          </>
        )}

      </div>
    </div>
  )
}

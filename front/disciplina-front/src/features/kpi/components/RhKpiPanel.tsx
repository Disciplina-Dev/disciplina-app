import { useEffect, useMemo, useState } from 'react'
import {
  CalendarPlus, UserCheck, UserX, Briefcase, FileSignature, Unlink,
  Loader2, AlertCircle, RefreshCw,
} from 'lucide-react'
import { useAuthStore, UserRole } from '@/store/authStore'
import {
  fetchRhKpiReport, fetchRhKpiYears, emptyRhMetrics, sumMetrics,
  type RhKpiColumn, type RhKpiMetrics, type RhKpiReport,
} from '@/api/rhKpi'

// Charte graphique (cf. index.css).
const COLORS = {
  blue: '#1130A7', purple: '#60207E', pink: '#B10F55',
  success: '#1A7A4A', warning: '#A65C00', danger: '#C0152A',
}

const METRICS: { key: RhKpiColumn; label: string; icon: typeof CalendarPlus; color: string }[] = [
  { key: 'interviews_placed', label: 'Entretiens placés', icon: CalendarPlus, color: COLORS.blue },
  { key: 'interviews_attended', label: 'Présents en entretien', icon: UserCheck, color: COLORS.success },
  { key: 'interviews_noshow', label: 'Absents', icon: UserX, color: COLORS.danger },
  { key: 'immersions', label: 'Immersions', icon: Briefcase, color: COLORS.pink },
  { key: 'contracts', label: 'Contrats', icon: FileSignature, color: COLORS.purple },
  { key: 'ruptures', label: 'Ruptures', icon: Unlink, color: COLORS.warning },
]

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

type Granularity = 'week' | 'month' | 'year'

/** Numéro de semaine ISO 8601 d'une date (1-53). */
function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - day + 3)
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const firstDay = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3)
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86_400_000))
}

export default function RhKpiPanel() {
  const token = useAuthStore((s) => s.token)
  const role = useAuthStore((s) => s.user?.role)
  const isAggregate = role === UserRole.ADMIN || role === UserRole.RESPONSABLE

  const now = useMemo(() => new Date(), [])
  const [year, setYear] = useState(now.getFullYear())
  const [years, setYears] = useState<number[]>([now.getFullYear()])
  const [gran, setGran] = useState<Granularity>('month')
  const [month, setMonth] = useState(now.getMonth() + 1) // 1-12
  const [week, setWeek] = useState(isoWeek(now))

  const [report, setReport] = useState<RhKpiReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    if (!token) return
    setLoading(true); setError(null)
    fetchRhKpiReport(token, year)
      .then(setReport)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!token) return
    fetchRhKpiYears(token)
      .then((ys) => setYears(ys.includes(now.getFullYear()) ? ys : [now.getFullYear(), ...ys]))
      .catch(() => { /* liste d'années best-effort */ })
  }, [token, now])

  useEffect(load, [token, year])

  // Semaines retenues selon la granularité choisie.
  const selectedWeeks = useMemo(() => {
    if (!report) return []
    if (gran === 'year') return report.weeks
    if (gran === 'month') return report.weeks.filter((w) => w.month === month)
    return report.weeks.filter((w) => w.week === week)
  }, [report, gran, month, week])

  const totals = useMemo(() => sumMetrics(selectedWeeks.map((w) => w.totals)), [selectedWeeks])

  // Détail par RH (somme sur les semaines retenues) — uniquement pour les vues agrégées.
  const perUser = useMemo(() => {
    if (!isAggregate) return []
    const map = new Map<number, { name: string; metrics: RhKpiMetrics }>()
    for (const w of selectedWeeks) {
      for (const u of w.users) {
        const cur = map.get(u.userId) ?? { name: u.userName, metrics: emptyRhMetrics() }
        cur.metrics = sumMetrics([cur.metrics, u.metrics])
        map.set(u.userId, cur)
      }
    }
    return [...map.entries()]
      .map(([userId, v]) => ({ userId, ...v }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [selectedWeeks, isAggregate])

  const periodLabel = gran === 'year' ? `Année ${year}`
    : gran === 'month' ? `${MONTHS[month - 1]} ${year}`
    : `Semaine ${week} · ${year}`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Indicateurs RH</h2>
          <p className="text-sm text-gray-500">
            {periodLabel}{isAggregate ? ' · tous les RH' : ' · mes chiffres'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Granularité */}
          <div className="flex rounded-[10px] border border-gray-200 bg-white p-0.5">
            {(['week', 'month', 'year'] as Granularity[]).map((g) => (
              <button key={g} onClick={() => setGran(g)}
                className={`rounded-[8px] px-3 py-1.5 text-[13px] font-bold transition-colors ${gran === g ? 'bg-purple text-white' : 'text-gray-500 hover:text-gray-800'}`}>
                {g === 'week' ? 'Semaine' : g === 'month' ? 'Mois' : 'Année'}
              </button>
            ))}
          </div>
          {gran === 'week' && (
            <select value={week} onChange={(e) => setWeek(Number(e.target.value))} className={selectCls}>
              {Array.from({ length: 53 }, (_, i) => i + 1).map((w) => (
                <option key={w} value={w}>Sem. {w}</option>
              ))}
            </select>
          )}
          {gran === 'month' && (
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={selectCls}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          )}
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={selectCls}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={load} className="flex items-center gap-2 rounded-[10px] border border-gray-100 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="animate-spin text-purple" size={28} />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 rounded-xl bg-danger-bg p-3 text-sm text-danger">
          <AlertCircle size={16} /> {error}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {METRICS.map((m) => (
              <div key={m.key} className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${m.color}14`, color: m.color }}>
                  <m.icon size={24} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-500">{m.label}</p>
                  <p className="text-2xl font-extrabold text-black">{totals[m.key]}</p>
                </div>
              </div>
            ))}
          </div>

          {isAggregate && perUser.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    <th className="px-4 py-3">RH</th>
                    {METRICS.map((m) => <th key={m.key} className="px-3 py-3 text-right">{m.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {perUser.map((u) => (
                    <tr key={u.userId} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-2.5 font-semibold text-gray-700">{u.name}</td>
                      {METRICS.map((m) => (
                        <td key={m.key} className="px-3 py-2.5 text-right tabular-nums text-gray-600">{u.metrics[m.key]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const selectCls = 'rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-[13px] font-bold text-gray-700 outline-none focus:border-purple'

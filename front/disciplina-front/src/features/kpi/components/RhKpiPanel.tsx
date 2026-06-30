import { useEffect, useMemo, useState } from 'react'
import {
  CalendarPlus, CalendarClock, UserCheck, UserX, Briefcase, FileSignature, Unlink,
  Loader2, AlertCircle, RefreshCw,
} from 'lucide-react'
import { useAuthStore, UserRole } from '@/store/authStore'
import {
  fetchRhKpiReport, fetchRhKpiYears, emptyRhMetrics, sumMetrics, upcoming,
  type RhKpiColumn, type RhKpiMetrics, type RhKpiReport,
} from '@/api/rhKpi'

// Charte graphique (cf. index.css).
const COLORS = {
  blue: '#1130A7', purple: '#60207E', pink: '#B10F55',
  success: '#1A7A4A', warning: '#A65C00', danger: '#C0152A', slate: '#475569',
}

/** Carte/colonne KPI. `derived` = calculée (pas une colonne stockée). */
type CardDef =
  | { key: RhKpiColumn; derived?: false; label: string; icon: typeof CalendarPlus; color: string }
  | { key: 'upcoming'; derived: true; label: string; icon: typeof CalendarPlus; color: string }

const CARDS: CardDef[] = [
  { key: 'interviews_placed', label: 'Entretiens placés', icon: CalendarPlus, color: COLORS.blue },
  { key: 'upcoming', derived: true, label: 'À venir', icon: CalendarClock, color: COLORS.slate },
  { key: 'interviews_attended', label: 'Venus', icon: UserCheck, color: COLORS.success },
  { key: 'interviews_noshow', label: 'Pas venus', icon: UserX, color: COLORS.danger },
  { key: 'immersions', label: 'Immersions', icon: Briefcase, color: COLORS.pink },
  { key: 'contracts', label: 'Contrats', icon: FileSignature, color: COLORS.purple },
  { key: 'ruptures', label: 'Ruptures', icon: Unlink, color: COLORS.warning },
]

/** Valeur d'une carte pour un jeu de métriques (gère le dérivé « à venir »). */
function cardValue(def: CardDef, m: RhKpiMetrics): number {
  return def.derived ? upcoming(m) : m[def.key]
}

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

// Secteurs canoniques toujours proposés (même sans données), comme les sites commerciaux.
const CANON_SECTORS = ['Nord-Est', 'Ouest', 'Sud']

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

/**
 * `sectors` + `hideSelector` = mode contrôlé : le filtre secteur est piloté par
 * le parent (sélecteur partagé du dashboard), et le sélecteur interne est masqué.
 * Sans ces props, le panneau garde son propre sélecteur de secteur.
 */
export default function RhKpiPanel({
  sectors: extSectors,
  hideSelector = false,
}: { sectors?: string[] | null; hideSelector?: boolean } = {}) {
  const token = useAuthStore((s) => s.token)
  const role = useAuthStore((s) => s.user?.role)
  const isAggregate = role === UserRole.ADMIN || role === UserRole.RESPONSABLE

  const now = useMemo(() => new Date(), [])
  const [year, setYear] = useState(now.getFullYear())
  const [years, setYears] = useState<number[]>([now.getFullYear()])
  const [gran, setGran] = useState<Granularity>('month')
  const [month, setMonth] = useState(now.getMonth() + 1) // 1-12
  const [week, setWeek] = useState(isoWeek(now))
  // Secteurs sélectionnés (multi). null = tous ; sinon affiche 1, 2 ou 3 secteurs cumulés.
  const [selectedSectors, setSelectedSectors] = useState<Set<string> | null>(null)

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

  // Secteurs proposés au filtre : canoniques + tout secteur présent dans les données.
  const sectors = useMemo(() => {
    const set = new Set<string>(CANON_SECTORS)
    if (report) for (const w of report.weeks) for (const u of w.users) if (u.sector) set.add(u.sector)
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [report])

  const toggleSector = (s: string) => {
    setSelectedSectors((prev) => {
      // Depuis « Tous » : un clic sélectionne uniquement ce secteur.
      if (!prev) return new Set([s])
      const next = new Set(prev)
      if (next.has(s)) next.delete(s); else next.add(s)
      // Plus rien coché, ou tout coché → retour à l'état « tous » (null).
      if (next.size === 0 || (next.size === sectors.length && sectors.every((x) => next.has(x)))) return null
      return next
    })
  }

  // Secteurs effectivement appliqués : pilotés par le parent en mode contrôlé,
  // sinon par l'état interne. null/[] = tous les secteurs.
  const effectiveSectors = useMemo<string[] | null>(() => {
    if (hideSelector) return extSectors && extSectors.length > 0 ? extSectors : null
    return selectedSectors ? [...selectedSectors] : null
  }, [hideSelector, extSectors, selectedSectors])

  // Entrées (utilisateur × secteur) des semaines retenues, filtrées par secteurs choisis.
  const entries = useMemo(() => {
    const flat = selectedWeeks.flatMap((w) => w.users)
    if (!effectiveSectors) return flat
    const set = new Set(effectiveSectors)
    return flat.filter((u) => set.has(u.sector))
  }, [selectedWeeks, effectiveSectors])

  const totals = useMemo(() => sumMetrics(entries.map((e) => e.metrics)), [entries])

  // Détail par RH / responsable (somme par utilisateur) — uniquement en vue agrégée.
  const perUser = useMemo(() => {
    if (!isAggregate) return []
    const map = new Map<number, { name: string; metrics: RhKpiMetrics }>()
    for (const u of entries) {
      const cur = map.get(u.userId) ?? { name: u.userName, metrics: emptyRhMetrics() }
      cur.metrics = sumMetrics([cur.metrics, u.metrics])
      map.set(u.userId, cur)
    }
    return [...map.entries()]
      .map(([userId, v]) => ({ userId, ...v }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [entries, isAggregate])

  const periodLabel = gran === 'year' ? `Année ${year}`
    : gran === 'month' ? `${MONTHS[month - 1]} ${year}`
    : `Semaine ${week} · ${year}`
  const scopeLabel = isAggregate ? 'tous les RH' : 'mes chiffres'
  const sectorLabel = !effectiveSectors ? 'tous secteurs' : effectiveSectors.join(' · ') || 'aucun secteur'
  const isSectorOn = (s: string) => !selectedSectors || selectedSectors.has(s)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Indicateurs RH</h2>
          <p className="text-sm text-gray-500">{periodLabel} · {scopeLabel} · {sectorLabel}</p>
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
          {!hideSelector && sectors.length > 0 && (
            <div className="flex items-center gap-1 rounded-[10px] border border-gray-200 bg-white p-0.5">
              <button
                onClick={() => setSelectedSectors(null)}
                className={`rounded-[8px] px-3 py-1.5 text-[13px] font-bold transition-colors ${!selectedSectors ? 'bg-purple text-white' : 'text-gray-500 hover:text-gray-800'}`}
              >
                Tous
              </button>
              {sectors.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleSector(s)}
                  className={`rounded-[8px] px-3 py-1.5 text-[13px] font-bold transition-colors ${selectedSectors && isSectorOn(s) ? 'bg-purple text-white' : 'text-gray-500 hover:text-gray-800'}`}
                >
                  {s}
                </button>
              ))}
            </div>
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
            {CARDS.map((m) => (
              <div key={m.key} className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${m.color}14`, color: m.color }}>
                  <m.icon size={24} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-500">{m.label}</p>
                  <p className="text-2xl font-extrabold text-black">{cardValue(m, totals)}</p>
                </div>
              </div>
            ))}
          </div>

          {isAggregate && perUser.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
              <div className="px-4 pt-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Détail par RH / responsable
              </div>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    <th className="px-4 py-3">RH</th>
                    {CARDS.map((m) => <th key={m.key} className="px-3 py-3 text-right">{m.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {perUser.map((u) => (
                    <tr key={u.userId} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-2.5 font-semibold text-gray-700">{u.name}</td>
                      {CARDS.map((m) => (
                        <td key={m.key} className="px-3 py-2.5 text-right tabular-nums text-gray-600">{cardValue(m, u.metrics)}</td>
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

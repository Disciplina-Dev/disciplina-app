import { useState } from 'react'
import { ChevronDown, ChevronRight, Pencil } from 'lucide-react'

import type { KpiMetrics, KpiWeekEntry } from '@/api/kpi'
import { KPI_METRICS, MONTH_FULL_LABELS } from '../config'

interface Props {
  weeks: KpiWeekEntry[]
  onEdit: (userId: number, userName: string, month: number, week: number, metrics: KpiMetrics) => void
  /** true = données calculées (portefeuille) : pas d'édition. */
  readOnly?: boolean
}

function MetricCells({ metrics, muted = false }: { metrics: KpiMetrics; muted?: boolean }) {
  return (
    <>
      {KPI_METRICS.map((m) => (
        <td
          key={m.key}
          className={`whitespace-nowrap px-3 py-2.5 text-right tabular-nums ${
            metrics[m.key] === 0 ? 'text-gray-300' : muted ? 'text-gray-500' : 'text-gray-900'
          }`}
        >
          {metrics[m.key].toLocaleString('fr-FR')}
        </td>
      ))}
    </>
  )
}

/** Tableau hebdomadaire façon feuille « C.R Sem. » : une ligne par semaine, dépliable par commercial. */
export default function KpiWeeklyTable({ weeks, onEdit, readOnly = false }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const toggle = (week: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(week)) next.delete(week)
      else next.add(week)
      return next
    })
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="px-4 py-3 text-left font-semibold text-gray-500">Semaine</th>
              {KPI_METRICS.map((m) => (
                <th key={m.key} className="whitespace-nowrap px-3 py-3 text-right font-semibold text-gray-500">
                  {m.label}
                </th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {weeks.length === 0 && (
              <tr>
                <td colSpan={KPI_METRICS.length + 2} className="px-4 py-10 text-center text-gray-400">
                  Aucune donnée hebdomadaire pour cette année. Importez le fichier Excel (feuilles « C.R Sem. »).
                </td>
              </tr>
            )}

            {weeks.map((entry) => {
              const isOpen = expanded.has(entry.week)
              return (
                <WeekRows
                  key={entry.week}
                  entry={entry}
                  isOpen={isOpen}
                  onToggle={() => toggle(entry.week)}
                  onEdit={onEdit}
                  readOnly={readOnly}
                />
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function WeekRows({
  entry,
  isOpen,
  onToggle,
  onEdit,
  readOnly,
}: {
  entry: KpiWeekEntry
  isOpen: boolean
  onToggle: () => void
  onEdit: Props['onEdit']
  readOnly?: boolean
}) {
  return (
    <>
      <tr className="border-b border-gray-50 transition-colors hover:bg-gray-50/40">
        <td className="whitespace-nowrap px-4 py-2.5">
          <button
            onClick={onToggle}
            className="flex items-center gap-1.5 font-semibold text-gray-900"
            aria-expanded={isOpen}
          >
            {isOpen ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
            S{entry.week}
            <span className="font-normal text-gray-400">· {MONTH_FULL_LABELS[entry.month - 1]}</span>
          </button>
        </td>
        <MetricCells metrics={entry.totals} />
        <td />
      </tr>

      {isOpen &&
        entry.users.map((user) => (
          <tr key={user.userName} className="border-b border-gray-50 bg-gray-50/30">
            <td className="py-2 pl-11 pr-4 text-gray-500">
              {user.userName}
              {user.userId == null && (
                <span className="ml-1.5 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                  archivé
                </span>
              )}
            </td>
            <MetricCells metrics={user.metrics} muted />
            <td className="px-2">
              {user.userId != null && !readOnly && (
                <button
                  onClick={() => onEdit(user.userId!, user.userName, entry.month, entry.week, user.metrics)}
                  className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                  title="Modifier cette semaine"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </td>
          </tr>
        ))}
    </>
  )
}

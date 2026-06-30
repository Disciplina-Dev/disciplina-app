import { useState } from 'react'
import { Pencil } from 'lucide-react'

import type { KpiMetrics, KpiUserSummary } from '@/api/kpi'
import { KPI_METRICS, MONTH_FULL_LABELS, emptyMetrics } from '../config'

interface Props {
  users: KpiUserSummary[]
  totals: KpiMetrics
  onEdit: (userId: number, userName: string, month: number, metrics: KpiMetrics) => void
}

/**
 * Tableau annuel façon Excel : une ligne par catégorie, une colonne par
 * commercial + Total. Le sélecteur de mois bascule entre les totaux annuels
 * et le détail d'un mois (éditable via le crayon de chaque colonne).
 */
export default function KpiTable({ users, totals, onEdit }: Props) {
  // 0 = année entière, 1-12 = mois
  const [month, setMonth] = useState(0)

  const metricsFor = (user: KpiUserSummary): KpiMetrics => {
    if (month === 0) return user.totals
    return user.months.find((m) => m.month === month)?.metrics ?? emptyMetrics()
  }

  const columns = users.map((user) => ({ user, metrics: metricsFor(user) }))
  const totalColumn =
    month === 0
      ? totals
      : columns.reduce((acc, { metrics }) => {
          for (const m of KPI_METRICS) acc[m.key] += metrics[m.key]
          return acc
        }, emptyMetrics())

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="rounded-lg border border-gray-100 bg-white px-3 py-1.5 text-[13px] font-semibold text-gray-900 outline-none transition-colors focus:border-blue"
        >
          <option value={0}>Année entière</option>
          {MONTH_FULL_LABELS.map((label, i) => (
            <option key={label} value={i + 1}>{label}</option>
          ))}
        </select>
        {month !== 0 && (
          <span className="text-[12px] text-gray-400">Crayon : modifier le mois pour un commercial</span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="px-4 py-3 text-left font-semibold text-gray-500">Catégorie</th>
              {columns.map(({ user, metrics }) => (
                <th key={user.userName} className="whitespace-nowrap px-3 py-3 text-right font-semibold text-gray-700">
                  <span className="inline-flex items-center gap-1.5">
                    {user.userName}
                    {user.userId == null && (
                      <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                        archivé
                      </span>
                    )}
                    {month !== 0 && user.userId != null && (
                      <button
                        onClick={() => onEdit(user.userId!, user.userName, month, metrics)}
                        className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                        title={`Modifier ${MONTH_FULL_LABELS[month - 1]} pour ${user.userName}`}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                </th>
              ))}
              <th className="whitespace-nowrap px-4 py-3 text-right font-semibold text-gray-500">Total</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-10 text-center text-gray-400">
                  Aucune donnée pour cette année. Importez un fichier Excel ou ajoutez une saisie manuelle.
                </td>
              </tr>
            )}

            {users.length > 0 &&
              KPI_METRICS.map((metric) => (
                <tr key={metric.key} className="border-b border-gray-50 transition-colors last:border-0 hover:bg-gray-50/40">
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <span className="inline-flex items-center gap-2 font-semibold text-gray-900">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: metric.color }} />
                      {metric.label}
                    </span>
                  </td>
                  {columns.map(({ user, metrics }) => (
                    <td
                      key={user.userName}
                      className={`whitespace-nowrap px-3 py-2.5 text-right tabular-nums ${
                        metrics[metric.key] === 0 ? 'text-gray-300' : 'text-gray-900'
                      }`}
                    >
                      {metrics[metric.key].toLocaleString('fr-FR')}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-bold tabular-nums text-gray-900">
                    {totalColumn[metric.key].toLocaleString('fr-FR')}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

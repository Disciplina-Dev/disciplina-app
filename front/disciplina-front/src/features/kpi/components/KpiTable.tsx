import { useState } from 'react'
import { IconEdit } from '@/components/ui/icons'

import type { KpiMetrics, KpiUserSummary } from '@/api/kpi'
import { KPI_METRICS, MONTH_FULL_LABELS, emptyMetrics } from '../config'

interface Props {
  users: KpiUserSummary[]
  totals: KpiMetrics
  onEdit: (userId: number, userName: string, month: number, metrics: KpiMetrics) => void
  /** true = données calculées (portefeuille) : pas d'édition. */
  readOnly?: boolean
}

/**
 * Tableau annuel façon Excel : une ligne par catégorie, une colonne par
 * commercial + Total. Le sélecteur de mois bascule entre les totaux annuels
 * et le détail d'un mois (éditable via le crayon de chaque colonne).
 */
export default function KpiTable({ users, totals, onEdit, readOnly = false }: Props) {
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
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--ds-border)] px-4 py-3">
        <select
          value={month}
          aria-label="Période affichée"
          onChange={(e) => setMonth(Number(e.target.value))}
          className="rounded-[var(--radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 py-1.5 text-[13px] font-semibold text-[var(--ds-text)] outline-none transition-colors focus:border-[var(--ds-accent)]"
        >
          <option value={0}>Année entière</option>
          {MONTH_FULL_LABELS.map((label, i) => (
            <option key={label} value={i + 1}>{label}</option>
          ))}
        </select>
        {month !== 0 && !readOnly && (
          <span className="text-[12px] text-[var(--ds-text-subtle)]">Crayon : modifier le mois pour un commercial</span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[var(--ds-border)] bg-[var(--ds-surface-sunken)]">
              <th scope="col" className="px-4 py-3 text-left font-semibold text-[var(--ds-text-subtle)]">Catégorie</th>
              {columns.map(({ user, metrics }) => (
                <th key={user.userName} scope="col" className="whitespace-nowrap px-3 py-3 text-right font-semibold text-[var(--ds-text-muted)]">
                  <span className="inline-flex items-center gap-1.5">
                    {user.userName}
                    {user.userId == null && (
                      <span className="rounded-full bg-[var(--ds-surface-sunken)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--ds-text-subtle)]">
                        archivé
                      </span>
                    )}
                    {month !== 0 && !readOnly && user.userId != null && (
                      <button
                        onClick={() => onEdit(user.userId!, user.userName, month, metrics)}
                        className="rounded-full p-1 text-[var(--ds-text-subtle)] transition-colors hover:bg-[var(--ds-surface-sunken)] hover:text-[var(--ds-text)]"
                        aria-label={`Modifier ${MONTH_FULL_LABELS[month - 1]} pour ${user.userName}`}
                        title={`Modifier ${MONTH_FULL_LABELS[month - 1]} pour ${user.userName}`}
                      >
                        <IconEdit className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                </th>
              ))}
              <th scope="col" className="whitespace-nowrap px-4 py-3 text-right font-semibold text-[var(--ds-text-subtle)]">Total</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-10 text-center text-[var(--ds-text-subtle)]">
                  Aucune donnée pour cette année. Importez un fichier Excel ou ajoutez une saisie manuelle.
                </td>
              </tr>
            )}

            {users.length > 0 &&
              KPI_METRICS.map((metric) => (
                <tr key={metric.key} className="border-b border-[var(--ds-border)] transition-colors last:border-0 hover:bg-[var(--ds-surface-sunken)]">
                  <th scope="row" className="whitespace-nowrap px-4 py-2.5 text-left">
                    <span className="inline-flex items-center gap-2 font-semibold text-[var(--ds-text)]">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: metric.color }} aria-hidden="true" />
                      {metric.label}
                    </span>
                  </th>
                  {columns.map(({ user, metrics }) => (
                    <td
                      key={user.userName}
                      className={`whitespace-nowrap px-3 py-2.5 text-right tabular-nums ${
                        metrics[metric.key] === 0 ? 'text-[var(--ds-text-subtle)]' : 'text-[var(--ds-text)]'
                      }`}
                    >
                      {metrics[metric.key].toLocaleString('fr-FR')}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-bold tabular-nums text-[var(--ds-text)]">
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

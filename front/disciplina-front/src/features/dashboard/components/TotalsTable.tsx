import { useMemo } from 'react'

import type { AppUser } from '@/store/authStore'
import { periodSeries, yearTotals, type PeriodMode, type PeriodStatusCount } from '../stats'

interface Props {
  byPeriod: PeriodStatusCount[]
  commercials: AppUser[]
  mode: PeriodMode
  year: number
}

/** Tableau des totaux par période (semaine/mois) et par commercial, avec colonne et ligne Total. */
export default function TotalsTable({ byPeriod, commercials, mode, year }: Props) {
  const rows = useMemo(
    () => periodSeries(byPeriod, mode, year, commercials),
    [byPeriod, mode, year, commercials],
  )
  const totals = useMemo(() => yearTotals(byPeriod, commercials), [byPeriod, commercials])
  const grandTotal = useMemo(() => Object.values(totals).reduce((a, b) => a + b, 0), [totals])

  // En vue semaine on masque les lignes vides pour garder le tableau lisible
  const visibleRows = mode === 'week'
    ? rows.filter((r) => commercials.some((c) => (r[c.name] as number) > 0))
    : rows

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]">
      <div className="max-h-[420px] overflow-y-auto">
        <table className="w-full text-left">
          <thead className="sticky top-0 z-10 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-gray-500">
                {mode === 'week' ? 'Semaine' : 'Mois'}
              </th>
              {commercials.map((c) => (
                <th key={c.id} className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-gray-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                    {c.name}
                  </span>
                </th>
              ))}
              <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wide text-gray-500">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={commercials.length + 2} className="px-4 py-8 text-center text-[13px] text-gray-400">
                  Aucune donnée pour cette année
                </td>
              </tr>
            ) : (
              visibleRows.map((r) => {
                const rowTotal = commercials.reduce((sum, c) => sum + (r[c.name] as number), 0)
                return (
                  <tr key={r.period} className="border-t border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 text-[13px] font-semibold text-gray-900">{r.label}</td>
                    {commercials.map((c) => (
                      <td key={c.id} className="px-4 py-2.5 text-[13px] text-gray-700">
                        {(r[c.name] as number) || <span className="text-gray-300">—</span>}
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-right text-[13px] font-bold text-gray-900">{rowTotal}</td>
                  </tr>
                )
              })
            )}
          </tbody>
          <tfoot className="sticky bottom-0 border-t border-gray-100 bg-gray-50">
            <tr>
              <td className="px-4 py-3 text-[13px] font-bold text-gray-900">Total {year}</td>
              {commercials.map((c) => (
                <td key={c.id} className="px-4 py-3 text-[13px] font-bold text-gray-900">
                  {totals[c.name] ?? 0}
                </td>
              ))}
              <td className="px-4 py-3 text-right text-[13px] font-bold text-blue">{grandTotal}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

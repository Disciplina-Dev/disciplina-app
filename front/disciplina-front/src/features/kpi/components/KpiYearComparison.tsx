import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

import type { KpiAnnualSummary } from '@/api/kpi'
import { MONTH_LABELS } from '../config'

interface Props {
  year: number
  current: KpiAnnualSummary
  previous: KpiAnnualSummary
}

/** Somme des « Oui » par mois (index 0 = janvier), toutes équipes confondues. */
function monthlyOui(summary: KpiAnnualSummary): number[] {
  const months = Array.from({ length: 12 }, () => 0)
  for (const user of summary.users) {
    for (const entry of user.months) {
      months[entry.month - 1] += entry.metrics.count_oui
    }
  }
  return months
}

/**
 * Comparatif « GLOBAL OUI » N-1 vs N, repris du tableau annexe de la feuille
 * « C.R Mois » : une ligne par année, une colonne par mois + total, avec
 * l'écart et l'évolution, et le diagramme en bâtons correspondant.
 */
export default function KpiYearComparison({ year, current, previous }: Props) {
  const { rows, chartData } = useMemo(() => {
    const prevMonths = monthlyOui(previous)
    const curMonths = monthlyOui(current)
    const prevTotal = prevMonths.reduce((a, b) => a + b, 0)
    const curTotal = curMonths.reduce((a, b) => a + b, 0)

    const rows = [
      { label: `Global Oui ${year - 1}`, values: prevMonths, total: prevTotal, kind: 'value' as const },
      { label: `Global Oui ${year}`, values: curMonths, total: curTotal, kind: 'value' as const },
      {
        label: 'Écart N-1',
        values: curMonths.map((v, i) => v - prevMonths[i]),
        total: curTotal - prevTotal,
        kind: 'delta' as const,
      },
      {
        label: 'Évolution % N-1',
        values: curMonths.map((v, i) => (prevMonths[i] > 0 ? ((v - prevMonths[i]) / prevMonths[i]) * 100 : null)),
        total: prevTotal > 0 ? ((curTotal - prevTotal) / prevTotal) * 100 : null,
        kind: 'percent' as const,
      },
    ]

    const chartData = MONTH_LABELS.map((label, i) => ({
      label,
      [String(year - 1)]: prevMonths[i],
      [String(year)]: curMonths[i],
    }))

    return { rows, chartData }
  }, [year, current, previous])

  return (
    <div className="space-y-4">
      {/* ─── Tableau comparatif ──────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="px-4 py-3 text-left font-semibold text-gray-500">Année</th>
                {MONTH_LABELS.map((m) => (
                  <th key={m} className="whitespace-nowrap px-3 py-3 text-right font-semibold uppercase text-gray-500">
                    {m}
                  </th>
                ))}
                <th className="whitespace-nowrap px-4 py-3 text-right font-semibold uppercase text-gray-500">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-gray-50 last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5 font-semibold text-gray-900">{row.label}</td>
                  {[...row.values, row.total].map((value, i) => (
                    <td
                      key={i}
                      className={`whitespace-nowrap px-3 py-2.5 text-right tabular-nums ${
                        i === row.values.length ? 'px-4 font-bold' : ''
                      } ${cellColor(row.kind, value)}`}
                    >
                      {formatCell(row.kind, value)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Diagramme en bâtons N-1 vs N ────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-gray-100)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'var(--color-gray-500)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--color-gray-100)' }}
                interval={0}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: 'var(--color-gray-500)' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: 'var(--color-gray-50)' }}
                contentStyle={{
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-gray-100)',
                  fontSize: 12,
                  fontFamily: 'var(--font-sans)',
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Bar dataKey={String(year - 1)} fill="var(--color-gray-300)" radius={[3, 3, 0, 0]} maxBarSize={18} />
              <Bar dataKey={String(year)} fill="var(--color-blue)" radius={[3, 3, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function formatCell(kind: 'value' | 'delta' | 'percent', value: number | null): string {
  if (value == null) return '—'
  if (kind === 'percent') return `${value > 0 ? '↑ +' : value < 0 ? '↓ ' : ''}${value.toFixed(0)} %`
  if (kind === 'delta') return value > 0 ? `+${value}` : String(value)
  return value.toLocaleString('fr-FR')
}

function cellColor(kind: 'value' | 'delta' | 'percent', value: number | null): string {
  if (kind === 'value' || value == null || value === 0) return value === 0 && kind !== 'value' ? 'text-gray-300' : 'text-gray-900'
  return value > 0 ? 'text-success' : 'text-danger'
}

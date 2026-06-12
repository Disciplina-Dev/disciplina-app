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

import type { KpiAnnualSummary, KpiMetricColumn, KpiMetrics, KpiWeeklyDetail } from '@/api/kpi'
import { KPI_STATUS_METRICS, MONTH_LABELS } from '../config'

export type ChartMode = 'commercial' | 'month' | 'week'

interface Props {
  summary: KpiAnnualSummary
  weekly: KpiWeeklyDetail | null
  mode: ChartMode
  /** Statuts cochés (cases au-dessus du diagramme). */
  visibleStatuses: KpiMetricColumn[]
}

/** Palette sobre (index.css) pour distinguer les commerciaux. */
const USER_COLORS = [
  'var(--color-blue)',
  'var(--color-pink)',
  'var(--color-purple)',
  'var(--color-success)',
  'var(--color-warning)',
  'var(--color-gray-700)',
  'var(--color-blue-dark)',
  'var(--color-pink-dark)',
  'var(--color-purple-dark)',
  'var(--color-gray-300)',
]

/**
 * Diagramme en bâtons façon Excel « Suivi commercial » — toujours une
 * comparaison entre commerciaux :
 * - « Par commercial » : totaux annuels, un groupe par commercial, une barre
 *   par statut coché ;
 * - « Par mois » / « Par semaine » : une barre par commercial sur chaque
 *   période, valeur = somme des statuts cochés.
 */
export default function KpiStatusChart({ summary, weekly, mode, visibleStatuses }: Props) {
  const statusMetrics = KPI_STATUS_METRICS.filter((m) => visibleStatuses.includes(m.key))
  const userNames = summary.users.map((u) => u.userName)

  const data = useMemo(() => {
    const checkedSum = (metrics: KpiMetrics): number =>
      visibleStatuses.reduce((acc, key) => acc + metrics[key], 0)

    if (mode === 'commercial') {
      const metrics = KPI_STATUS_METRICS.filter((m) => visibleStatuses.includes(m.key))
      return summary.users.map((user) => ({
        label: user.userName,
        ...Object.fromEntries(metrics.map((m) => [m.label, user.totals[m.key]])),
      }))
    }

    if (mode === 'week') {
      return (weekly?.weeks ?? []).map((entry) => ({
        label: `S${entry.week}`,
        ...Object.fromEntries(
          summary.users.map((user) => {
            const userWeek = entry.users.find((u) => u.userName === user.userName)
            return [user.userName, userWeek ? checkedSum(userWeek.metrics) : 0]
          }),
        ),
      }))
    }

    return Array.from({ length: 12 }, (_, i) => ({
      label: MONTH_LABELS[i],
      ...Object.fromEntries(
        summary.users.map((user) => {
          const month = user.months.find((m) => m.month === i + 1)
          return [user.userName, month ? checkedSum(month.metrics) : 0]
        }),
      ),
    }))
  }, [summary, weekly, mode, visibleStatuses])

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]">
      <div className="h-[360px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-gray-100)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--color-gray-500)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-gray-100)' }}
              interval={mode === 'week' ? 3 : 0}
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
            {mode === 'commercial'
              ? statusMetrics.map((metric) => (
                  <Bar
                    key={metric.key}
                    dataKey={metric.label}
                    fill={metric.color}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={24}
                  />
                ))
              : userNames.map((name, i) => (
                  <Bar
                    key={name}
                    dataKey={name}
                    fill={USER_COLORS[i % USER_COLORS.length]}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={mode === 'month' ? 16 : 6}
                  />
                ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

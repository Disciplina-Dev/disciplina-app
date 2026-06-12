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

import type { AppUser } from '@/store/authStore'
import { periodSeries, type PeriodMode, type PeriodStatusCount } from '../stats'

interface Props {
  byPeriod: PeriodStatusCount[]
  commercials: AppUser[]
  mode: PeriodMode
  year: number
}

/** Diagramme en bâtons comparant le total d'entreprises traitées par commercial, par semaine ou par mois. */
export default function PeriodBarChart({ byPeriod, commercials, mode, year }: Props) {
  const data = useMemo(
    () => periodSeries(byPeriod, mode, year, commercials),
    [byPeriod, mode, year, commercials],
  )

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]">
      <div className="h-[340px] w-full">
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
            {commercials.map((c) => (
              <Bar
                key={c.id}
                dataKey={c.name}
                fill={c.color ?? 'var(--color-gray-300)'}
                radius={[3, 3, 0, 0]}
                maxBarSize={mode === 'week' ? 8 : 28}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

import { useMemo } from 'react'

import { STATUS_VALUES } from '@/types/entreprise'
import { STATUS_COLORS, STATUS_BG, totalsByCommercial, type StatusCount } from '../stats'

interface Props {
  current: StatusCount[]
}

/** Une carte par commercial : total + ventilation par statut (snapshot actuel). */
export default function TeamStatusGrid({ current }: Props) {
  const rows = useMemo(() => totalsByCommercial(current), [current])

  if (rows.length === 0) return null

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((c) => (
        <div
          key={c.userID}
          className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-md"
        >
          <div className="mb-4 flex items-center gap-3">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full text-[14px] font-bold text-white"
              style={{ backgroundColor: c.color }}
            >
              {c.name.substring(0, 2).toUpperCase()}
            </span>
            <div>
              <span className="block text-[15px] font-bold leading-none text-gray-900">{c.name}</span>
              <span className="mt-1 block text-[12px] font-medium leading-none text-gray-400">
                {c.total} entreprise{c.total !== 1 ? 's' : ''} au total
              </span>
            </div>
            <span className="ml-auto text-[26px] font-bold text-gray-900">{c.total}</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {STATUS_VALUES.map((status) => (
              <div
                key={status}
                className="rounded-xl px-2 py-2 text-center"
                style={{ backgroundColor: STATUS_BG[status] }}
                title={status}
              >
                <span className="block truncate text-[10px] font-semibold" style={{ color: STATUS_COLORS[status] }}>
                  {status}
                </span>
                <span className="block text-[16px] font-bold" style={{ color: STATUS_COLORS[status] }}>
                  {c.byStatus[status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

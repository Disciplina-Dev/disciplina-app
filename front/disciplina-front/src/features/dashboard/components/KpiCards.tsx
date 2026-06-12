import { Building2, CheckCircle2, XCircle, Clock, BellRing, PhoneOff, Lock } from 'lucide-react'
import { useMemo } from 'react'

import { STATUS_VALUES, type EntrepriseStatus } from '@/types/entreprise'
import { STATUS_COLORS, STATUS_BG, totalsByStatus, type StatusCount } from '../stats'

const STATUS_ICONS: Record<EntrepriseStatus, React.ReactNode> = {
  'Oui': <CheckCircle2 className="h-5 w-5" />,
  'Non': <XCircle className="h-5 w-5" />,
  'À Réfléchir': <Clock className="h-5 w-5" />,
  'Relance': <BellRing className="h-5 w-5" />,
  'Réponds pas': <PhoneOff className="h-5 w-5" />,
  'Fermé': <Lock className="h-5 w-5" />,
}

interface Props {
  current: StatusCount[]
}

/** Cartes KPI : total entreprises + un compteur par statut (snapshot actuel). */
export default function KpiCards({ current }: Props) {
  const totals = useMemo(() => totalsByStatus(current), [current])

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue/10 text-blue">
          <Building2 className="h-5 w-5" />
        </div>
        <p className="text-[12px] font-medium text-gray-500">Total entreprises</p>
        <span className="text-[28px] font-bold leading-tight text-gray-900">{totals.total}</span>
      </div>

      {STATUS_VALUES.map((status) => (
        <div
          key={status}
          className="rounded-2xl border border-gray-100 p-4 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]"
          style={{ backgroundColor: STATUS_BG[status] }}
        >
          <div
            className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/70"
            style={{ color: STATUS_COLORS[status] }}
          >
            {STATUS_ICONS[status]}
          </div>
          <p className="text-[12px] font-medium" style={{ color: STATUS_COLORS[status] }}>
            {status}
          </p>
          <span className="text-[28px] font-bold leading-tight" style={{ color: STATUS_COLORS[status] }}>
            {totals[status]}
          </span>
        </div>
      ))}
    </div>
  )
}

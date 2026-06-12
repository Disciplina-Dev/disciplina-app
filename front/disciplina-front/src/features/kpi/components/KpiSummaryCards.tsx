import { Phone, ListFilter, MapPin, Building2 } from 'lucide-react'

import type { KpiMetrics } from '@/api/kpi'
import { KPI_STATUS_METRICS } from '../config'

interface Props {
  totals: KpiMetrics
}

const VOLUME_CARDS = [
  { key: 'total_appels', label: "Total d'appels", icon: <Phone className="h-5 w-5" /> },
  { key: 'total_trie', label: 'Total trié', icon: <ListFilter className="h-5 w-5" /> },
  { key: 'visites_terrain', label: 'Visites terrain', icon: <MapPin className="h-5 w-5" /> },
  { key: 'nbre_ent_ouvert', label: 'Ent. ouvertes', icon: <Building2 className="h-5 w-5" /> },
] as const

/** Cartes de synthèse annuelle : volumes globaux + un compteur par statut. */
export default function KpiSummaryCards({ totals }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {VOLUME_CARDS.map(({ key, label, icon }) => (
          <div
            key={key}
            className="rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue/10 text-blue">
              {icon}
            </div>
            <p className="text-[12px] font-medium text-gray-500">{label}</p>
            <span className="text-[28px] font-bold leading-tight text-gray-900">
              {totals[key].toLocaleString('fr-FR')}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {KPI_STATUS_METRICS.map((metric) => (
          <div
            key={metric.key}
            className="rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: metric.color }} />
              <p className="text-[12px] font-medium text-gray-500">{metric.label}</p>
            </div>
            <span className="text-[24px] font-bold leading-tight text-gray-900">
              {totals[metric.key].toLocaleString('fr-FR')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

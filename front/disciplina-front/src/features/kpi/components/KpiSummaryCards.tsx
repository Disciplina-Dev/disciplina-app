import { IconCompany, IconFilterList, IconMapPin, IconPhone } from '@/components/ui/icons'

import Card from '@/components/ui/Card'
import type { KpiMetrics } from '@/api/kpi'
import { KPI_STATUS_METRICS } from '../config'

interface Props {
  totals: KpiMetrics
}

const VOLUME_CARDS = [
  { key: 'total_appels', label: "Total d'appels", icon: <IconPhone className="h-5 w-5" /> },
  { key: 'total_trie', label: 'Total trié', icon: <IconFilterList className="h-5 w-5" /> },
  { key: 'visites_terrain', label: 'Visites terrain', icon: <IconMapPin className="h-5 w-5" /> },
  { key: 'nbre_ent_ouvert', label: 'Ent. ouvertes', icon: <IconCompany className="h-5 w-5" /> },
] as const

/** Cartes de synthèse annuelle : volumes globaux + un compteur par statut. */
export default function KpiSummaryCards({ totals }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {VOLUME_CARDS.map(({ key, label, icon }) => (
          <Card key={key} glass padding="sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--ds-accent-soft)] text-[var(--ds-accent)]">
              {icon}
            </div>
            <p className="text-[12px] font-medium text-[var(--ds-text-subtle)]">{label}</p>
            <span className="font-[family-name:var(--font-display)] text-[30px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--ds-text)]">
              {totals[key].toLocaleString('fr-FR')}
            </span>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {KPI_STATUS_METRICS.map((metric) => (
          <Card key={metric.key} glass padding="sm">
            <div className="mb-2 flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: metric.color }}
                aria-hidden="true"
              />
              <p className="text-[12px] font-medium text-[var(--ds-text-subtle)]">{metric.label}</p>
            </div>
            <span className="font-[family-name:var(--font-display)] text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--ds-text)]">
              {totals[metric.key].toLocaleString('fr-FR')}
            </span>
          </Card>
        ))}
      </div>
    </div>
  )
}

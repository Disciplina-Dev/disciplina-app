import { MapPin } from 'lucide-react'
import { useRegionStore } from '@/store/regionStore'

const REGION_STYLES = {
  reunion: { label: 'La Réunion', color: '#1130A7', background: 'var(--color-blue-light)' },
  annemasse: { label: 'Annemasse', color: '#60207E', background: 'var(--color-purple-light)' },
} as const

/**
 * Rappelle en permanence sur quelle région (base de données) la session travaille :
 * les deux tenants ont des écrans identiques, sans ce repère on ne sait pas
 * lequel on est en train de modifier.
 */
export default function RegionBadge({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const region = useRegionStore((state) => state.region)
  if (!region) return null

  const { label, color, background } = REGION_STYLES[region]
  // Sidebar sombre (espace entreprise) : les fonds clairs de la charte y seraient
  // illisibles, on garde le même gabarit avec un fond translucide.
  const style =
    tone === 'dark'
      ? { background: 'rgba(255,255,255,0.1)', color: '#FFFFFF' }
      : { background, color }

  return (
    <div
      className="mx-5 mb-3 flex items-center gap-2 rounded-[8px] px-2.5 py-1.5"
      style={{ background: style.background }}
      title={`Région active : ${label}`}
    >
      <MapPin size={14} style={{ color: style.color }} />
      <span className="text-[12px] font-bold tracking-tight" style={{ color: style.color }}>
        {label}
      </span>
    </div>
  )
}

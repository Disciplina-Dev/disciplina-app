export interface RelanceType {
  id: number
  label: string
  description: string
  /** Interval added to today when the type is picked */
  addDays?: number
  addMonths?: number
  badge: { bg: string; text: string }
}

export const RELANCE_TYPES: RelanceType[] = [
  {
    id: 1,
    label: 'Relance 2 semaines',
    description: "Pas encore eu d'appel avec un RH",
    addDays: 14,
    badge: { bg: 'bg-[var(--ds-danger-bg)]', text: 'text-[var(--ds-danger)]' },
  },
  {
    id: 2,
    label: 'Relance 3 mois',
    description: 'Entreprise OK avec son apprenti',
    addMonths: 3,
    badge: { bg: 'bg-[var(--ds-success-bg)]', text: 'text-[var(--ds-success)]' },
  },
  {
    id: 3,
    label: 'Relance 2 mois',
    description: 'Entreprise « Non »',
    addMonths: 2,
    badge: { bg: 'bg-orange-100', text: 'text-[var(--ds-warning)]' },
  },
  {
    id: 4,
    label: 'Relance 6 mois',
    description: 'Entreprise tranquille, pas en recherche immédiate',
    addMonths: 6,
    badge: { bg: 'bg-[var(--ds-accent-soft)]', text: 'text-[var(--ds-accent)]' },
  },
  {
    id: 5,
    label: 'Relance 1 an',
    description: 'Relance annuelle',
    addMonths: 12,
    badge: { bg: 'bg-[var(--ds-surface-sunken)]', text: 'text-[var(--ds-text-muted)]' },
  },
]

export function getRelanceType(id: number | null | undefined): RelanceType | undefined {
  return RELANCE_TYPES.find((t) => t.id === id)
}

/** Date de relance calculée depuis aujourd'hui pour un type donné (YYYY-MM-DD) */
export function computeRelanceDate(typeId: number): string {
  const t = getRelanceType(typeId)
  const d = new Date()
  if (t?.addDays) d.setDate(d.getDate() + t.addDays)
  if (t?.addMonths) d.setMonth(d.getMonth() + t.addMonths)
  return d.toISOString().slice(0, 10)
}

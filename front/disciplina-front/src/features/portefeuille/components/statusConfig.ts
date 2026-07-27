import type { EntrepriseStatus } from '@/types/entreprise'

interface StatusStyle {
  label: string
  dot: string
  text: string
  pill: string
  ring: string
}

export const STATUS_CONFIG: Record<EntrepriseStatus, StatusStyle> = {
  Oui: {
    label: 'Oui',
    dot: 'bg-success',
    text: 'text-success',
    pill: 'bg-success-bg text-success',
    ring: 'ring-success/20',
  },
  Non: {
    label: 'Non',
    dot: 'bg-danger',
    text: 'text-danger',
    pill: 'bg-danger-bg text-danger',
    ring: 'ring-danger/20',
  },
  'À Réfléchir': {
    label: 'À Réfléchir',
    dot: 'bg-warning',
    text: 'text-warning',
    pill: 'bg-warning-bg text-warning',
    ring: 'ring-warning/20',
  },
  Relance: {
    label: 'Relance',
    dot: 'bg-blue',
    text: 'text-blue',
    pill: 'bg-blue/10 text-blue',
    ring: 'ring-blue/20',
  },
  'Réponds pas': {
    label: 'Réponds pas',
    dot: 'bg-gray-400',
    text: 'text-gray-500',
    pill: 'bg-gray-100 text-gray-500',
    ring: 'ring-gray-300/30',
  },
  Fermé: {
    label: 'Fermé',
    dot: 'bg-gray-700',
    text: 'text-gray-700',
    pill: 'bg-gray-200 text-gray-700',
    ring: 'ring-gray-400/30',
  },
}

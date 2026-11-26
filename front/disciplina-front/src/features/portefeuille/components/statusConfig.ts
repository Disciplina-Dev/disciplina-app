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
    text: 'text-[var(--ds-success)]',
    pill: 'bg-[var(--ds-success-bg)] text-[var(--ds-success)]',
    ring: 'ring-success/20',
  },
  'Oui OF': {
    label: 'Oui OF',
    dot: 'bg-success',
    text: 'text-[var(--ds-success)]',
    pill: 'bg-[var(--ds-success-bg)] text-[var(--ds-success)]',
    ring: 'ring-success/20',
  },
  Non: {
    label: 'Non',
    dot: 'bg-danger',
    text: 'text-[var(--ds-danger)]',
    pill: 'bg-[var(--ds-danger-bg)] text-[var(--ds-danger)]',
    ring: 'ring-danger/20',
  },
  'À Réfléchir': {
    label: 'À Réfléchir',
    dot: 'bg-warning',
    text: 'text-[var(--ds-warning)]',
    pill: 'bg-[var(--ds-warning-bg)] text-[var(--ds-warning)]',
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
    dot: 'bg-[var(--ds-text-subtle)]',
    text: 'text-[var(--ds-text-subtle)]',
    pill: 'bg-[var(--ds-surface-sunken)] text-[var(--ds-text-subtle)]',
    ring: 'ring-[var(--ds-border-strong)]',
  },
  Fermé: {
    label: 'Fermé',
    dot: 'bg-[var(--ds-text-muted)]',
    text: 'text-[var(--ds-text-muted)]',
    pill: 'bg-[var(--ds-surface-sunken)] text-[var(--ds-text-muted)]',
    ring: 'ring-gray-400/30',
  },
}

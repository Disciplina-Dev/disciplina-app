import type { ReactNode } from 'react'

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'purple' | 'pink'

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-[var(--ds-surface-sunken)] text-[var(--ds-text-muted)] ring-[var(--ds-border)]',
  accent: 'bg-[var(--ds-accent-soft)] text-[var(--ds-accent)] ring-[var(--ds-accent)]/20',
  success: 'bg-[var(--ds-success-bg)] text-[var(--ds-success)] ring-[var(--ds-success)]/20',
  warning: 'bg-[var(--ds-warning-bg)] text-[var(--ds-warning)] ring-[var(--ds-warning)]/20',
  danger: 'bg-[var(--ds-danger-bg)] text-[var(--ds-danger)] ring-[var(--ds-danger)]/20',
  purple: 'bg-purple-light text-purple ring-purple/20',
  pink: 'bg-pink-light text-pink ring-pink/20',
}

type BadgeProps = {
  children: ReactNode
  tone?: BadgeTone
  icon?: ReactNode
  className?: string
}

/**
 * Pastille de statut. Le sens ne repose jamais sur la seule couleur : le
 * libellé porte l'information, la couleur ne fait que la renforcer.
 */
export default function Badge({ children, tone = 'neutral', icon, className = '' }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ring-1',
        'text-[11px] font-semibold uppercase tracking-wide',
        toneClasses[tone],
        className,
      ].join(' ')}
    >
      {icon}
      {children}
    </span>
  )
}

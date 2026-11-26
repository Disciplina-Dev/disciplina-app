import Tooltip from './Tooltip'
import type { BadgeTone } from './Badge'

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-[var(--ds-surface-sunken)] text-[var(--ds-text-muted)]',
  accent: 'bg-[var(--ds-accent-soft)] text-[var(--ds-accent)]',
  success: 'bg-[var(--ds-success-bg)] text-[var(--ds-success)]',
  warning: 'bg-[var(--ds-warning-bg)] text-[var(--ds-warning)]',
  danger: 'bg-[var(--ds-danger-bg)] text-[var(--ds-danger)]',
  purple: 'bg-purple-light text-purple',
  pink: 'bg-pink-light text-pink',
}

type TruncatedBadgeProps = {
  children: string
  tone?: BadgeTone
  /** Au-delà, le libellé est coupé et le texte complet passe en infobulle. */
  maxChars?: number
  className?: string
}

/**
 * Pastille dont le libellé tient sur une ligne.
 *
 * Certains libellés métier — un intitulé NAF, par exemple — sont des phrases
 * entières. Étalées telles quelles, elles font gonfler la carte et cassent
 * l'alignement de la grille. On les coupe donc, et le texte complet s'affiche
 * au survol comme au focus clavier.
 */
export default function TruncatedBadge({
  children,
  tone = 'accent',
  maxChars = 42,
  className = '',
}: TruncatedBadgeProps) {
  const label = children.trim()
  const isTruncated = label.length > maxChars

  const badge = (
    <span
      className={[
        'inline-block max-w-full truncate rounded-full px-2 py-0.5 align-middle',
        'text-[11px] font-medium',
        toneClasses[tone],
        className,
      ].join(' ')}
    >
      {isTruncated ? `${label.slice(0, maxChars).trimEnd()}…` : label}
    </span>
  )

  if (!isTruncated) return badge

  return (
    <Tooltip content={label} className="inline-flex max-w-full cursor-help rounded-full">
      {badge}
    </Tooltip>
  )
}

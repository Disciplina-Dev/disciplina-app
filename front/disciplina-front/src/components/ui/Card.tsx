import type { HTMLAttributes, ReactNode } from 'react'

type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** `raised` ajoute une ombre marquée, `flat` la supprime. */
  elevation?: 'flat' | 'default' | 'raised'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  /**
   * Surface en verre dépoli, posée sur le dégradé de fond. Réservée aux
   * cartes aérées : sur un contenu dense, le fond opaque reste plus lisible.
   */
  glass?: boolean
}

const elevationClasses = {
  flat: '',
  default: 'shadow-[var(--shadow-sm)]',
  raised: 'shadow-[var(--shadow-md)]',
} as const

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
} as const

export default function Card({
  elevation = 'default',
  padding = 'md',
  glass = false,
  className = '',
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={[
        'rounded-[var(--radius-lg)]',
        glass
          ? 'ds-glass'
          : `border border-[var(--ds-border)] bg-[var(--ds-surface)] ${elevationClasses[elevation]}`,
        paddingClasses[padding],
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </div>
  )
}

type CardHeaderProps = {
  title: ReactNode
  description?: ReactNode
  /** Actions alignées à droite du titre (boutons, menu, …). */
  actions?: ReactNode
  className?: string
}

export function CardHeader({ title, description, actions, className = '' }: CardHeaderProps) {
  return (
    <div className={`mb-4 flex items-start justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        <h3 className="truncate text-[15px] font-semibold text-[var(--ds-text)]">{title}</h3>
        {description && (
          <p className="mt-0.5 text-[13px] text-[var(--ds-text-subtle)]">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

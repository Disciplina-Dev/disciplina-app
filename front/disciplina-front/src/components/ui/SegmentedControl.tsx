import type { ReactNode } from 'react'
import { useSlidingIndicator } from '@/hooks/useSlidingIndicator'

export type SegmentedOption<T extends string | number> = {
  value: T
  label: ReactNode
  /** Désactive l'option sans la retirer, pour garder une largeur stable. */
  disabled?: boolean
}

type SegmentedControlProps<T extends string | number> = {
  options: ReadonlyArray<SegmentedOption<T>>
  value: T
  onChange: (value: T) => void
  /** Intitulé du groupe, annoncé aux lecteurs d'écran. */
  label: string
  /** Couleur du segment actif : noir, bleu ou violet de la charte. */
  tone?: 'solid' | 'accent' | 'purple'
  size?: 'sm' | 'md'
  className?: string
}

/** Couleur de la pilule glissante. */
const indicatorClasses = {
  solid: 'bg-[var(--ds-text)]',
  accent: 'bg-[var(--color-blue)]',
  purple: 'bg-[var(--color-purple)]',
} as const

/** Couleur du libellé actif, posé sur la pilule. */
const activeLabelClasses = {
  solid: 'text-[var(--ds-text-inverse)]',
  accent: 'text-white',
  purple: 'text-white',
} as const

const sizeClasses = {
  sm: 'px-3 py-1 text-[12px]',
  md: 'px-3.5 py-1.5 text-[13px]',
} as const

/**
 * Groupe de boutons exclusifs (source, période, mode d'affichage…).
 *
 * Implémenté avec `role="radiogroup"` plutôt qu'une liste de boutons : les
 * lecteurs d'écran annoncent alors « 2 sur 3 » et les flèches du clavier
 * naviguent entre les options, comme pour un choix unique natif.
 */
export default function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  label,
  tone = 'solid',
  size = 'md',
  className = '',
}: SegmentedControlProps<T>) {
  const { containerRef, registerItem, focusItem, indicator } = useSlidingIndicator(
    value,
    options.length,
  )

  const move = (direction: 1 | -1) => {
    const enabled = options.filter((o) => !o.disabled)
    const index = enabled.findIndex((o) => o.value === value)
    if (index === -1) return
    const next = enabled[(index + direction + enabled.length) % enabled.length]
    onChange(next.value)
    focusItem(next.value)
  }

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault()
          move(1)
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault()
          move(-1)
        }
      }}
      className={[
        'ds-glass relative inline-flex items-center gap-1 rounded-full p-1',
        className,
      ].join(' ')}
    >
      {/* Pilule glissante — décorative, l'état est porté par aria-checked. */}
      {indicator && (
        <span
          aria-hidden="true"
          className={[
            'pointer-events-none absolute top-1 bottom-1 left-0 rounded-full',
            'shadow-[var(--shadow-xs)]',
            'motion-safe:transition-[transform,width] motion-safe:duration-300',
            'motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]',
            indicatorClasses[tone],
          ].join(' ')}
          style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }}
        />
      )}
      {options.map((option) => {
        const isActive = option.value === value
        return (
          <button
            key={String(option.value)}
            ref={registerItem(option.value)}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={option.disabled}
            // Un seul segment reste tabulable : la flèche fait le reste.
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={[
              'relative z-10 rounded-full font-semibold transition-colors duration-200',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-accent)]',
              'disabled:cursor-not-allowed disabled:opacity-50',
              sizeClasses[size],
              isActive
                ? activeLabelClasses[tone]
                : 'text-[var(--ds-text-subtle)] hover:text-[var(--ds-text)]',
            ].join(' ')}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

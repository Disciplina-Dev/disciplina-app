import type { ReactNode } from 'react'
import { useSlidingIndicator } from '@/hooks/useSlidingIndicator'

export type ChipOption<T extends string | number> = {
  value: T
  label: ReactNode
}

type ChipGroupProps<T extends string | number> = {
  options: ReadonlyArray<ChipOption<T>>
  /** Valeurs actives. Vide = l'option « tout » est active. */
  selected: ReadonlyArray<T>
  onToggle: (value: T) => void
  /** Libellé de l'option qui réinitialise la sélection (« Tous »). */
  allLabel?: string
  onSelectAll?: () => void
  label: string
  tone?: 'solid' | 'accent' | 'purple'
  className?: string
}

const indicatorClasses = {
  solid: 'bg-[var(--ds-text)]',
  accent: 'bg-[var(--color-blue)]',
  purple: 'bg-[var(--color-purple)]',
} as const

const activeChipClasses = {
  solid: 'bg-[var(--ds-text)] text-[var(--ds-text-inverse)]',
  accent: 'bg-[var(--color-blue)] text-white',
  purple: 'bg-[var(--color-purple)] text-white',
} as const

const ALL = '__all__'

/**
 * Groupe de filtres à sélection multiple.
 *
 * Quand une seule option est active — le cas courant — une pilule glisse
 * jusqu'à elle, comme dans les barres d'onglets. Dès que plusieurs options
 * sont cochées, la pilule s'efface et chaque option porte son propre fond :
 * un indicateur unique ne saurait pas représenter deux positions à la fois.
 */
export default function ChipGroup<T extends string | number>({
  options,
  selected,
  onToggle,
  allLabel = 'Tous',
  onSelectAll,
  label,
  tone = 'accent',
  className = '',
}: ChipGroupProps<T>) {
  const isAll = selected.length === 0
  const singleValue: T | typeof ALL | null = isAll ? ALL : selected.length === 1 ? selected[0] : null

  const { containerRef, registerItem, indicator } = useSlidingIndicator<T | typeof ALL>(
    singleValue ?? ALL,
    options.length + 1,
  )
  const showIndicator = singleValue !== null && indicator !== null

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={label}
      className={`ds-glass relative inline-flex flex-wrap items-center gap-1 rounded-full p-1 ${className}`}
    >
      {showIndicator && (
        <span
          aria-hidden="true"
          className={[
            'pointer-events-none absolute top-1 bottom-1 left-0 rounded-full shadow-[var(--shadow-xs)]',
            'motion-safe:transition-[transform,width] motion-safe:duration-300',
            'motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]',
            indicatorClasses[tone],
          ].join(' ')}
          style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }}
        />
      )}

      {onSelectAll && (
        <button
          ref={registerItem(ALL)}
          type="button"
          aria-pressed={isAll}
          onClick={onSelectAll}
          className={[
            'relative z-10 rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-200',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-accent)]',
            isAll
              ? showIndicator
                ? 'text-white'
                : activeChipClasses[tone]
              : 'text-[var(--ds-text-subtle)] hover:text-[var(--ds-text)]',
          ].join(' ')}
        >
          {allLabel}
        </button>
      )}

      {options.map((option) => {
        const isActive = selected.includes(option.value)
        return (
          <button
            key={String(option.value)}
            ref={registerItem(option.value)}
            type="button"
            aria-pressed={isActive}
            onClick={() => onToggle(option.value)}
            className={[
              'relative z-10 rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-200',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-accent)]',
              isActive
                ? showIndicator
                  ? 'text-white'
                  : activeChipClasses[tone]
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

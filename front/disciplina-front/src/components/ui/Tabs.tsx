import type { ReactNode } from 'react'
import { useSlidingIndicator } from '@/hooks/useSlidingIndicator'

export type TabOption<T extends string | number> = {
  value: T
  label: ReactNode
  /** Compteur affiché à droite du libellé (nombre de résultats, par ex.). */
  count?: number
  disabled?: boolean
}

type TabsProps<T extends string | number> = {
  options: ReadonlyArray<TabOption<T>>
  value: T
  onChange: (value: T) => void
  /** Intitulé du groupe, annoncé aux lecteurs d'écran. */
  label: string
  /** `accent` = pilule bleu charte, `solid` = pilule noire. */
  tone?: 'solid' | 'accent' | 'purple'
  /** `full` étire les onglets sur toute la largeur, `auto` les ajuste au texte. */
  width?: 'full' | 'auto'
  className?: string
}

const toneClasses = {
  solid: 'bg-[var(--ds-text)]',
  accent: 'bg-[var(--color-blue)]',
  purple: 'bg-[var(--color-purple)]',
} as const

/**
 * Barre d'onglets à pilule glissante.
 *
 * La pilule active est un seul élément positionné en absolu : quand on change
 * d'onglet elle glisse jusqu'au nouveau, au lieu de disparaître d'un côté pour
 * réapparaître de l'autre. Sa position est mesurée sur le DOM réel, ce qui la
 * garde juste quelles que soient la longueur des libellés et la langue.
 *
 * Accessibilité : `role="tablist"` + flèches du clavier, et la pilule ne bouge
 * pas si le système demande de réduire les animations.
 */
export default function Tabs<T extends string | number>({
  options,
  value,
  onChange,
  label,
  tone = 'solid',
  width = 'full',
  className = '',
}: TabsProps<T>) {
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
      role="tablist"
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') {
          event.preventDefault()
          move(1)
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault()
          move(-1)
        }
      }}
      className={[
        'ds-glass relative flex items-center gap-1 rounded-full p-1.5',
        width === 'full' ? 'w-full' : 'inline-flex',
        className,
      ].join(' ')}
    >
      {/* Pilule glissante — purement décorative, l'état est porté par aria-selected. */}
      {indicator && (
        <span
          aria-hidden="true"
          className={[
            'pointer-events-none absolute top-1.5 bottom-1.5 rounded-full',
            'shadow-[var(--shadow-sm)]',
            'motion-safe:transition-[transform,width] motion-safe:duration-300',
            'motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]',
            toneClasses[tone],
          ].join(' ')}
          style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width, left: 0 }}
        />
      )}

      {options.map((option) => {
        const isActive = option.value === value
        return (
          <button
            key={String(option.value)}
            ref={registerItem(option.value)}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={option.disabled}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={[
              'relative z-10 rounded-full px-4 py-2 text-[14px] font-semibold',
              'transition-colors duration-200',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-accent)]',
              'disabled:cursor-not-allowed disabled:opacity-50',
              width === 'full' ? 'flex-1' : '',
              isActive
                ? 'text-white'
                : 'text-[var(--ds-text-subtle)] hover:text-[var(--ds-text)]',
            ].join(' ')}
          >
            {option.label}
            {option.count !== undefined && (
              <span className={isActive ? 'ml-1.5 opacity-80' : 'ml-1.5 opacity-70'}>
                {option.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

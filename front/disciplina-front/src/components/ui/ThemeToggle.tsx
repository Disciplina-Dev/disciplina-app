import { HalfMoon, SunLight } from 'iconoir-react'
import { useThemeStore } from '@/store/themeStore'

type ThemeToggleProps = {
  className?: string
}

/** Bascule clair ↔ sombre. Le thème choisi est conservé entre les sessions. */
export default function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const resolved = useThemeStore((s) => s.resolved)
  const toggle = useThemeStore((s) => s.toggle)
  const isDark = resolved === 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isDark}
      aria-label={isDark ? 'Activer le thème clair' : 'Activer le thème sombre'}
      title={isDark ? 'Thème clair' : 'Thème sombre'}
      className={[
        'inline-flex h-9 w-9 items-center justify-center rounded-full',
        'text-[var(--ds-text-muted)] transition-colors',
        'hover:bg-[var(--ds-surface-sunken)] hover:text-[var(--ds-text)]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-accent)]',
        className,
      ].join(' ')}
    >
      {isDark ? (
        <SunLight className="h-[18px] w-[18px]" aria-hidden="true" />
      ) : (
        <HalfMoon className="h-[18px] w-[18px]" aria-hidden="true" />
      )}
    </button>
  )
}

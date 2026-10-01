import { IconChevronLeft, IconChevronRight } from '@/components/ui/icons'
import { useSidebarStore } from '@/store/sidebarStore'
import { SidebarLabel } from './CollapsibleSidebar'

/**
 * Fige la barre latérale ouverte, ou la libère.
 *
 * Sans ce bouton, la navigation serait inaccessible sur écran tactile, où il
 * n'y a pas de survol.
 */
export default function SidebarPinButton() {
  const pinned = useSidebarStore((s) => s.pinned)
  const togglePinned = useSidebarStore((s) => s.togglePinned)
  const Icon = pinned ? IconChevronLeft : IconChevronRight

  return (
    <button
      type="button"
      onClick={togglePinned}
      aria-pressed={pinned}
      aria-label={pinned ? 'Replier la navigation' : 'Garder la navigation ouverte'}
      title={pinned ? 'Replier la navigation' : 'Garder la navigation ouverte'}
      className={[
        'flex w-full items-center gap-3 overflow-hidden rounded-full px-[14px] py-2 text-[12px] font-medium',
        'text-[var(--ds-text-subtle)] transition-colors',
        'hover:bg-[var(--ds-surface-sunken)] hover:text-[var(--ds-text)]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-accent)]',
      ].join(' ')}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        <Icon width={16} height={16} />
      </span>
      <SidebarLabel>{pinned ? 'Replier' : 'Garder ouvert'}</SidebarLabel>
    </button>
  )
}

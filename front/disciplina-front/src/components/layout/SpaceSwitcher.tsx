import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IconChevronDown,
  IconCompany,
  IconDashboard,
  IconTraining,
  IconUsers,
  IconSettings,
} from '@/components/ui/icons'
import { Permission, useCurrentUser, UserRole, type AppUser } from '@/store/authStore'
import { SidebarLabel } from './CollapsibleSidebar'

export type SpaceKey = 'commercial' | 'rh' | 'peda' | 'admin' | 'entreprise'

type Space = {
  key: SpaceKey
  label: string
  to: string
  icon: typeof IconDashboard
  /** Qui a le droit d'y entrer. Même règle que la navigation. */
  canAccess: (user: AppUser) => boolean
}

const isStaffAdmin = (user: AppUser) =>
  user.role === UserRole.AD || user.role === UserRole.GESTION

const isManager = (user: AppUser) =>
  user.permission === Permission.ADMIN || user.permission === Permission.RESPONSABLE

const SPACES: Space[] = [
  {
    key: 'commercial',
    label: 'Espace Commercial',
    to: '/commercial',
    icon: IconCompany,
    canAccess: (u) => u.role === UserRole.COMMERCIAL || isStaffAdmin(u) || isManager(u),
  },
  {
    key: 'rh',
    label: 'Espace RH',
    to: '/rh',
    icon: IconUsers,
    canAccess: (u) => u.role === UserRole.RH || isStaffAdmin(u) || isManager(u),
  },
  {
    key: 'peda',
    label: 'Espace Péda',
    to: '/peda',
    icon: IconTraining,
    canAccess: (u) => u.role === UserRole.PEDA || isStaffAdmin(u),
  },
  {
    key: 'admin',
    label: 'Administration',
    to: '/admin/utilisateurs',
    icon: IconSettings,
    canAccess: (u) => isStaffAdmin(u),
  },
  {
    key: 'entreprise',
    label: 'Espace Entreprise',
    to: '/entreprise',
    icon: IconCompany,
    canAccess: (u) => u.role === UserRole.ENTREPRISE,
  },
]

type SpaceSwitcherProps = {
  /** Espace actuellement ouvert. */
  current: SpaceKey
  /** Pictogramme affiché à gauche, y compris barre repliée. */
  mark: React.ReactNode
}

/**
 * Sélecteur d'espace, en tête de la barre latérale.
 *
 * La liste ne contient que les espaces auxquels l'utilisateur a droit : un
 * commercial sans accès Péda n'en voit pas l'existence. Quand il n'y a rien à
 * choisir, le nom s'affiche sans bouton — un menu à une seule entrée n'apporte
 * rien.
 */
export default function SpaceSwitcher({ current, mark }: SpaceSwitcherProps) {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const available = user ? SPACES.filter((s) => s.canAccess(user)) : []
  const currentSpace = SPACES.find((s) => s.key === current)

  // Fermeture au clic extérieur et à Échap : un menu ouvert ne doit jamais
  // rester coincé au-dessus du contenu.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const title = currentSpace?.label ?? 'Disciplina'

  if (available.length <= 1) {
    return (
      <div className="flex items-center gap-3 px-[18px] py-5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center">{mark}</span>
        <SidebarLabel className="font-[family-name:var(--font-display)] text-[15px] font-extrabold tracking-[-0.02em] text-[var(--ds-text)]">
          {title}
        </SidebarLabel>
      </div>
    )
  }

  return (
    <div ref={rootRef} className="relative px-3 py-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Espace courant : ${title}. Changer d'espace`}
        className={[
          'flex w-full items-center gap-3 overflow-hidden rounded-full px-2 py-2 text-left',
          'transition-colors hover:bg-[var(--ds-surface-sunken)]',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-accent)]',
          open ? 'bg-[var(--ds-surface-sunken)]' : '',
        ].join(' ')}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center">{mark}</span>
        <SidebarLabel className="flex-1 font-[family-name:var(--font-display)] text-[15px] font-extrabold tracking-[-0.02em] text-[var(--ds-text)]">
          {title}
        </SidebarLabel>
        <SidebarLabel>
          <IconChevronDown
            width={16}
            height={16}
            className={[
              'shrink-0 text-[var(--ds-text-subtle)]',
              'motion-safe:transition-transform motion-safe:duration-200',
              open ? 'rotate-180' : '',
            ].join(' ')}
          />
        </SidebarLabel>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Changer d'espace"
          className={[
            'ds-glass-strong absolute left-3 right-3 top-full z-50 mt-1 overflow-hidden rounded-[var(--radius-lg)] p-1.5',
            'motion-safe:animate-[ds-menu-in_160ms_ease-out]',
          ].join(' ')}
        >
          {available.map((space) => {
            const Icon = space.icon
            const isCurrent = space.key === current
            return (
              <button
                key={space.key}
                type="button"
                role="menuitem"
                aria-current={isCurrent ? 'true' : undefined}
                onClick={() => {
                  setOpen(false)
                  if (!isCurrent) navigate(space.to)
                }}
                className={[
                  'flex w-full items-center gap-2.5 rounded-full px-3 py-2 text-left text-[13px]',
                  'transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-accent)]',
                  isCurrent
                    ? 'bg-[var(--ds-accent)] font-semibold text-[var(--ds-text-inverse)]'
                    : 'font-medium text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-sunken)] hover:text-[var(--ds-text)]',
                ].join(' ')}
              >
                <Icon width={16} height={16} className="shrink-0" />
                <span className="truncate">{space.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

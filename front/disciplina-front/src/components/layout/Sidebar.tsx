import { NavLink } from 'react-router-dom'
import { IconCalendar, IconChart, IconCheckbox, IconDashboard, IconFile, IconGoal, IconHelp, IconLogout, IconRepeat, IconSettings } from '@/components/ui/icons'
import type { ReactNode } from 'react'
import Logo from '@/components/ui/Logo'

type NavItemConfig = {
  to: string
  icon: ReactNode
  label: string
}

const mainNav: NavItemConfig[] = [
  { to: '/dashboard', icon: <IconDashboard width={18} height={18} />, label: 'Tableau de bord' },
  { to: '/taches', icon: <IconCheckbox width={18} height={18} />, label: 'Tâches' },
  { to: '/habitudes', icon: <IconRepeat width={18} height={18} />, label: 'Habitudes' },
  { to: '/agenda', icon: <IconCalendar width={18} height={18} />, label: 'Agenda' },
  { to: '/objectifs', icon: <IconGoal width={18} height={18} />, label: 'Objectifs' },
  { to: '/notes', icon: <IconFile width={18} height={18} />, label: 'Notes' },
  { to: '/statistiques', icon: <IconChart width={18} height={18} />, label: 'Statistiques' },
]

const secondaryNav: NavItemConfig[] = [
  { to: '/parametres', icon: <IconSettings width={18} height={18} />, label: 'Paramètres' },
  { to: '/aide', icon: <IconHelp width={18} height={18} />, label: 'Aide' },
]

function NavItem({ to, icon, label }: NavItemConfig) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'flex items-center gap-3 rounded-[10px] py-2.5 px-3 text-sm transition-colors no-underline',
          isActive
            ? 'bg-blue-light text-blue font-medium'
            : 'text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-sunken)]',
        ].join(' ')
      }
    >
      {icon}
      {label}
    </NavLink>
  )
}

export default function Sidebar() {
  return (
    <aside className="ds-glass-flush flex h-screen w-64 flex-shrink-0 flex-col border-r border-[var(--ds-glass-border)]">
      {/* Logo */}
      <div className="p-6">
        <Logo className="h-8" />
      </div>

      {/* Main nav */}
      <nav className="mt-4 flex flex-col gap-1 px-3">
        {mainNav.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      {/* Separator */}
      <div className="mx-3 my-2 border-t border-[var(--ds-border)]" />

      {/* Secondary nav */}
      <nav className="flex flex-col gap-1 px-3">
        {secondaryNav.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      {/* Profile */}
      <div className="mt-auto p-3">
        <div className="flex items-center gap-3 rounded-[10px] px-2 py-2">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-light text-sm font-medium text-blue">
            LA
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--ds-text)]">Loic A.</p>
            <p className="truncate text-xs text-[var(--ds-text-subtle)]">loic@disciplina.fr</p>
          </div>
          <button
            type="button"
            aria-label="Se déconnecter"
            className="cursor-pointer text-[var(--ds-text-subtle)] transition-colors hover:text-[var(--ds-danger)]"
          >
            <IconLogout width={18} height={18} />
          </button>
        </div>
      </div>
    </aside>
  )
}

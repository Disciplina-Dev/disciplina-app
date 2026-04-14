import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  CheckSquare,
  Repeat2,
  CalendarDays,
  Target,
  FileText,
  BarChart2,
  Settings,
  HelpCircle,
  LogOut,
} from 'lucide-react'
import type { ReactNode } from 'react'

type NavItemConfig = {
  to: string
  icon: ReactNode
  label: string
}

const mainNav: NavItemConfig[] = [
  { to: '/dashboard', icon: <LayoutDashboard size={18} />, label: 'Tableau de bord' },
  { to: '/taches', icon: <CheckSquare size={18} />, label: 'Tâches' },
  { to: '/habitudes', icon: <Repeat2 size={18} />, label: 'Habitudes' },
  { to: '/agenda', icon: <CalendarDays size={18} />, label: 'Agenda' },
  { to: '/objectifs', icon: <Target size={18} />, label: 'Objectifs' },
  { to: '/notes', icon: <FileText size={18} />, label: 'Notes' },
  { to: '/statistiques', icon: <BarChart2 size={18} />, label: 'Statistiques' },
]

const secondaryNav: NavItemConfig[] = [
  { to: '/parametres', icon: <Settings size={18} />, label: 'Paramètres' },
  { to: '/aide', icon: <HelpCircle size={18} />, label: 'Aide' },
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
            : 'text-gray-700 hover:bg-gray-50',
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
    <aside className="flex h-screen w-64 flex-shrink-0 flex-col border-r border-gray-100 bg-white">
      {/* Logo */}
      <div className="p-6">
        <img src="/logo-disciplina.svg" alt="Disciplina" className="h-8" />
      </div>

      {/* Main nav */}
      <nav className="mt-4 flex flex-col gap-1 px-3">
        {mainNav.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      {/* Separator */}
      <div className="mx-3 my-2 border-t border-gray-100" />

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
            <p className="truncate text-sm font-medium text-gray-900">Loic A.</p>
            <p className="truncate text-xs text-gray-500">loic@disciplina.fr</p>
          </div>
          <button
            type="button"
            aria-label="Se déconnecter"
            className="cursor-pointer text-gray-300 transition-colors hover:text-danger"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  )
}

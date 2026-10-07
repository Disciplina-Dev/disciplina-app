import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { IconDashboard, IconLogout, IconMail, IconSettings, IconSpreadsheet, IconTraining, IconUnlink, IconUser, IconUsers } from '@/components/ui/icons'
import { useAuthStore, useCurrentUser } from '@/store/authStore'
import NotificationBell from '@/components/notifications/NotificationBell'
import RouteBreadcrumb from '@/components/ui/RouteBreadcrumb'
import ThemeToggle from '@/components/ui/ThemeToggle'
import CollapsibleSidebar, { SidebarLabel } from './CollapsibleSidebar'
import SpaceSwitcher from './SpaceSwitcher'
import SidebarPinButton from './SidebarPinButton'
import RegionBadge from './RegionBadge'
import GoogleReconnectBanner from '@/components/GoogleReconnectBanner'
import Logo from '@/components/ui/Logo'
import AppFooter from './AppFooter'

const ACCENT = '#0F766E'

function NavItem({ to, icon, label, end }: { to: string; icon: React.ReactNode; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          'group flex items-center gap-3 overflow-hidden rounded-full px-[14px] py-2.5 text-[14px] no-underline',
          'transition-colors duration-150',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-accent)]',
          isActive
            ? 'bg-[var(--ds-accent)] text-[var(--ds-text-inverse)] font-semibold shadow-[var(--shadow-xs)]'
            : 'text-[var(--ds-text-subtle)] font-medium hover:bg-[var(--ds-surface-sunken)] hover:text-[var(--ds-text)]',
        ].join(' ')
      }
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">{icon}</span>
      <SidebarLabel>{label}</SidebarLabel>
    </NavLink>
  )
}

export default function PedaLayout() {
  const currentUser = useCurrentUser()
  const logout = useAuthStore(s => s.logout)
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="relative flex h-screen overflow-hidden">
      <a href="#contenu-principal" className="ds-skip-link">
        Aller au contenu principal
      </a>

      <CollapsibleSidebar label="Navigation de l'espace pédagogique">
        <SpaceSwitcher current="peda" mark={<Logo variant="mark" className="h-8 w-8" />} />

        <RegionBadge />

        {/* Scrollable nav */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-2">
          <nav className="mt-2 flex flex-col gap-1 px-3">
            <NavItem to="/peda/dashboard" icon={<IconDashboard width={18} height={18} />} label="Tableau de bord" />
            <NavItem to="/peda" end icon={<IconSpreadsheet width={18} height={18} />} label="Suivi absences" />
            <NavItem to="/peda/alternants" icon={<IconUsers width={18} height={18} />} label="Alternants" />
            <NavItem to="/peda/sessions" icon={<IconTraining width={18} height={18} />} label="Sessions" />
            <NavItem to="/peda/ruptures" icon={<IconUnlink width={18} height={18} />} label="Ruptures" />
            <NavItem to="/peda/mail" icon={<IconMail width={18} height={18} />} label="Modèles mail" />
          </nav>

          {/* Le changement d'espace se fait par le sélecteur en tête de barre. */}
        </div>

        {/* Profile Footer */}
        <div className="shrink-0 border-t border-[var(--ds-border)] p-3 flex flex-col gap-3">
          <SidebarPinButton />

          <div className="flex items-center gap-3 rounded-[12px] p-2 hover:bg-[var(--ds-surface-sunken)] transition-colors">
            <div
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.2)]"
              style={{ backgroundColor: ACCENT }}
            >
              <IconUser width={18} height={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-[var(--ds-text)] leading-tight">{`${currentUser?.firstName ?? ''} ${currentUser?.lastName ?? ''}`.trim()}</p>
              <p className="truncate text-[11px] font-medium text-[var(--ds-text-subtle)] capitalize">
                {currentUser?.role === 'PEDA' ? 'Pédagogique' : currentUser?.role?.toLowerCase()}
              </p>
            </div>
            <div className="invisible flex items-center gap-0.5 opacity-0 transition-opacity duration-200 group-data-[open=true]/sidebar:visible group-data-[open=true]/sidebar:opacity-100">
              <button
                onClick={() => navigate('/peda/profil')}
                className="flex-shrink-0 p-1.5 text-[var(--ds-text-subtle)] hover:text-teal-700 hover:bg-teal-50 rounded-md transition-colors"
                title="Mon profil"
              >
                <IconSettings width={16} height={16} />
              </button>
              <button
                onClick={handleLogout}
                className="flex-shrink-0 p-1.5 text-[var(--ds-text-subtle)] hover:text-[var(--ds-danger)] hover:bg-[var(--ds-danger-bg)] rounded-md transition-colors"
                title="Se déconnecter"
              >
                <IconLogout width={16} height={16} />
              </button>
            </div>
          </div>
        </div>
      </CollapsibleSidebar>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="ds-glass-flush relative z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-[var(--ds-glass-border)] px-6">
          <RouteBreadcrumb accent={ACCENT} />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell accent={ACCENT} />
          </div>
        </header>
        <GoogleReconnectBanner />
        <main id="contenu-principal" tabIndex={-1} className="ds-scroll flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
        <AppFooter />
      </div>
    </div>
  )
}

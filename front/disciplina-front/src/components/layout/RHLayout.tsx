import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { IconBellActive, IconCalendar, IconDashboard, IconFolderSettings, IconLink, IconLogout, IconMail, IconMapPin, IconRepeat, IconSettings, IconTaskList, IconUser, IconUsers } from '@/components/ui/icons'
import { useAuthStore, useCurrentUser, Permission } from '@/store/authStore'
import NotificationBell from '@/components/notifications/NotificationBell'
import RouteBreadcrumb from '@/components/ui/RouteBreadcrumb'
import ThemeToggle from '@/components/ui/ThemeToggle'
import CollapsibleSidebar, { SidebarLabel, SidebarSectionTitle } from './CollapsibleSidebar'
import SpaceSwitcher from './SpaceSwitcher'
import SidebarPinButton from './SidebarPinButton'
import RegionBadge from './RegionBadge'
import GoogleReconnectBanner from '@/components/GoogleReconnectBanner'
import Logo from '@/components/ui/Logo'
import AppFooter from './AppFooter'

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

export default function RHLayout() {
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

      <CollapsibleSidebar label="Navigation de l'espace RH">
        <SpaceSwitcher current="rh" mark={<Logo variant="mark" className="h-8 w-8" />} />

        <RegionBadge />

        {/* Scrollable nav */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-2">
        {/* Main nav */}
        <nav className="mt-2 flex flex-col gap-1 px-3">
          <NavItem to="/rh" end icon={<IconDashboard width={18} height={18} />} label="Tableau de bord" />
          <NavItem to="/rh/candidats" icon={<IconUsers width={18} height={18} />} label="Candidats" />
          <NavItem to="/rh/matching" icon={<IconRepeat width={18} height={18} />} label="Matching" />
          <NavItem to="/rh/external-access" icon={<IconLink width={18} height={18} />} label="Accès externes" />
          <NavItem to="/rh/calendrier" icon={<IconCalendar width={18} height={18} />} label="Calendrier" />
          <NavItem to="/rh/relance" icon={<IconBellActive width={18} height={18} />} label="Relance" />
          <NavItem to="/rh/todos" icon={<IconTaskList width={18} height={18} />} label="Mes tâches" />
        </nav>

        {/* Configuration : "Modèles mail" pour tous les RH (modèles communs + signature
            personnelle) ; Drive et secteurs restent réservés Responsable/Admin. */}
        <SidebarSectionTitle>Configuration</SidebarSectionTitle>
        <nav className="flex flex-col gap-1 px-3">
          {(currentUser?.role === 'AD' || currentUser?.role === 'GESTION' || currentUser?.permission === Permission.RESPONSABLE || currentUser?.permission === Permission.ADMIN) && (
            <>
              <NavItem to="/rh/config-drive" icon={<IconFolderSettings width={18} height={18} />} label="Dossiers Drive" />
              <NavItem to="/rh/config-secteurs" icon={<IconMapPin width={18} height={18} />} label="Lieux par secteur" />
            </>
          )}
          <NavItem to="/rh/mail" icon={<IconMail width={18} height={18} />} label="Modèles mail" />
        </nav>

        {/* Le changement d'espace se fait par le sélecteur en tête de barre. */}
        </div>

        {/* Profile Footer */}
        <div className="shrink-0 border-t border-[var(--ds-border)] p-3 flex flex-col gap-3">
          <SidebarPinButton />

          <div className="flex items-center gap-3 rounded-[12px] p-2 hover:bg-[var(--ds-surface-sunken)] transition-colors">
            <div
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.2)]"
              style={{ backgroundColor: '#60207E' }}
            >
              <IconUser width={18} height={18} />
            </div>
            <SidebarLabel className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-[13px] font-bold text-[var(--ds-text)] leading-tight">{`${currentUser?.firstName ?? ''} ${currentUser?.lastName ?? ''}`.trim()}</p>
                {(currentUser?.permission === Permission.RESPONSABLE || currentUser?.permission === Permission.ADMIN) && (
                  <span className="shrink-0 rounded-full bg-blue-light px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue">Resp.</span>
                )}
              </div>
              <p className="truncate text-[11px] font-medium text-[var(--ds-text-subtle)] capitalize">{currentUser?.role?.toLowerCase()}</p>
            </SidebarLabel>
            <div className="invisible flex items-center gap-0.5 opacity-0 transition-opacity duration-200 group-data-[open=true]/sidebar:visible group-data-[open=true]/sidebar:opacity-100">
              <button
                onClick={() => navigate('/rh/profil')}
                className="flex-shrink-0 p-1.5 text-[var(--ds-text-subtle)] hover:text-purple hover:bg-purple-light rounded-md transition-colors"
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
          <RouteBreadcrumb accent="#60207E" />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell accent="#60207E" />
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

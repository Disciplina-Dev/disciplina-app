import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { IconArrowLeft, IconLogout, IconMapPin, IconUser, IconUserPlus, IconUsers } from '@/components/ui/icons'
import { useAuthStore, useCurrentUser } from '@/store/authStore'
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

function NavItem({
  to,
  icon,
  label,
  end,
}: {
  to: string
  icon: React.ReactNode
  label: string
  end?: boolean
}) {
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

export default function AdminLayout() {
  const currentUser = useCurrentUser()
  const logout = useAuthStore((s) => s.logout)
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

      <CollapsibleSidebar label="Navigation de l'administration">
        <SpaceSwitcher current="admin" mark={<Logo variant="mark" className="h-8 w-8" />} />

        <RegionBadge />

        {/* Scrollable nav */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-2">
        {/* Gestion des utilisateurs */}
        <SidebarSectionTitle>Gestion des utilisateurs</SidebarSectionTitle>
        <nav className="flex flex-col gap-1 px-3">
          <NavItem to="/admin/utilisateurs" end icon={<IconUsers width={18} height={18} />} label="Utilisateurs" />
          <NavItem
            to="/admin/utilisateurs/nouveau"
            icon={<IconUserPlus width={18} height={18} />}
            label="Créer un utilisateur"
          />
        </nav>

        {/* Configuration */}
        <SidebarSectionTitle>Configuration</SidebarSectionTitle>
        <nav className="flex flex-col gap-1 px-3">
          <NavItem to="/rh/config-secteurs" icon={<IconMapPin width={18} height={18} />} label="Secteurs" />
        </nav>

        {/* Le changement d'espace se fait par le sélecteur en tête de barre. */}
        </div>

        {/* Retour espaces */}
        <div className="shrink-0 border-t border-[var(--ds-border)] p-3 flex flex-col gap-3">
          <SidebarPinButton />
          <button
            onClick={() => navigate('/commercial')}
            className="flex items-center gap-3 overflow-hidden rounded-full px-[14px] py-2 text-[13px] font-medium text-[var(--ds-text-subtle)] transition-colors hover:bg-[var(--ds-surface-sunken)] hover:text-[var(--ds-text)]"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center">
              <IconArrowLeft width={16} height={16} />
            </span>
            <SidebarLabel>Retour à l'application</SidebarLabel>
          </button>

          <div className="h-px w-full bg-[var(--ds-surface-sunken)]" />
          <div className="flex items-center gap-3 rounded-[12px] p-2 hover:bg-[var(--ds-surface-sunken)] transition-colors">
            <div
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.2)]"
              style={{ backgroundColor: '#1130A7' }}
            >
              <IconUser width={18} height={18} />
            </div>
            <SidebarLabel className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-[var(--ds-text)] leading-tight">
                {`${currentUser?.firstName ?? ''} ${currentUser?.lastName ?? ''}`.trim()}
              </p>
              <p className="truncate text-[11px] font-medium text-[var(--ds-text-subtle)] capitalize">
                {currentUser?.role?.toLowerCase()}
              </p>
            </SidebarLabel>
            <button
              onClick={handleLogout}
              className="invisible flex-shrink-0 rounded-full p-1.5 text-[var(--ds-text-subtle)] opacity-0 transition-[opacity,color,background-color] duration-200 hover:bg-[var(--ds-danger-bg)] hover:text-[var(--ds-danger)] group-data-[open=true]/sidebar:visible group-data-[open=true]/sidebar:opacity-100"
              aria-label="Se déconnecter"
              title="Se déconnecter"
            >
              <IconLogout width={16} height={16} />
            </button>
          </div>
        </div>
      </CollapsibleSidebar>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="ds-glass-flush relative z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-[var(--ds-glass-border)] px-6">
          <RouteBreadcrumb accent="#1130A7" />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell accent="#1130A7" />
          </div>
        </header>
        <GoogleReconnectBanner />
        <main id="contenu-principal" tabIndex={-1} className="ds-scroll flex-1 overflow-y-auto overflow-x-hidden p-8">
          <Outlet />
        </main>
        <AppFooter />
      </div>
    </div>
  )
}

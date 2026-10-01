import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  IconBell,
  IconCheckCircle,
  IconClose,
  IconCompany,
  IconDashboard,
  IconFolderSettings,
  IconLogout,
  IconMail,
  IconSearch,
  IconSettings,
  IconShieldAlert,
  IconShieldOff,
  IconTaskList,
  IconUser,
} from '@/components/ui/icons'
import { useAuthStore, useCurrentUser, Permission } from '@/store/authStore'
import { useAbSignedNotification } from '@/hooks/useAbSignedNotification'
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

export default function CommercialLayout() {
  const currentUser = useCurrentUser()
  const logout = useAuthStore(s => s.logout)
  const navigate = useNavigate()
  const { notifications, dismiss } = useAbSignedNotification()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const isManager =
    currentUser?.role === 'AD' ||
    currentUser?.role === 'GESTION' ||
    currentUser?.permission === Permission.RESPONSABLE ||
    currentUser?.permission === Permission.ADMIN

  return (
    <div className="relative flex h-screen overflow-hidden">
      {/* Le premier arrêt de tabulation permet d'atteindre le contenu sans
          parcourir toute la navigation latérale. */}
      <a href="#contenu-principal" className="ds-skip-link">
        Aller au contenu principal
      </a>

      <CollapsibleSidebar label="Navigation de l'espace commercial">
        <SpaceSwitcher current="commercial" mark={<Logo variant="mark" className="h-8 w-8" />} />

        <RegionBadge />

        <div className="ds-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-2">
          <nav aria-label="Navigation principale" className="mt-2 flex flex-col gap-1 px-3">
            <NavItem to="/commercial" end icon={<IconDashboard width={18} height={18} />} label="Tableau de bord" />
            <NavItem to="/commercial/portefeuille" icon={<IconCompany width={18} height={18} />} label="Portefeuille" />
            <NavItem to="/commercial/liste-noire" icon={<IconShieldOff width={18} height={18} />} label="Liste noire" />
            <NavItem to="/commercial/sourcing" icon={<IconSearch width={18} height={18} />} label="Sourcing SIRET" />
            <NavItem to="/commercial/mail" icon={<IconMail width={18} height={18} />} label="Modèles mail" />
            <NavItem to="/commercial/relance" icon={<IconBell width={18} height={18} />} label="Relances" />
            <NavItem to="/commercial/todos" icon={<IconTaskList width={18} height={18} />} label="Mes tâches" />
          </nav>

          {isManager && (
            <>
              <SidebarSectionTitle>Administration</SidebarSectionTitle>
              <nav aria-label="Administration" className="flex flex-col gap-1 px-3">
                <NavItem to="/commercial/quarantaine" icon={<IconShieldAlert width={18} height={18} />} label="Quarantaine" />
                <NavItem to="/commercial/config-drive" icon={<IconFolderSettings width={18} height={18} />} label="Dossiers Drive" />
              </nav>
            </>
          )}
        </div>

        {/* Pied de colonne : compte et liens légaux */}
        <div className="shrink-0 border-t border-[var(--ds-border)] p-3 flex flex-col gap-3">
          <SidebarPinButton />


          <div className="flex items-center gap-3 overflow-hidden rounded-[var(--radius-md)] p-1 transition-colors hover:bg-[var(--ds-surface-sunken)]">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-blue)] text-[12px] font-bold text-white">
              <IconUser width={18} height={18} />
            </div>
            <SidebarLabel className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-[13px] font-bold leading-tight text-[var(--ds-text)]">
                  {`${currentUser?.firstName ?? ''} ${currentUser?.lastName ?? ''}`.trim()}
                </p>
                {(currentUser?.permission === Permission.RESPONSABLE || currentUser?.permission === Permission.ADMIN) && (
                  <span className="shrink-0 rounded-full bg-[var(--ds-accent-soft)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--ds-accent)]">
                    Resp.
                  </span>
                )}
              </div>
              <p className="truncate text-[11px] font-medium capitalize text-[var(--ds-text-subtle)]">
                {currentUser?.role?.toLowerCase()}
              </p>
            </SidebarLabel>
            <div className="invisible flex items-center gap-0.5 opacity-0 transition-opacity duration-200 group-data-[open=true]/sidebar:visible group-data-[open=true]/sidebar:opacity-100">
              <button
                onClick={() => navigate('/commercial/profil')}
                className="flex-shrink-0 rounded-full p-1.5 text-[var(--ds-text-subtle)] transition-colors hover:bg-[var(--ds-accent-soft)] hover:text-[var(--ds-accent)]"
                aria-label="Mon profil"
                title="Mon profil"
              >
                <IconSettings width={16} height={16} />
              </button>
              <button
                onClick={handleLogout}
                className="flex-shrink-0 rounded-full p-1.5 text-[var(--ds-text-subtle)] transition-colors hover:bg-[var(--ds-danger-bg)] hover:text-[var(--ds-danger)]"
                aria-label="Se déconnecter"
                title="Se déconnecter"
              >
                <IconLogout width={16} height={16} />
              </button>
            </div>
          </div>
        </div>
      </CollapsibleSidebar>

      {/* Zone de contenu */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="ds-glass-flush relative z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-[var(--ds-glass-border)] px-6">
          <RouteBreadcrumb accent="var(--ds-accent)" />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell accent="var(--ds-accent)" />
          </div>
        </header>
        <GoogleReconnectBanner />
        <main id="contenu-principal" tabIndex={-1} className="ds-scroll flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
        <AppFooter />
      </div>

      {/* Notifications « AB signée » — pile dédiée, distincte des toasts
          applicatifs car chaque entrée reste tant qu'elle n'est pas acquittée. */}
      {notifications.length > 0 && (
        <div aria-live="polite" className="fixed bottom-5 right-5 z-[150] flex flex-col gap-2">
          {notifications.map((n) => (
            <div
              key={n.abId}
              className="ds-glass-strong flex min-w-[280px] max-w-sm items-start gap-3 rounded-[var(--radius-lg)] px-4 py-3 ring-1 ring-[var(--ds-success)]/25"
            >
              <IconCheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--ds-success)]" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--ds-text)]">AB signée</p>
                <p className="mt-0.5 truncate text-xs text-[var(--ds-text-subtle)]">{n.jobTitle}</p>
              </div>
              <button
                onClick={() => dismiss(n.abId)}
                aria-label="Masquer cette notification"
                className="shrink-0 rounded-full p-1 text-[var(--ds-text-subtle)] transition-colors hover:bg-[var(--ds-surface-sunken)] hover:text-[var(--ds-text)]"
              >
                <IconClose width={16} height={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

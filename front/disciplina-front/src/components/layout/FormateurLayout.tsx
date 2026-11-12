import { Outlet, useNavigate } from 'react-router-dom'
import { IconLogout, IconUser } from '@/components/ui/icons'
import Logo from '@/components/ui/Logo'
import ThemeToggle from '@/components/ui/ThemeToggle'
import RouteBreadcrumb from '@/components/ui/RouteBreadcrumb'
import { useAuthStore, useCurrentUser } from '@/store/authStore'
import AppFooter from './AppFooter'

const ACCENT = '#B45309'

/**
 * Coquille de l'espace formateur.
 *
 * Volontairement plus légère que les espaces internes : pas de barre latérale,
 * pas de sélecteur d'espace, pas de cloche de notifications. Un intervenant
 * consulte son planning depuis un téléphone, il n'a qu'une section. La seule
 * navigation est l'en-tête, et la déconnexion reste toujours visible.
 */
export default function FormateurLayout() {
  const currentUser = useCurrentUser()
  const logout = useAuthStore((state) => state.logout)
  const navigate = useNavigate()

  const handleLogout = () => {
    void logout()
    navigate('/')
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <a href="#contenu-principal" className="ds-skip-link">
        Aller au contenu principal
      </a>

      <header className="ds-glass-flush relative z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-[var(--ds-glass-border)] px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Logo variant="mark" className="h-8 w-8" />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-extrabold tracking-[-0.02em] text-[var(--ds-text)]">
              Espace formateur
            </p>
            <div className="hidden sm:block">
              <RouteBreadcrumb accent={ACCENT} />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle />
          <span className="mx-1 hidden items-center gap-2 rounded-full bg-[var(--ds-surface-sunken)] px-3 py-1.5 text-[12px] font-semibold text-[var(--ds-text-muted)] sm:flex">
            <IconUser width={14} height={14} />
            {`${currentUser?.firstName ?? ''} ${currentUser?.lastName ?? ''}`.trim()}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            title="Se déconnecter"
            aria-label="Se déconnecter"
            className="rounded-md p-2 text-[var(--ds-text-subtle)] transition-colors hover:bg-[var(--ds-danger-bg)] hover:text-[var(--ds-danger)]"
          >
            <IconLogout width={18} height={18} />
          </button>
        </div>
      </header>

      <main id="contenu-principal" tabIndex={-1} className="ds-scroll flex-1 overflow-y-auto overflow-x-hidden">
        <Outlet />
      </main>
      <AppFooter />
    </div>
  )
}

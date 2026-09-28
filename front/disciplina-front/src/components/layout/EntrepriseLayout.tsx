import { Outlet } from 'react-router-dom'
import RouteBreadcrumb from '@/components/ui/RouteBreadcrumb'
import AppFooter from './AppFooter'
import RegionBadge from './RegionBadge'

export default function EntrepriseLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="ds-glass-flush flex w-64 flex-col border-r border-[var(--ds-glass-border)] p-4">
        <p>Entreprise</p>
        <div className="mt-3 -mx-4">
          <RegionBadge tone="dark" />
        </div>
      </aside>
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="ds-glass-flush relative z-30 flex h-16 shrink-0 items-center border-b border-[var(--ds-glass-border)] px-6">
          <RouteBreadcrumb accent="#1130A7" />
        </header>
        <main className="ds-scroll flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
        <AppFooter />
      </div>
    </div>
  )
}

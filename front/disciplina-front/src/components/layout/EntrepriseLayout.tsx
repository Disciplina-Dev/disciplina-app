import { Outlet } from 'react-router-dom'
import RouteBreadcrumb from '@/components/ui/RouteBreadcrumb'

export default function EntrepriseLayout() {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-64 bg-gray-900 text-white p-4">
        <p>Entreprise</p>
      </aside>
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center border-b border-gray-100 bg-white px-6">
          <RouteBreadcrumb accent="#1130A7" />
        </header>
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

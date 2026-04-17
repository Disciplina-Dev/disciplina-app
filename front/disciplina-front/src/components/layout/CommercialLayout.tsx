import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, Building2 } from 'lucide-react'
import { useCurrentUser } from '@/store/authStore'

function NavItem({ to, icon, label, end }: { to: string; icon: React.ReactNode; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          'flex items-center gap-3 rounded-[10px] py-2.5 px-3 text-[14px] transition-all duration-150 cursor-pointer no-underline',
          isActive
            ? 'bg-blue-light text-blue font-bold shadow-[0_1px_2px_rgba(17,48,167,0.05)]'
            : 'text-gray-500 font-medium hover:bg-gray-50 hover:text-gray-900',
        ].join(' ')
      }
    >
      {icon}
      {label}
    </NavLink>
  )
}

export default function CommercialLayout() {
  const currentUser = useCurrentUser()

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-background)]">
      <aside className="flex h-full w-64 flex-shrink-0 flex-col border-r border-gray-100 bg-white">
        {/* Module Header */}
        <div className="p-6 pb-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-blue mb-1">Disciplina</p>
          <p className="text-[18px] font-extrabold text-gray-900 tracking-tight">CRM Commercial</p>
        </div>

        {/* Main nav */}
        <nav className="mt-2 flex flex-col gap-1 px-3">
          <NavItem to="/commercial" end icon={<LayoutDashboard size={18} />} label="Dashboard" />
          <NavItem to="/commercial/portefeuille" icon={<Building2 size={18} />} label="Portefeuille" />
        </nav>

        {/* Profile Footer */}
        <div className="mt-auto p-4">
          <div className="flex items-center gap-3 rounded-[12px] p-2 hover:bg-gray-50 transition-colors">
            <div 
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.2)]" 
              style={{ backgroundColor: currentUser?.color || '#1130A7' }}
            >
              {currentUser?.initials || '..'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-gray-900 leading-tight">{currentUser?.name}</p>
              <p className="truncate text-[11px] font-medium text-gray-400 capitalize">{currentUser?.role}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  )
}

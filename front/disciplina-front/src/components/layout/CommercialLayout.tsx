import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Building2, FileText, Bell, LogOut } from 'lucide-react'

const NAV = [
  { to: '/commercial',                 label: 'Dashboard',           icon: LayoutDashboard, end: true },
  { to: '/commercial/portefeuille',    label: 'Portefeuille',        icon: Building2 },
  { to: '/commercial/analyses-besoin', label: 'Analyses de Besoin',  icon: FileText },
  { to: '/commercial/relances',        label: 'Relances',            icon: Bell },
]

export default function CommercialLayout() {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-black flex flex-col">
        {/* Brand */}
        <div className="px-5 pt-6 pb-5 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-blue rounded-md flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-black">D</span>
            </div>
            <div className="leading-none">
              <p className="text-white font-bold text-sm">Disciplina</p>
              <p className="text-gray-500 text-[10px] mt-0.5 uppercase tracking-widest">Commercial</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2.5 py-4 space-y-0.5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-blue text-white font-medium'
                    : 'text-gray-500 hover:text-white hover:bg-white/5 font-normal'
                }`
              }
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-white/5">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group">
            <div className="w-7 h-7 rounded-full bg-blue flex items-center justify-center text-white text-xs font-bold shrink-0">
              AM
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">Amanda M.</p>
              <p className="text-gray-500 text-[10px] truncate">Centre Nord</p>
            </div>
            <LogOut size={13} className="text-gray-600 group-hover:text-gray-400 shrink-0" />
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

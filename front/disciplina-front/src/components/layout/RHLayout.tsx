import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, Repeat2, LogOut, User, Briefcase, UserPlus, Mail, BellRing, CalendarDays, FolderCog } from 'lucide-react'
import { useAuthStore, useCurrentUser } from '@/store/authStore'
import { GoogleDriveConnect } from '@/components/GoogleDriveConnect'
import NotificationBell from '@/components/notifications/NotificationBell'

function NavItem({ to, icon, label, end }: { to: string; icon: React.ReactNode; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          'flex items-center gap-3 rounded-[10px] py-2.5 px-3 text-[14px] transition-all duration-150 cursor-pointer no-underline',
          isActive
            ? 'bg-purple-light text-purple font-bold shadow-[0_1px_2px_rgba(96,32,126,0.05)]'
            : 'text-gray-500 font-medium hover:bg-gray-50 hover:text-gray-900',
        ].join(' ')
      }
    >
      {icon}
      {label}
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
    <div className="flex h-screen overflow-hidden bg-[var(--color-background)]">
      <aside className="flex h-full w-64 flex-shrink-0 flex-col border-r border-gray-100 bg-white">
        {/* Module Header */}
        <div className="p-6 pb-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-purple mb-1">Disciplina</p>
          <p className="text-[18px] font-extrabold text-gray-900 tracking-tight">Espace RH</p>
        </div>

        {/* Main nav */}
        <nav className="mt-2 flex flex-col gap-1 px-3">
          <NavItem to="/rh" end icon={<LayoutDashboard size={18} />} label="Tableau de bord" />
          <NavItem to="/rh/candidats" icon={<Users size={18} />} label="Candidats" />
          <NavItem to="/rh/matching" icon={<Repeat2 size={18} />} label="Matching" />
          <NavItem to="/rh/calendrier" icon={<CalendarDays size={18} />} label="Calendrier" />
          <NavItem to="/rh/mail" icon={<Mail size={18} />} label="Modèles mail" />
          <NavItem to="/rh/relance" icon={<BellRing size={18} />} label="Relance" />
        <NavItem to="/rh/config-drive" icon={<FolderCog size={18} />} label="Dossiers Drive" />
        </nav>

        {/* Administration Nav */}
        {(currentUser?.role === 'ADMIN' || currentUser?.role === 'RESPONSABLE') && (
          <>
            <div className="mx-3 my-4 border-t border-gray-100" />
            <div className="px-5 mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Administration</div>
            <nav className="flex flex-col gap-1 px-3">
              <NavItem to="/commercial" icon={<Briefcase size={18} />} label="Espace Commercial" />
              {currentUser?.role === 'ADMIN' && (
                <NavItem to="/register" icon={<UserPlus size={18} />} label="Créer utilisateur" />
              )}
            </nav>
          </>
        )}

        {/* Profile Footer */}
        <div className="mt-auto p-4 flex flex-col gap-4">
          <GoogleDriveConnect theme="purple" />
          <div className="h-px w-full bg-gray-100" />
          <div className="flex items-center gap-3 rounded-[12px] p-2 hover:bg-gray-50 transition-colors">
            <div
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.2)]"
              style={{ backgroundColor: '#60207E' }}
            >
              <User size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-[13px] font-bold text-gray-900 leading-tight">{`${currentUser?.firstName ?? ''} ${currentUser?.lastName ?? ''}`.trim()}</p>
                {currentUser?.role === 'RESPONSABLE' && (
                  <span className="shrink-0 rounded-full bg-blue-light px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue">Resp.</span>
                )}
              </div>
              <p className="truncate text-[11px] font-medium text-gray-400 capitalize">{currentUser?.role?.toLowerCase()}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
              title="Se déconnecter"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-end border-b border-gray-100 bg-white px-6">
          <NotificationBell accent="#60207E" />
        </header>
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LogOut, User, Mail, Settings, FileSpreadsheet, Briefcase, Users, UserPlus } from 'lucide-react'
import { useAuthStore, useCurrentUser } from '@/store/authStore'
import { GoogleDriveConnect } from '@/components/GoogleDriveConnect'
import NotificationBell from '@/components/notifications/NotificationBell'
import RouteBreadcrumb from '@/components/ui/RouteBreadcrumb'

const ACCENT = '#0F766E'

function NavItem({ to, icon, label, end }: { to: string; icon: React.ReactNode; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          'flex items-center gap-3 rounded-[10px] py-2.5 px-3 text-[14px] transition-all duration-150 cursor-pointer no-underline',
          isActive
            ? 'bg-teal-50 text-teal-700 font-bold shadow-[0_1px_2px_rgba(15,118,110,0.05)]'
            : 'text-gray-500 font-medium hover:bg-gray-50 hover:text-gray-900',
        ].join(' ')
      }
    >
      {icon}
      {label}
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
    <div className="flex h-screen overflow-hidden bg-[var(--color-background)]">
      <aside className="flex h-full w-64 flex-shrink-0 flex-col border-r border-gray-100 bg-white">
        {/* Module Header */}
        <div className="shrink-0 flex items-center gap-3 p-6 pb-4">
          <span className="flex items-center gap-3 after:content-[''] after:h-6 after:w-px after:bg-gray-200">
            <img src="/icon-logo.png" alt="Disciplina" className="h-8 w-8" />
          </span>
          <p className="whitespace-nowrap text-[16px] font-extrabold text-gray-900 tracking-tight">Espace Péda</p>
        </div>

        {/* Scrollable nav */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-2">
          <nav className="mt-2 flex flex-col gap-1 px-3">
            <NavItem to="/peda" end icon={<FileSpreadsheet size={18} />} label="Suivi absences" />
            <NavItem to="/peda/mail" icon={<Mail size={18} />} label="Modèles mail" />
          </nav>

          {/* Navigation inter-espaces (Admin) */}
          {(currentUser?.role === 'AD' || currentUser?.role === 'GESTION') && (
            <>
              <div className="mx-3 my-4 border-t border-gray-100" />
              <div className="px-5 mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Administration</div>
              <nav className="flex flex-col gap-1 px-3">
                <NavItem to="/commercial" icon={<Briefcase size={18} />} label="Espace Commercial" />
                <NavItem to="/rh" icon={<Users size={18} />} label="Espace RH" />
                <NavItem to="/admin/utilisateurs" icon={<UserPlus size={18} />} label="Administration" />
              </nav>
            </>
          )}
        </div>

        {/* Profile Footer */}
        <div className="shrink-0 border-t border-gray-100 p-4 flex flex-col gap-4">
          <GoogleDriveConnect theme="purple" />
          <div className="h-px w-full bg-gray-100" />
          <div className="flex items-center gap-3 rounded-[12px] p-2 hover:bg-gray-50 transition-colors">
            <div
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.2)]"
              style={{ backgroundColor: ACCENT }}
            >
              <User size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-gray-900 leading-tight">{`${currentUser?.firstName ?? ''} ${currentUser?.lastName ?? ''}`.trim()}</p>
              <p className="truncate text-[11px] font-medium text-gray-400 capitalize">
                {currentUser?.role === 'PEDA' ? 'Pédagogique' : currentUser?.role?.toLowerCase()}
              </p>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => navigate('/peda/profil')}
                className="flex-shrink-0 p-1.5 text-gray-400 hover:text-teal-700 hover:bg-teal-50 rounded-md transition-colors"
                title="Mon profil"
              >
                <Settings size={16} />
              </button>
              <button
                onClick={handleLogout}
                className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                title="Se déconnecter"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-gray-100 bg-white px-6">
          <RouteBreadcrumb accent={ACCENT} />
          <NotificationBell accent={ACCENT} />
        </header>
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

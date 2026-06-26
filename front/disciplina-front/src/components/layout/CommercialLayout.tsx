import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Building2, LogOut, User, Users, UserPlus, Search, CheckCircle, X, Mail, Bell, ShieldOff } from 'lucide-react'
import { useAuthStore, useCurrentUser } from '@/store/authStore'
import { GoogleDriveConnect } from '@/components/GoogleDriveConnect'
import { useAbSignedNotification } from '@/hooks/useAbSignedNotification'
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
  const logout = useAuthStore(s => s.logout)
  const navigate = useNavigate()
  const { notifications, dismiss } = useAbSignedNotification(currentUser?.id)

  const handleLogout = () => {
    logout()
    navigate('/')
  }

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
          <NavItem to="/commercial/liste-noire" icon={<ShieldOff size={18} />} label="Liste noire" />
          <NavItem to="/commercial/sourcing" icon={<Search size={18} />} label="Sourcing SIRET" />
          <NavItem to="/commercial/mail" icon={<Mail size={18} />} label="Modèles mail" />
          <NavItem to="/commercial/relance" icon={<Bell size={18} />} label="Relances" />
        </nav>

        {/* Administration Nav */}
        {(currentUser?.role === 'ADMIN' || currentUser?.role === 'RESPONSABLE') && (
          <>
            <div className="mx-3 my-4 border-t border-gray-100" />
            <div className="px-5 mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Administration</div>
            <nav className="flex flex-col gap-1 px-3">
              <NavItem to="/rh" icon={<Users size={18} />} label="Espace RH" />
              {currentUser?.role === 'ADMIN' && (
                <NavItem to="/register" icon={<UserPlus size={18} />} label="Créer utilisateur" />
              )}
            </nav>
          </>
        )}

        {/* Profile Footer */}
        <div className="mt-auto p-4 flex flex-col gap-4">
          <GoogleDriveConnect theme="blue" />
          <div className="h-px w-full bg-gray-100" />
          <div className="flex items-center gap-3 rounded-[12px] p-2 hover:bg-gray-50 transition-colors">
            <div
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.2)]"
              style={{ backgroundColor: '#1130A7' }}
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
          <NotificationBell accent="#1130A7" />
        </header>
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>

      {/* AB signed toast notifications */}
      {notifications.length > 0 && (
        <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2">
          {notifications.map((n) => (
            <div
              key={n.abId}
              className="flex items-start gap-3 rounded-xl bg-white border border-green-200 shadow-lg px-4 py-3 min-w-[280px] max-w-sm"
            >
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">AB signée !</p>
                <p className="text-xs text-gray-500 truncate mt-0.5">{n.jobTitle}</p>
              </div>
              <button
                onClick={() => dismiss(n.abId)}
                className="text-gray-400 hover:text-gray-600 shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

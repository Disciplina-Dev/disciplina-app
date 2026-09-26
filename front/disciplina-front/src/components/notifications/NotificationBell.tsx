import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check, CheckCheck } from 'lucide-react'
import { useNotifications, type AppNotification, type NotificationLevel, type NotificationCategory } from '@/hooks/useNotifications'
import { useChangeLog } from '@/hooks/useChangeLog'
import { type ChangeLogRelease } from '@/lib/changelog'
import ChangeLogModal from '@/components/notifications/ChangeLogModal'

const LEVEL_DOT: Record<NotificationLevel, string> = {
  info: 'bg-blue-500',
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "À l'instant"
  if (m < 60) return `Il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `Il y a ${h} h`
  const d = Math.floor(h / 24)
  return `Il y a ${d} j`
}

const CATEGORIES: { key: NotificationCategory | null; label: string }[] = [
  { key: null, label: 'Toutes' },
  { key: 'candidate', label: 'Candidat' },
  { key: 'company', label: 'Entreprise' },
]

export default function NotificationBell({ accent = '#60207E' }: { accent?: string }) {
  const { filteredNotifications, unreadCount, unreadByCategory, selectedCategory, setSelectedCategory, markRead, markAllRead } = useNotifications()
  const changeLog = useChangeLog()
  const [open, setOpen] = useState(false)
  const [changeLogOpen, setChangeLogOpen] = useState(false)
  const [changeLogReleases, setChangeLogReleases] = useState<ChangeLogRelease[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const badgeCount = unreadCount + (changeLog.hasNew ? 1 : 0)

  const openChangeLog = () => {
    setChangeLogReleases(changeLog.newReleases)
    setChangeLogOpen(true)
  }

  const closeChangeLog = () => {
    setChangeLogOpen(false)
    changeLog.markSeen()
  }

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const handleClick = (n: AppNotification) => {
    if (!n.read) void markRead(n.id)
    if (n.link) {
      setOpen(false)
      navigate(n.link)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell size={19} />
        {badgeCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-100 bg-white shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-bold text-gray-900">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={() => void markAllRead()}
                className="flex items-center gap-1 text-[11px] font-semibold hover:underline"
                style={{ color: accent }}
              >
                <CheckCheck size={13} /> Tout marquer lu
              </button>
            )}
          </div>

          <div className="flex gap-1 px-3 py-2 border-b border-gray-100">
            {CATEGORIES.map(({ key, label }) => {
              const count = key ? unreadByCategory(key) : unreadCount
              const active = selectedCategory === key
              return (
                <button
                  key={label}
                  onClick={() => setSelectedCategory(key)}
                  className={[
                    'flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors',
                    active
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                  ].join(' ')}
                >
                  {label}
                  {count > 0 && (
                    <span className={[
                      'flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-1 text-[10px] font-bold',
                      active ? 'bg-white/25 text-white' : 'bg-red-500 text-white',
                    ].join(' ')}>
                      {count > 9 ? '9+' : count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {filteredNotifications.length === 0 && !changeLog.hasNew ? (
              <div className="px-4 py-10 text-center text-sm text-gray-400">Aucune notification</div>
            ) : (
              <>
                {changeLog.hasNew && (
                  <button
                    onClick={openChangeLog}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left border-b border-gray-50 transition-colors hover:bg-gray-50 bg-gray-50/60"
                  >
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: accent }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-gray-900">Nouveautés</p>
                      <p className="mt-0.5 line-clamp-2 text-[12px] text-gray-500">
                        Découvrez les changements depuis votre dernière visite
                      </p>
                    </div>
                  </button>
                )}
                {filteredNotifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={[
                      'flex w-full items-start gap-3 px-4 py-3 text-left border-b border-gray-50 transition-colors hover:bg-gray-50',
                      n.read ? 'bg-white' : 'bg-blue-50/60',
                    ].join(' ')}
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${LEVEL_DOT[n.level] ?? LEVEL_DOT.info}`} />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-[13px] ${n.read ? 'font-medium text-gray-700' : 'font-bold text-gray-900'}`}>
                        {n.title}
                      </p>
                      {n.message && <p className="mt-0.5 line-clamp-2 text-[12px] text-gray-500">{n.message}</p>}
                      <p className="mt-1 text-[11px] text-gray-400">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.read && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation()
                          void markRead(n.id)
                        }}
                        className="mt-0.5 shrink-0 rounded p-1 text-gray-300 hover:bg-gray-100 hover:text-gray-600"
                        title="Marquer comme lu"
                      >
                        <Check size={14} />
                      </span>
                    )}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {changeLogOpen && (
        <ChangeLogModal releases={changeLogReleases} accent={accent} onClose={closeChangeLog} />
      )}
    </div>
  )
}

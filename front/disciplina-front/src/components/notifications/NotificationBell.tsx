import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { IconBell, IconCheck, IconCheckDouble } from '@/components/ui/icons'
import { useNotifications, type AppNotification, type NotificationLevel, type NotificationCategory } from '@/hooks/useNotifications'
import { useChangeLog } from '@/hooks/useChangeLog'
import { type ChangeLogRelease } from '@/lib/changelog'
import ChangeLogModal from '@/components/notifications/ChangeLogModal'
import SegmentedControl from '@/components/ui/SegmentedControl'

const LEVEL_DOT: Record<NotificationLevel, string> = {
  info: 'bg-[var(--ds-accent)]',
  success: 'bg-[var(--ds-success)]',
  warning: 'bg-[var(--ds-warning)]',
  error: 'bg-[var(--ds-danger)]',
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

/** Valeur du segment « Toutes » : le filtre lui-même utilise `null`. */
const ALL_CATEGORIES = 'all'

const CATEGORIES: { key: NotificationCategory | null; label: string }[] = [
  { key: null, label: 'Toutes' },
  { key: 'candidate', label: 'Candidat' },
  { key: 'company', label: 'Entreprise' },
  { key: 'peda', label: 'Pédagogie' },
]

export default function NotificationBell({ accent = '#60207E' }: { accent?: string }) {
  const { filteredNotifications, unreadCount, unreadByCategory, selectedCategory, setSelectedCategory, markRead, markAllRead } = useNotifications()
  const changeLog = useChangeLog()
  const [open, setOpen] = useState(false)
  const [changeLogOpen, setChangeLogOpen] = useState(false)
  const [changeLogReleases, setChangeLogReleases] = useState<ChangeLogRelease[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  // Position du panneau, recalculée à l'ouverture et au redimensionnement.
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null)
  const navigate = useNavigate()

  const badgeCount = unreadCount + (changeLog.hasNew ? 1 : 0)

  /** Ancre le panneau sous la cloche, en coordonnées de fenêtre. */
  const place = () => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    setAnchor({ top: rect.bottom + 8, right: window.innerWidth - rect.right })
  }

  const togglePanel = () => {
    if (open) {
      setOpen(false)
      return
    }
    place()
    setOpen(true)
  }

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
      const target = e.target as Node
      // Le panneau vit dans un portail : il n'est plus un descendant du
      // conteneur, il faut donc le tester séparément.
      if (containerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    window.addEventListener('resize', place)
    return () => {
      document.removeEventListener('mousedown', onClick)
      window.removeEventListener('resize', place)
    }
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
        ref={buttonRef}
        onClick={togglePanel}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-[var(--ds-text-subtle)] hover:bg-[var(--ds-surface-sunken)] hover:text-[var(--ds-text)] transition-colors"
        title="Notifications"
        aria-label="Notifications"
      >
        <IconBell width={19} height={19} />
        {badgeCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--ds-danger)] px-1 text-[10px] font-bold text-white">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </button>

      {open && anchor && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: anchor.top, right: anchor.right }}
          className="ds-glass-strong z-[200] w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-[var(--radius-lg)] motion-safe:animate-[ds-menu-in_160ms_ease-out]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--ds-glass-border)]">
            <span className="text-sm font-bold text-[var(--ds-text)]">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={() => void markAllRead()}
                className="flex items-center gap-1 text-[11px] font-semibold hover:underline"
                style={{ color: accent }}
              >
                <IconCheckDouble width={13} height={13} /> Tout marquer lu
              </button>
            )}
          </div>

          <div className="border-b border-[var(--ds-glass-border)] px-3 py-2">
            <SegmentedControl
              label="Filtrer les notifications"
              size="sm"
              // `ALL_CATEGORIES` porte le cas « Toutes », que le filtre
              // représente par `null`.
              value={selectedCategory ?? ALL_CATEGORIES}
              onChange={(key) =>
                setSelectedCategory(key === ALL_CATEGORIES ? null : (key as NotificationCategory))
              }
              options={CATEGORIES.map(({ key, label }) => {
                const count = key ? unreadByCategory(key) : unreadCount
                const active = (selectedCategory ?? ALL_CATEGORIES) === (key ?? ALL_CATEGORIES)
                return {
                  value: key ?? ALL_CATEGORIES,
                  label: (
                    <span className="flex items-center gap-1">
                      {label}
                      {count > 0 && (
                        <span
                          className={[
                            'flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-1 text-[10px] font-bold',
                            active ? 'bg-[var(--ds-text-inverse)] text-[var(--ds-text)]' : 'bg-[var(--ds-danger)] text-white',
                          ].join(' ')}
                        >
                          {count > 9 ? '9+' : count}
                        </span>
                      )}
                    </span>
                  ),
                }
              })}
            />
          </div>

          <div className="max-h-96 overflow-y-auto">
            {filteredNotifications.length === 0 && !changeLog.hasNew ? (
              <div className="px-4 py-10 text-center text-sm text-[var(--ds-text-subtle)]">Aucune notification</div>
            ) : (
              <>
                {changeLog.hasNew && (
                  <button
                    onClick={openChangeLog}
                    className="flex w-full items-start gap-3 border-b border-[var(--ds-glass-border)] bg-[var(--ds-surface-sunken)] px-4 py-3 text-left transition-colors hover:bg-[var(--ds-surface-sunken)]"
                  >
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: accent }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-[var(--ds-text)]">Nouveautés</p>
                      <p className="mt-0.5 line-clamp-2 text-[12px] text-[var(--ds-text-subtle)]">
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
                      'flex w-full items-start gap-3 border-b border-[var(--ds-glass-border)] px-4 py-3 text-left',
                      'transition-colors hover:bg-[var(--ds-surface-sunken)]',
                      n.read ? '' : 'bg-[var(--ds-accent-soft)]',
                    ].join(' ')}
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${LEVEL_DOT[n.level] ?? LEVEL_DOT.info}`} />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-[13px] ${n.read ? 'font-medium text-[var(--ds-text-muted)]' : 'font-bold text-[var(--ds-text)]'}`}>
                        {n.title}
                      </p>
                      {n.message && <p className="mt-0.5 line-clamp-2 text-[12px] text-[var(--ds-text-subtle)]">{n.message}</p>}
                      <p className="mt-1 text-[11px] text-[var(--ds-text-subtle)]">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.read && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation()
                          void markRead(n.id)
                        }}
                        className="mt-0.5 shrink-0 rounded p-1 text-[var(--ds-text-subtle)] hover:bg-[var(--ds-surface-sunken)] hover:text-[var(--ds-text-muted)]"
                        title="Marquer comme lu"
                      >
                        <IconCheck width={14} height={14} />
                      </span>
                    )}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>,
        document.body,
      )}

      {changeLogOpen && (
        <ChangeLogModal releases={changeLogReleases} accent={accent} onClose={closeChangeLog} />
      )}
    </div>
  )
}

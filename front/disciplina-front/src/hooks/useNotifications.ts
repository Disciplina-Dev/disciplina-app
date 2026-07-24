import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { apiFetch } from '@/api/httpClient'

const API_BASE = import.meta.env.VITE_API_URL

export type NotificationLevel = 'info' | 'success' | 'warning' | 'error'

export interface AppNotification {
  id: string
  type: string
  level: NotificationLevel
  title: string
  message: string | null
  link: string | null
  read: boolean
  createdAt: string
}

interface ListResponse {
  notifications: AppNotification[]
  unreadCount: number
}

/**
 * Notifications de l'utilisateur courant : chargement initial via REST, mises à
 * jour temps réel via SSE, et actions lu / tout lu.
 */
export function useNotifications() {
  const user = useAuthStore((s) => s.user)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(false)
  const esRef = useRef<EventSource | null>(null)

  const unreadCount = notifications.filter((n) => !n.read).length

  const refresh = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const res = await apiFetch('/api/notifications')
      if (!res.ok) return
      const data = (await res.json()) as ListResponse
      setNotifications(data.notifications)
    } catch {
      /* réseau indisponible — on garde l'état courant */
    } finally {
      setLoading(false)
    }
  }, [user])

  // Chargement initial
  useEffect(() => {
    void refresh()
  }, [refresh])

  // Polling de secours : sur un backend serverless (Vercel), le SSE ne traverse
  // pas les instances. On rafraîchit périodiquement pour garantir l'arrivée des notifs.
  useEffect(() => {
    if (!user) return
    const interval = setInterval(() => { void refresh() }, 45000)
    return () => clearInterval(interval)
  }, [user, refresh])

  // Flux temps réel — le backend dérive l'identité depuis le cookie de session.
  useEffect(() => {
    if (!user) return
    const es = new EventSource(`${API_BASE}/api/notifications/stream`, { withCredentials: true })
    esRef.current = es
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as { event?: string; notification?: AppNotification }
        if (data.event === 'notification' && data.notification) {
          setNotifications((prev) =>
            prev.some((n) => n.id === data.notification!.id) ? prev : [data.notification!, ...prev],
          )
        }
      } catch {
        /* message malformé ignoré */
      }
    }
    es.onerror = () => {
      /* reconnexion automatique gérée par le navigateur */
    }
    return () => {
      es.close()
      esRef.current = null
    }
  }, [user])

  const markRead = useCallback(
    async (id: string) => {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
      if (!user) return
      try {
        await apiFetch(`/api/notifications/${id}/read`, { method: 'POST' })
      } catch {
        /* l'état optimiste sera resynchronisé au prochain refresh */
      }
    },
    [user],
  )

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    if (!user) return
    try {
      await apiFetch('/api/notifications/read-all', { method: 'POST' })
    } catch {
      /* idem */
    }
  }, [user])

  return { notifications, unreadCount, loading, refresh, markRead, markAllRead }
}

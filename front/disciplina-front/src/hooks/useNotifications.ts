import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/store/authStore'

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
  const token = useAuthStore((s) => s.token)
  const userId = useAuthStore((s) => s.user?.id)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(false)
  const esRef = useRef<EventSource | null>(null)

  const unreadCount = notifications.filter((n) => !n.read).length

  const authHeaders = useCallback(
    (): HeadersInit => ({ Authorization: `Bearer ${token}` }),
    [token],
  )

  const refresh = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/notifications`, { headers: authHeaders() })
      if (!res.ok) return
      const data = (await res.json()) as ListResponse
      setNotifications(data.notifications)
    } catch {
      /* réseau indisponible — on garde l'état courant */
    } finally {
      setLoading(false)
    }
  }, [token, authHeaders])

  // Chargement initial
  useEffect(() => {
    void refresh()
  }, [refresh])

  // Flux temps réel
  useEffect(() => {
    if (!userId) return
    const es = new EventSource(`${API_BASE}/api/notifications/stream?userID=${userId}`)
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
  }, [userId])

  const markRead = useCallback(
    async (id: string) => {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
      if (!token) return
      try {
        await fetch(`${API_BASE}/api/notifications/${id}/read`, { method: 'POST', headers: authHeaders() })
      } catch {
        /* l'état optimiste sera resynchronisé au prochain refresh */
      }
    },
    [token, authHeaders],
  )

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    if (!token) return
    try {
      await fetch(`${API_BASE}/api/notifications/read-all`, { method: 'POST', headers: authHeaders() })
    } catch {
      /* idem */
    }
  }, [token, authHeaders])

  return { notifications, unreadCount, loading, refresh, markRead, markAllRead }
}

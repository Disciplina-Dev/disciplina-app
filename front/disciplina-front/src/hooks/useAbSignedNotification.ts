import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'

const API_BASE = import.meta.env.VITE_API_URL

export interface AbSignedEvent {
  type: 'ab_signed'
  abId: number
  jobTitle: string
  companyId: number
}

export function useAbSignedNotification() {
  const token = useAuthStore((s) => s.token)
  const [notifications, setNotifications] = useState<AbSignedEvent[]>([])

  useEffect(() => {
    if (!token) return

    const url = `${API_BASE}/api/webhooks/yousign/stream?token=${encodeURIComponent(token)}`
    const es = new EventSource(url)

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as AbSignedEvent
        if (data.type === 'ab_signed') {
          setNotifications((prev) => [...prev, data])
        }
      } catch { /* skip malformed */ }
    }

    es.onerror = () => { /* auto-reconnect by browser */ }

    return () => { es.close() }
  }, [token])

  const dismiss = (abId: number) =>
    setNotifications((prev) => prev.filter((n) => n.abId !== abId))

  const dismissAll = () => setNotifications([])

  return { notifications, dismiss, dismissAll }
}

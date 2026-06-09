import { useEffect, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_URL

export interface AbSignedEvent {
  type: 'ab_signed'
  abId: number
  jobTitle: string
  companyId: number
}

export function useAbSignedNotification(userID: number | null | undefined) {
  const [notifications, setNotifications] = useState<AbSignedEvent[]>([])

  useEffect(() => {
    if (!userID) return

    const url = `${API_BASE}/api/webhooks/yousign/stream?userID=${userID}`
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
  }, [userID])

  const dismiss = (abId: number) =>
    setNotifications((prev) => prev.filter((n) => n.abId !== abId))

  const dismissAll = () => setNotifications([])

  return { notifications, dismiss, dismissAll }
}

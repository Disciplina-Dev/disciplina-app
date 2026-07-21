import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'

const API_BASE = import.meta.env.VITE_API_URL

// Intervalle de revalidation : le refresh_token peut être purgé côté back à tout
// moment (révocation Google détectée sur un appel réel), pas seulement au login.
const POLL_MS = 5 * 60 * 1000

/**
 * Synchronise `user.googleConnected` du store avec l'état réel côté serveur.
 * Au montage puis périodiquement, et au retour d'onglet.
 */
export function useGoogleConnectionStatus() {
  const connected = useAuthStore((s) => s.user?.googleConnected)

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      const token = useAuthStore.getState().token
      if (!token) return
      try {
        const res = await fetch(`${API_BASE}/api/auth/google/status`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        if (useAuthStore.getState().user?.googleConnected !== data.connected) {
          useAuthStore.getState().updateUser({ googleConnected: data.connected })
        }
      } catch {
        // Réseau indisponible : on garde l'état courant, pas d'alerte parasite.
      }
    }

    void check()
    const timer = window.setInterval(check, POLL_MS)
    const onFocus = () => void check()
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  return { connected: connected !== false }
}

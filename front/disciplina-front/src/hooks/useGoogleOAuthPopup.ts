import { useState, useCallback, useRef, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { apiFetch } from '@/api/httpClient'

export function useGoogleOAuthPopup() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const popupRef = useRef<Window | null>(null)
  const handlerRef = useRef<((e: MessageEvent) => void) | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (handlerRef.current) {
        window.removeEventListener('message', handlerRef.current)
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      popupRef.current?.close()
    }
  }, [])

  const connectGoogle = useCallback(async (userId?: number) => {
    setIsLoading(true)
    setError(null)

    try {
      const uriRes = await apiFetch('/api/auth/google/uri', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: userId ? JSON.stringify({ userId }) : undefined,
      })
      const uriData = await uriRes.json()
      if (!uriRes.ok) {
        throw new Error(uriData.error || 'Erreur lors de la génération de l\'URI')
      }

      const width = 500
      const height = 700
      const left = window.screenX + (window.innerWidth - width) / 2
      const top = window.screenY + (window.innerHeight - height) / 2
      const popup = window.open(
        uriData.url,
        'google-oauth',
        `width=${width},height=${height},left=${left},top=${top},popup=1`
      )
      if (!popup) {
        throw new Error('Le popup a été bloqué. Veuillez autoriser les popups.')
      }
      popupRef.current = popup

      const result = await new Promise<{ code: string; state: string }>((resolve, reject) => {
        const timer = window.setInterval(() => {
          try {
            if (popup.closed) {
              clearInterval(timer)
              if (handlerRef.current) {
                window.removeEventListener('message', handlerRef.current)
              }
              reject(new Error('Fenêtre fermée sans autorisation'))
            }
          } catch {
            // COOP policy blocks popup.closed access — ignore
          }
        }, 500)
        timerRef.current = timer

        const handler = (e: MessageEvent) => {
          if (e.origin !== window.location.origin) return
          if (!e.data?.code && !e.data?.error) return
          clearInterval(timer)
          window.removeEventListener('message', handler)
          if (e.data.error) {
            reject(new Error('Autorisation refusée'))
          } else {
            resolve(e.data)
          }
        }
        handlerRef.current = handler
        window.addEventListener('message', handler)
      })

      const tokenRes = await apiFetch('/api/auth/google/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: result.code, state: result.state }),
      })
      const tokenData = await tokenRes.json()
      if (!tokenRes.ok) {
        throw new Error(tokenData.error || 'Erreur lors de l\'échange du code')
      }

      if (!userId) {
        useAuthStore.getState().updateUser(tokenData)
      }

      return tokenData
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { connectGoogle, isLoading, error }
}

import { useEffect, type ReactNode } from 'react'
import { useAuthStore } from '@/store/authStore'
import { fetchMe } from '@/api/auth'

interface AuthBootstrapProps {
  children: ReactNode
}

// Le JWT vit dans un cookie httpOnly (non lisible en JS) : au montage de l'app,
// on interroge /api/auth/me pour savoir si une session valide existe. Les
// pages publiques ne sont pas bloquées ; seul ProtectedRoute attend authReady.
export function AuthBootstrap({ children }: AuthBootstrapProps) {
  const setAuthReady = useAuthStore((state) => state.setAuthReady)

  useEffect(() => {
    fetchMe()
      .then(setAuthReady)
      .catch(() => setAuthReady(null))
  }, [setAuthReady])

  return <>{children}</>
}

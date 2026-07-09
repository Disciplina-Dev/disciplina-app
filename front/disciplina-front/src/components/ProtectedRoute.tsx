import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore, UserRole } from '../store/authStore'

interface ProtectedRouteProps {
  children: ReactNode
  allowedRoles?: UserRole[]
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)

  if (!token || !user) {
    return <Navigate to="/" replace />
  }

  // ADMIN and RESPONSABLE bypass role checks on all routes except ADMIN-only
  if (user.role === 'ADMIN') {
    return <>{children}</>
  }

  // RESPONSABLE can access COMMERCIAL and RH routes (not ADMIN-only)
  const isAdminOnly = allowedRoles?.length === 1 && allowedRoles[0] === UserRole.ADMIN
  if (user.role === 'RESPONSABLE' && !isAdminOnly) {
    return <>{children}</>
  }

  if (allowedRoles && !allowedRoles.includes(user.role as UserRole)) {
    if (user.role === 'RESPONSABLE') {
      return <Navigate to="/commercial" replace />
    }
    if (user.role === 'RH') {
      return <Navigate to="/rh" replace />
    }
    if (user.role === 'COMMERCIAL') {
      return <Navigate to="/commercial" replace />
    }
    if (user.role === 'PEDA') {
      return <Navigate to="/peda" replace />
    }
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

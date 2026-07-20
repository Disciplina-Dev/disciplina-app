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

  // ADMIN permission bypasses role checks on all routes
  if (user.permission === 'ADMIN') {
    return <>{children}</>
  }

  // RESPONSABLE permission can access COMMERCIAL and RH routes (not admin-only)
  const isAdminOnly = allowedRoles?.length === 1 && (allowedRoles[0] === UserRole.AD || allowedRoles[0] === UserRole.GESTION)
  if (user.permission === 'RESPONSABLE' && !isAdminOnly) {
    return <>{children}</>
  }

  if (allowedRoles && !allowedRoles.includes(user.role as UserRole)) {
    if (user.permission === 'RESPONSABLE') {
      return <Navigate to="/commercial" replace />
    }
    if (user.role === 'COMMERCIAL') {
      return <Navigate to="/commercial" replace />
    }
    if (user.role === 'RH') {
      return <Navigate to="/rh" replace />
    }
    if (user.role === 'PEDA') {
      return <Navigate to="/peda" replace />
    }
    if (user.role === 'AD' || user.role === 'GESTION') {
      return <Navigate to="/admin" replace />
    }
    if (user.role === 'ENTREPRISE') {
      return <Navigate to="/entreprise" replace />
    }
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

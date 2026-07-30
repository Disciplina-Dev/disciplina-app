import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore, UserRole, Permission } from '../store/authStore'

interface ProtectedRouteProps {
  children: ReactNode
  allowedRoles?: UserRole[]
  minPermission?: Permission
}

const PERMISSION_LEVEL: Record<Permission, number> = {
  [Permission.EMPLOYEE]: 1,
  [Permission.RESPONSABLE]: 2,
  [Permission.ADMIN]: 3,
}

export function ProtectedRoute({ children, allowedRoles, minPermission }: ProtectedRouteProps) {
  const authReady = useAuthStore((state) => state.authReady)
  const user = useAuthStore((state) => state.user)

  // Le cookie httpOnly n'est plus lisible en JS : tant que le /api/auth/me
  // du montage n'a pas résolu, on ne sait pas encore si l'utilisateur est connecté.
  if (!authReady) {
    return null
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  // ADMIN permission bypasses role checks on all routes
  if (user.permission === 'ADMIN') {
    return <>{children}</>
  }

  if (minPermission && PERMISSION_LEVEL[user.permission] < PERMISSION_LEVEL[minPermission]) {
    return <Navigate to="/commercial/portefeuille" replace />
  }

  // RESPONSABLE permission can access COMMERCIAL and RH routes (not admin-only)
  const isAdminOnly = allowedRoles?.length === 1 && (allowedRoles[0] === UserRole.AD || allowedRoles[0] === UserRole.GESTION)
  if (user.permission === 'RESPONSABLE' && !isAdminOnly) {
    return <>{children}</>
  }

  if (allowedRoles && !allowedRoles.includes(user.role as UserRole)) {
    if (user.permission === 'RESPONSABLE') {
      return <Navigate to="/commercial/portefeuille" replace />
    }
    if (user.role === 'COMMERCIAL') {
      return <Navigate to="/commercial/portefeuille" replace />
    }
    if (user.role === 'RH') {
      return <Navigate to="/rh/candidats" replace />
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

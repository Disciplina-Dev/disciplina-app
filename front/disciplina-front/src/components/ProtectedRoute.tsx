import { ReactNode } from 'react'
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
    return <Navigate to="/login" replace />
  }

  // Admin access all paths conditionally
  if (user.role === 'ADMIN') {
    return <>{children}</>
  }

  if (allowedRoles && !allowedRoles.includes(user.role as UserRole)) {
    // Redirection logic
    if (user.role === 'RH') {
      return <Navigate to="/rh" replace />
    }
    if (user.role === 'COMMERCIAL') {
      return <Navigate to="/commercial" replace />
    }
    
    // Fallback if neither
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

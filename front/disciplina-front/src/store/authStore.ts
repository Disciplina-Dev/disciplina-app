import { create } from 'zustand'
import { logout as logoutRequest } from '@/api/auth'

export enum UserRole {
  COMMERCIAL = 'COMMERCIAL',
  RH = 'RH',
  PEDA = 'PEDA',
  AD = 'AD',
  GESTION = 'GESTION',
  ENTREPRISE = 'ENTREPRISE',
}

export enum Permission {
  EMPLOYEE = 'EMPLOYEE',
  RESPONSABLE = 'RESPONSABLE',
  ADMIN = 'ADMIN',
}

export interface AppUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
  permission: Permission
  sectors?: string[]
  oauthToken?: string
  googleConnected?: boolean
  color?: string
  initials?: string
}

interface AuthStore {
  user: AppUser | null
  // false tant que le premier appel /api/auth/me (au montage de l'app) n'a pas résolu.
  authReady: boolean
  setUser: (user: AppUser) => void
  updateUser: (user: Partial<AppUser>) => void
  setAuthReady: (user: AppUser | null) => void
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthStore>()((set) => ({
  user: null,
  authReady: false,
  setUser: (user) => set({ user }),
  updateUser: (updates) => set((state) => ({
    user: state.user ? { ...state.user, ...updates } : null
  })),
  setAuthReady: (user) => set({ user, authReady: true }),
  logout: async () => {
    await logoutRequest().catch(() => {})
    set({ user: null, authReady: true })
  },
}))

/**
 * Fin de session (JWT expiré/invalide, refresh silencieux échoué) : purge
 * l'état client et laisse ProtectedRoute rediriger vers la page de login.
 */
export function handleSessionExpired(): void {
  const { user, logout } = useAuthStore.getState()
  if (!user) return // déjà déconnecté — évite les boucles
  void logout()
}

export const useCurrentUser = (): AppUser | null => {
  return useAuthStore((s) => s.user)
}

export const fullName = (user: { firstName: string; lastName: string }): string =>
  `${user.firstName} ${user.lastName}`

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
  token: string | null
  user: AppUser | null
  setAuth: (token: string, user: AppUser) => void
  updateUser: (user: Partial<AppUser>) => void
  setUser: (user: AppUser) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      updateUser: (updates) => set((state) => ({
        user: state.user ? { ...state.user, ...updates } : null
      })),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'disciplina-auth' }
  )
)

/**
 * Fin de session (JWT expiré/invalide) : purge l'état client et laisse
 * ProtectedRoute rediriger vers la page de login. Ne touche PAS au refresh
 * token Google stocké en base — la déconnexion appli ne révoque pas Google.
 */
export function handleSessionExpired(): void {
  const { token, logout } = useAuthStore.getState()
  if (!token) return // déjà déconnecté — évite les boucles
  logout()
}

export const useCurrentUser = (): AppUser | null => {
  return useAuthStore((s) => s.user)
}

export const fullName = (user: { firstName: string; lastName: string }): string =>
  `${user.firstName} ${user.lastName}`

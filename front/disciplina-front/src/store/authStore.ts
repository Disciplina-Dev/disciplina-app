import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export enum UserRole {
  ADMIN = 'ADMIN',
  RESPONSABLE = 'RESPONSABLE',
  COMMERCIAL = 'COMMERCIAL',
  RH = 'RH',
  ENTREPRISE = 'ENTREPRISE',
}

export interface AppUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
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

export const useCurrentUser = (): AppUser | null => {
  return useAuthStore((s) => s.user)
}

export const fullName = (user: { firstName: string; lastName: string }): string =>
  `${user.firstName} ${user.lastName}`

export const USERS: Record<string, AppUser> = {
  4: {
    id: '4',
    firstName: 'Brandon',
    lastName: 'Galmar',
    role: UserRole.COMMERCIAL,
    email: 'galmar.commercial@disciplina.re',
    color: '#3B82F6',
    initials: 'B',
  },
  5: {
    id: '5',
    firstName: 'Emile',
    lastName: 'Lebon',
    role: UserRole.COMMERCIAL,
    email: 'lebon.commercial@disciplina.re',
    color: '#8B5CF6',
    initials: 'E',
  },
  3: {
    id: '3',
    firstName: 'Amanda',
    lastName: 'Sinaman',
    role: UserRole.RESPONSABLE,
    email: 'sinaman.commercial@disciplina.re',
    color: '#EC4899',
    initials: 'A',
  },
  2: {
    id: '2',
    firstName: 'Pas de',
    lastName: 'commerciaux',
    role: UserRole.COMMERCIAL,
    email: '',
    color: '#9CA3AF',
    initials: '-',
  },
  6: {
    id: '6',
    firstName: 'Lorenzo',
    lastName: '',
    role: UserRole.ADMIN,
    email: 'lorenzo@disciplina.re',
    color: '#10B981',
    initials: 'L',
  },
  1: {
    id: '1',
    firstName: 'root',
    lastName: '',
    role: UserRole.ADMIN,
    email: 'root@example.com',
    color: '#6366F1',
    initials: 'R',
  }
}

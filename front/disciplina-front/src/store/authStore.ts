import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export enum UserRole {
  COMMERCIAL = 'COMMERCIAL',
  RH = 'RH',
  ADMIN = 'ADMIN',
  ENTREPRISE = 'ENTREPRISE'
}

export interface AppUser {
  id: string
  email: string
  name: string
  role: UserRole
  sectors?: string[]
  oauthToken?: string
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

export const USERS: Record<string, AppUser> = {
  4: {
    id: '4',
    name: 'Brandon',
    role: UserRole.COMMERCIAL,
    email: 'galmar.commercial@disciplina.re',
    color: '#3B82F6',
    initials: 'B',
  },
  5: {
    id: '5',
    name: 'Emile',
    role: UserRole.COMMERCIAL,
    email: 'lebon.commercial@disciplina.re',
    color: '#8B5CF6',
    initials: 'E',
  },
  3: {
    id: '3',
    name: 'Amanda',
    role: UserRole.RH,
    email: 'sinaman.commercial@disciplina.re',
    color: '#EC4899',
    initials: 'A',
  },
  2: {
    id: '2',
    name: 'Pas de commerciaux',
    role: UserRole.COMMERCIAL,
    email: '',
    color: '#9CA3AF',
    initials: '-',
  },
  6: {
    id: '6',
    name: 'Lorenzo',
    role: UserRole.ADMIN,
    email: 'lorenzo@disciplina.re',
    color: '#10B981',
    initials: 'L',
  },
  1: {
    id: '1',
    name: 'root',
    role: UserRole.ADMIN,
    email: 'root@example.com',
    color: '#6366F1',
    initials: 'R',
  }
}

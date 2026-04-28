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
}

interface AuthStore {
  token: string | null
  user: AppUser | null
  setAuth: (token: string, user: AppUser) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'disciplina-auth' }
  )
)

export const useCurrentUser = (): AppUser | null => {
  return useAuthStore((s) => s.user)
}

export const USERS: Record<string, AppUser> = {
  3: {
    id: '3',
    name: 'Brandon',
    role: 'COMMERCIAL',
    email: 'galmar.commercial@disciplina.re',
  },
  4: {
    id: '4',
    name: 'Emile',
    role: 'COMMERCIAL',
    email: 'lebon.commercial@disciplina.re',
  },
  2: {
    id: '2',
    name: 'Amanda',
    role: 'RH',
    email: 'sinaman.commercial@disciplina.re',
  },
  1: {
    id: '1',
    name: 'Pas de commerciaux',
    role: 'COMMERCIAL',
    email: '',
  },
  5: {
    id: '5',
    name: 'Lorenzo',
    role: 'ADMIN',
    email: 'lorenzo@disciplina.re',
  },
}

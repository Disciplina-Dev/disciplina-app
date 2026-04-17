import { create } from 'zustand'
import { persist } from 'zustand/middleware'
// import type { UserId } from '@/types/entreprise'

export type UserRole = 'commercial' | 'responsable' | 'admin'

export interface AppUser {
  id: number
  name: string
  role: UserRole
  email: string
  initials: string
  color: string
}

// export interface AppUser {
  // id: UserId
  // name: string
  // role: UserRole
  // email: string
  // initials: string
  // color: string
// }

export const USERS: Record<number, AppUser> = {
  3: {
    id: 3,
    name: 'Brandon',
    role: 'commercial',
    email: 'galmar.commercial@disciplina.re',
    initials: 'BR',
    color: '#1130A7',
  },
  4: {
    id: 4,
    name: 'Emile',
    role: 'commercial',
    email: 'lebon.commercial@disciplina.re',
    initials: 'EM',
    color: '#60207E',
  },
  2: {
    id: 2,
    name: 'Amanda',
    role: 'responsable',
    email: 'sinaman.commercial@disciplina.re',
    initials: 'AM',
    color: '#B10F55',
  },
  1: {
    id: 1,
    name: 'Pas de commerciaux',
    role: 'commercial',
    email: '',
    initials: 'NC',
    color: '#6B7280',
  },
  5: {
    id: 5,
    name: 'Lorenzo',
    role: 'admin',
    email: 'lorenzo@disciplina.re',
    initials: 'LO',
    color: '#1A7A4A',
  },
}

interface AuthStore {
  currentUserId: number
  setCurrentUser: (id: number) => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      currentUserId: 3,
      setCurrentUser: (id) => set({ currentUserId: id }),
    }),
    { name: 'disciplina-auth' }
  )
)

export const useCurrentUser = (): AppUser => {
  const id = useAuthStore((s) => s.currentUserId)
  return USERS[id]
}

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserId } from '@/types/entreprise'

export type UserRole = 'commercial' | 'responsable' | 'admin'
export type UserCampus = 'Nord' | 'Ouest' | 'Sud'

export interface AppUser {
  id: UserId
  name: string
  role: UserRole
  email: string
  initials: string
  color: string
  campus: UserCampus
}

export const USERS: Record<UserId, AppUser> = {
  brandon: {
    id: 'brandon',
    name: 'Brandon',
    role: 'commercial',
    email: 'galmar.commercial@disciplina.re',
    initials: 'BR',
    color: '#1130A7',
    campus: 'Nord',
  },
  emile: {
    id: 'emile',
    name: 'Emile',
    role: 'commercial',
    email: 'lebon.commercial@disciplina.re',
    initials: 'EM',
    color: '#60207E',
    campus: 'Ouest',
  },
  amanda: {
    id: 'amanda',
    name: 'Amanda',
    role: 'responsable',
    email: 'sinaman.commercial@disciplina.re',
    initials: 'AM',
    color: '#B10F55',
    campus: 'Sud',
  },
  'pas de commerciaux': {
    id: 'pas de commerciaux',
    name: 'Pas de commerciaux',
    role: 'commercial',
    email: '',
    initials: 'NC',
    color: '#6B7280',
    campus: 'Nord',
  },
  lorenzo: {
    id: 'lorenzo',
    name: 'Lorenzo',
    role: 'admin',
    email: 'lorenzo@disciplina.re',
    initials: 'LO',
    color: '#1A7A4A',
    campus: 'Nord',
  },
}

interface AuthStore {
  currentUserId: UserId
  setCurrentUser: (id: UserId) => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      currentUserId: 'brandon',
      setCurrentUser: (id) => set({ currentUserId: id }),
    }),
    { name: 'disciplina-auth' }
  )
)

export const useCurrentUser = (): AppUser => {
  const id = useAuthStore((s) => s.currentUserId)
  return USERS[id]
}

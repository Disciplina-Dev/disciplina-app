import { create } from 'zustand'
import type { EntrepriseBlacklistee } from '@/types/entreprise'

interface BlacklistState {
  companies: EntrepriseBlacklistee[]
  loading: boolean
  error: string | null

  setCompanies: (companies: EntrepriseBlacklistee[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  removeCompany: (id: string) => void
}

export const useBlacklistStore = create<BlacklistState>((set) => ({
  companies: [],
  loading: false,
  error: null,

  setCompanies: (companies) => set({ companies }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  removeCompany: (id) => set((state) => ({
    companies: state.companies.filter((e) => e.id !== id)
  })),
}))

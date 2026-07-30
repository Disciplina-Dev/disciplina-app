import { create } from 'zustand'
import type { EntrepriseConflit } from '@/types/entreprise'
import { parseConflictType } from '@/features/quarantine/conflictTypes'

interface QuarantineState {
  companies: EntrepriseConflit[]
  loading: boolean
  error: string | null

  setCompanies: (companies: EntrepriseConflit[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  removeCompany: (id: string) => void
  removeByConflictType: (type: string) => void
  updateCompany: (id: string, patch: Partial<EntrepriseConflit>) => void
}

export const useQuarantineStore = create<QuarantineState>((set) => ({
  companies: [],
  loading: false,
  error: null,

  setCompanies: (companies) => set({ companies }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  removeCompany: (id) => set((state) => ({
    companies: state.companies.filter((e) => e.id !== id)
  })),

  removeByConflictType: (type) => set((state) => ({
    companies: state.companies.filter((e) => parseConflictType(e.conclusion) !== type)
  })),

  updateCompany: (id, patch) => set((state) => ({
    companies: state.companies.map((e) => (e.id === id ? { ...e, ...patch } : e))
  })),
}))

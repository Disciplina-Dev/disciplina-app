import { create } from 'zustand'
import type { Entreprise, SalePerson } from '@/types/entreprise'

interface PortefeuilleState {
  companies: Entreprise[]
  salePersons: SalePerson[]
  loading: boolean
  error: string | null

  setCompanies: (companies: Entreprise[]) => void
  setSalePersons: (salePersons: SalePerson[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  addCompany: (company: Entreprise) => void
  updateCompany: (id: string, updates: Partial<Entreprise>) => void
  removeCompany: (id: string) => void
  getCompanyById: (id: string) => Entreprise | undefined
  getCompanyBySiret: (siret: string) => Entreprise | undefined
}

export const usePortefeuilleStore = create<PortefeuilleState>((set, get) => ({
  companies: [],
  salePersons: [],
  loading: false,
  error: null,

  setCompanies: (companies) => set({ companies }),
  setSalePersons: (salePersons) => set({ salePersons }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  addCompany: (company) => set((state) => ({
    companies: [...state.companies, company]
  })),

  updateCompany: (id, updates) => set((state) => ({
    companies: state.companies.map((e) =>
      e.id === id ? { ...e, ...updates } : e
    )
  })),

  removeCompany: (id) => set((state) => ({
    companies: state.companies.filter((e) => e.id !== id)
  })),

  getCompanyById: (id) => {
    return get().companies.find((e) => e.id === id)
  },

  getCompanyBySiret: (siret) => {
    if (!siret) return undefined
    const normalised = siret.replace(/\s/g, '')
    return get().companies.find(
      (e) => e.siret?.replace(/\s/g, '') === normalised
    )
  },
}))

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Entreprise, UserId } from '@/types/entreprise'
import rawData from '@/data/entreprises.json'

const baseData = rawData as Entreprise[]

interface PortefeuilleStore {
  // Delta persistence: only store changes to keep localStorage light
  overrides: Record<string, Partial<Entreprise>>
  additions: Entreprise[]

  // Derived reads
  getAll: () => Entreprise[]
  getById: (id: string) => Entreprise | undefined
  getBySiret: (siret: string) => Entreprise | undefined

  // Mutations
  updateEntreprise: (id: string, updates: Partial<Entreprise>) => void
  createEntreprise: (data: Omit<Entreprise, 'id'>) => Entreprise
  claimEntreprise: (id: string, userId: UserId, userName: string) => void
}

export const usePortefeuilleStore = create<PortefeuilleStore>()(
  persist(
    (set, get) => ({
      overrides: {},
      additions: [],

      getAll: () => {
        const { overrides, additions } = get()
        const merged = baseData.map((e) =>
          overrides[e.id] ? { ...e, ...overrides[e.id] } : e
        )
        return [...merged, ...additions]
      },

      getById: (id) => {
        const { overrides, additions } = get()
        const fromBase = baseData.find((e) => e.id === id)
        if (fromBase) return overrides[id] ? { ...fromBase, ...overrides[id] } : fromBase
        return additions.find((e) => e.id === id)
      },

      getBySiret: (siret) => {
        if (!siret) return undefined
        const normalised = siret.replace(/\s/g, '')
        return get().getAll().find(
          (e) => e.siret?.replace(/\s/g, '') === normalised
        )
      },

      updateEntreprise: (id, updates) => {
        set((state) => {
          const isBase = baseData.some((e) => e.id === id)
          if (isBase) {
            return {
              overrides: {
                ...state.overrides,
                [id]: { ...(state.overrides[id] ?? {}), ...updates },
              },
            }
          }
          return {
            additions: state.additions.map((e) =>
              e.id === id ? { ...e, ...updates } : e
            ),
          }
        })
      },

      createEntreprise: (data) => {
        const newEntry: Entreprise = {
          ...data,
          id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        }
        set((state) => ({ additions: [...state.additions, newEntry] }))
        return newEntry
      },

      claimEntreprise: (id, userId, userName) => {
        get().updateEntreprise(id, {
          proprietaire_id: userId,
          commercial: userName,
        })
      },
    }),
    {
      name: 'disciplina-portefeuille',
      partialize: (state) => ({
        overrides: state.overrides,
        additions: state.additions,
      }),
    }
  )
)

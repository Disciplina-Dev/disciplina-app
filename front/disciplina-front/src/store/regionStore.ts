import { create } from 'zustand'

export type Region = 'reunion' | 'annemasse'

const STORAGE_KEY = 'disciplina-region'

function readStoredRegion(): Region | null {
  const value = localStorage.getItem(STORAGE_KEY)
  return value === 'reunion' || value === 'annemasse' ? value : null
}

interface RegionState {
  region: Region | null
  setRegion: (region: Region) => void
  clearRegion: () => void
}

export const useRegionStore = create<RegionState>((set) => ({
  region: readStoredRegion(),
  setRegion: (region) => {
    localStorage.setItem(STORAGE_KEY, region)
    set({ region })
  },
  clearRegion: () => {
    localStorage.removeItem(STORAGE_KEY)
    set({ region: null })
  },
}))

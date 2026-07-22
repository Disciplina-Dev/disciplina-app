import { create } from 'zustand'

const STORAGE_KEY = 'cv-import-guest-token'

interface GuestCvImportTokenState {
  token: string | null
  setToken: (token: string) => void
  clearToken: () => void
}

export const useGuestCvImportTokenStore = create<GuestCvImportTokenState>((set) => ({
  token: sessionStorage.getItem(STORAGE_KEY),

  setToken: (token) => {
    sessionStorage.setItem(STORAGE_KEY, token)
    set({ token })
  },

  clearToken: () => {
    sessionStorage.removeItem(STORAGE_KEY)
    set({ token: null })
  },
}))

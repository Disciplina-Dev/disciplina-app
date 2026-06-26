import { create } from 'zustand'

const STORAGE_KEY = 'interview-guest-token'

interface GuestInterviewTokenState {
  token: string | null
  setToken: (token: string) => void
  clearToken: () => void
}

export const useGuestInterviewTokenStore = create<GuestInterviewTokenState>((set) => ({
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

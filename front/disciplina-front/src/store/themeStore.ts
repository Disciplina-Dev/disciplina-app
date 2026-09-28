import { create } from 'zustand'
import {
  applyTheme,
  getSystemTheme,
  readStoredPreference,
  resolveTheme,
  storePreference,
  type ResolvedTheme,
  type ThemePreference,
} from '@/lib/theme'

type ThemeState = {
  preference: ThemePreference
  resolved: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
  /** Bascule clair ↔ sombre en figeant la préférence (sort du mode 'system'). */
  toggle: () => void
}

const initialPreference = readStoredPreference()

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: initialPreference,
  resolved: resolveTheme(initialPreference),
  setPreference: (preference) => {
    storePreference(preference)
    set({ preference, resolved: applyTheme(preference) })
  },
  toggle: () => {
    const next = get().resolved === 'dark' ? 'light' : 'dark'
    get().setPreference(next)
  },
}))

// Quand l'utilisateur est en mode 'system', on suit les changements de l'OS.
if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (useThemeStore.getState().preference !== 'system') return
    useThemeStore.setState({ resolved: applyTheme('system') })
  })
}

export { getSystemTheme }
export type { ThemePreference, ResolvedTheme }

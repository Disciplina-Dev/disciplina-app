import { create } from 'zustand'

const STORAGE_KEY = 'disciplina-sidebar-pinned'

function readPinned(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    // localStorage indisponible : la barre démarre repliée, ce qui reste
    // utilisable puisqu'elle s'ouvre au survol et au focus clavier.
    return false
  }
}

type SidebarState = {
  /** Barre figée ouverte : indispensable au clavier et sur écran tactile. */
  pinned: boolean
  togglePinned: () => void
}

export const useSidebarStore = create<SidebarState>((set, get) => ({
  pinned: readPinned(),
  togglePinned: () => {
    const pinned = !get().pinned
    try {
      localStorage.setItem(STORAGE_KEY, String(pinned))
    } catch {
      // Échec silencieux : le choix vaut pour la session en cours.
    }
    set({ pinned })
  },
}))

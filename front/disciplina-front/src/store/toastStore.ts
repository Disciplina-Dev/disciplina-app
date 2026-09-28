import { create } from 'zustand'
import { toFrenchError } from '@/lib/errorMessages'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export type Toast = {
  id: string
  variant: ToastVariant
  title: string
  description?: string
  /** Durée avant disparition, en ms. `null` = ne disparaît pas tout seul. */
  duration: number | null
  action?: { label: string; onClick: () => void }
}

type ToastInput = {
  title: string
  description?: string
  duration?: number | null
  action?: Toast['action']
}

/** Au-delà, les toasts les plus anciens sont évincés pour ne pas noyer l'écran. */
const MAX_VISIBLE = 3

const DEFAULT_DURATIONS: Record<ToastVariant, number | null> = {
  success: 4000,
  info: 5000,
  warning: 7000,
  // Les erreurs restent jusqu'à ce que l'utilisateur les ferme : il doit avoir
  // le temps de les lire et éventuellement de les recopier.
  error: null,
}

type ToastState = {
  toasts: Toast[]
  push: (variant: ToastVariant, input: ToastInput) => string
  dismiss: (id: string) => void
  clear: () => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (variant, input) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const toast: Toast = {
      id,
      variant,
      title: input.title,
      description: input.description,
      duration: input.duration === undefined ? DEFAULT_DURATIONS[variant] : input.duration,
      action: input.action,
    }
    set((state) => ({ toasts: [...state.toasts, toast].slice(-MAX_VISIBLE) }))
    return id
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}))

/**
 * Helpers appelables hors composant React (services, exchanges urql, …).
 *
 * `toast.error` accepte directement une erreur brute : elle est traduite en
 * français par `toFrenchError` avant affichage.
 */
export const toast = {
  success: (title: string, description?: string) =>
    useToastStore.getState().push('success', { title, description }),
  info: (title: string, description?: string) =>
    useToastStore.getState().push('info', { title, description }),
  warning: (title: string, description?: string) =>
    useToastStore.getState().push('warning', { title, description }),
  error: (error: unknown, title = 'Une erreur est survenue') =>
    useToastStore.getState().push('error', {
      title,
      description: toFrenchError(error),
    }),
  /** Erreur dont le message est déjà rédigé en français. */
  errorMessage: (title: string, description?: string) =>
    useToastStore.getState().push('error', { title, description }),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
}

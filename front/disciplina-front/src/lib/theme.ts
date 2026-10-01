/**
 * Gestion du thème clair/sombre.
 *
 * Le thème est appliqué via `data-theme` sur <html>, lu par les tokens CSS de
 * `index.css`. Trois états possibles : 'light', 'dark' ou 'system' (défaut),
 * ce dernier suivant la préférence du système d'exploitation.
 */
export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'disciplina-theme'

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    // localStorage indisponible (navigation privée, cookies bloqués) : on
    // retombe sur la préférence système, ce qui reste un défaut correct.
  }
  return 'system'
}

export function storePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // Échec silencieux : le thème reste appliqué pour la session en cours.
  }
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? getSystemTheme() : preference
}

export function applyTheme(preference: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(preference)
  document.documentElement.setAttribute('data-theme', resolved)
  return resolved
}

/** Applique le thème stocké le plus tôt possible, avant le premier rendu. */
export function initTheme(): void {
  applyTheme(readStoredPreference())
}

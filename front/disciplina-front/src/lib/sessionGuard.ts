import { handleSessionExpired } from '@/store/authStore'

/**
 * Installe un intercepteur global sur window.fetch : toute réponse 401 venant
 * de l'API back (session expirée / token invalide) déclenche la fin de session,
 * ce qui renvoie l'utilisateur vers la page de login via ProtectedRoute.
 *
 * N'affecte que les appels vers VITE_API_URL pour éviter les faux positifs
 * (ressources tierces, Google, etc.).
 */
// Comparer les origines, pas les préfixes : « https://app.disciplina.re.evil.com »
// commence par « https://app.disciplina.re ».
function isSameOrigin(url: string, base: string): boolean {
  try {
    return new URL(url, window.location.href).origin === new URL(base).origin
  } catch {
    return false
  }
}

export function installSessionGuard(): void {
  const apiBase = import.meta.env.VITE_API_URL as string | undefined
  const originalFetch = window.fetch.bind(window)

  window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
    const response = await originalFetch(...args)

    if (response.status === 401 && apiBase) {
      const url =
        typeof args[0] === 'string'
          ? args[0]
          : args[0] instanceof URL
            ? args[0].toString()
            : args[0]?.url ?? ''
      // On ne réagit qu'aux 401 de l'API applicative, pas des appels de login eux-mêmes.
      if (isSameOrigin(url, apiBase) && !url.includes('/api/auth/login')) {
        handleSessionExpired()
      }
    }

    return response
  }
}

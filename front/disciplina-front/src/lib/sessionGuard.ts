import { handleSessionExpired } from '@/store/authStore'
import { refreshSession } from '@/api/auth'
import { CSRF_HEADER, getCsrfCookie } from '@/lib/csrf'

/**
 * Installe un intercepteur global sur window.fetch : c'est le point bas niveau
 * par lequel transitent aussi bien les appels REST (httpClient.ts) que GraphQL
 * (urql utilise fetch en interne), donc le seul endroit qui centralise, sans
 * doublon, la tentative de refresh silencieux + retry sur un 401.
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

function requestUrl(args: Parameters<typeof fetch>): string {
  const input = args[0]
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input?.url ?? ''
}

// Le cookie CSRF est réémis à chaque /refresh : sur le retry, l'en-tête
// x-csrf-token éventuellement posé par l'appelant doit être rafraîchi.
function withFreshCsrf(args: Parameters<typeof fetch>): Parameters<typeof fetch> {
  const [input, init] = args
  if (!init?.headers) return args
  const headers = new Headers(init.headers)
  if (!headers.has(CSRF_HEADER)) return args
  const csrf = getCsrfCookie()
  if (csrf) headers.set(CSRF_HEADER, csrf)
  return [input, { ...init, headers }]
}

let refreshInFlight: Promise<boolean> | null = null
function refreshOnce(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = refreshSession().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

export function installSessionGuard(): void {
  const apiBase = import.meta.env.VITE_API_URL as string | undefined
  const originalFetch = window.fetch.bind(window)

  window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
    const response = await originalFetch(...args)
    if (response.status !== 401 || !apiBase) return response

    const url = requestUrl(args)
    const isAuthEndpoint = /\/api\/auth\/(login|refresh|logout)/.test(url)
    if (!isSameOrigin(url, apiBase) || isAuthEndpoint) return response

    const refreshed = await refreshOnce()
    if (!refreshed) {
      handleSessionExpired()
      return response
    }
    return originalFetch(...withFreshCsrf(args))
  }
}

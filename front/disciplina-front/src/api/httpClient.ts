import { CSRF_HEADER, getCsrfCookie } from '@/lib/csrf'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function buildHeaders(method: string, init?: RequestInit): HeadersInit {
  const headers = new Headers(init?.headers)
  const csrf = getCsrfCookie()
  if (!SAFE_METHODS.has(method) && csrf) headers.set(CSRF_HEADER, csrf)
  return headers
}

// Wrapper fetch unique : cookie d'auth envoyé automatiquement (credentials),
// en-tête CSRF posé sur les méthodes mutantes. Le retry silencieux après un
// 401 (refresh de session) est géré une seule fois, de façon transparente,
// par le monkey-patch window.fetch de lib/sessionGuard.ts.
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const method = init.method ?? 'GET'
  const url = `${import.meta.env.VITE_API_URL}${path}`
  return fetch(url, {
    ...init,
    method,
    credentials: 'include',
    headers: buildHeaders(method, init),
  })
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, init)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const raw = body?.error
    throw new Error(typeof raw === 'string' ? raw : raw?.message || `Request failed (${response.status})`)
  }
  return response.json()
}

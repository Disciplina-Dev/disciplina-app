import type { AppUser } from '@/store/authStore'
import { apiFetch, apiJson } from '@/api/httpClient'

export async function fetchMe(): Promise<AppUser | null> {
  const res = await apiFetch('/api/auth/me')
  if (!res.ok) return null
  return res.json()
}

// Appelée exclusivement par lib/sessionGuard.ts (retry transparent sur 401) —
// /api/auth/refresh est exclu du guard lui-même, pas de risque de boucle.
export async function refreshSession(): Promise<boolean> {
  const res = await apiFetch('/api/auth/refresh', { method: 'POST' })
  return res.ok
}

export async function login(email: string, passwordPlain: string): Promise<AppUser> {
  const body = await apiJson<{ user: AppUser }>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, passwordPlain }),
  })
  return body.user
}

export async function logout(): Promise<void> {
  await apiFetch('/api/auth/logout', { method: 'POST' })
}

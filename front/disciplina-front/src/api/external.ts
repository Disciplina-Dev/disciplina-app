import { apiFetch } from '@/api/httpClient'

export interface ExternalProfile {
  externalEmail: string
  guestType: string
  externalUuid: string
  expiresAt: string | null
}

export class ExternalAuthError extends Error {}

export type OpenExternalResult =
  | { ok: true; referenceId: number; expiresAt: string }
  | { ok: false; reason: 'invalid' | 'blocked' | 'expired' | 'completed' }

export async function openExternalLink(signature: string): Promise<OpenExternalResult> {
  const res = await apiFetch(`/api/external/${signature}/authenticate`, { method: 'POST' })

  if (res.status === 404) return { ok: false, reason: 'invalid' }
  if (res.status === 410) return { ok: false, reason: 'expired' }
  if (!res.ok) throw new Error(`Ouverture du lien échouée (${res.status})`)

  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean
    message?: string
    user?: { referenceId: number }
    expiresAt?: string
  }
  if (body.success && body.user && body.expiresAt) {
    return { ok: true, referenceId: body.user.referenceId, expiresAt: body.expiresAt }
  }
  const message = body.message ?? ''
  if (/already completed/.test(message)) return { ok: false, reason: 'completed' }
  if (/locked/.test(message)) return { ok: false, reason: 'blocked' }
  if (/expired/.test(message)) return { ok: false, reason: 'expired' }
  return { ok: false, reason: 'invalid' }
}

export async function getExternalProfile(signature: string): Promise<ExternalProfile> {
  const res = await apiFetch(`/api/external/${signature}/profile`)
  if (res.status === 401) throw new ExternalAuthError("Session expirée, veuillez rouvrir votre lien d'accès")
  if (!res.ok) throw new Error(`Chargement du profil échoué (${res.status})`)
  return res.json()
}

export async function completeExternalCv(signature: string): Promise<void> {
  const res = await apiFetch(`/api/external/${signature}/completed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `Finalisation de l'import échouée (${res.status})`)
  }
}

export async function uploadExternalCv(signature: string, file: File): Promise<void> {
  const res = await apiFetch(`/api/external/${signature}/cv-upload`, {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? "Erreur lors de l'upload")
  }
}

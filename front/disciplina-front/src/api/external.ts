import { apiFetch } from '@/api/httpClient'

const MAX_ATTEMPTS = 3

export interface ExternalProfile {
  externalEmail: string
  guestType: string
  externalUuid: string
}

export class ExternalAuthError extends Error {}

export type InspectExternalResult =
  | { ok: true; referenceId: number }
  | { ok: false; reason: 'invalid' | 'locked' | 'already-authenticated' | 'wrong-code'; remaining?: number }

export async function inspectExternal(signature: string, code: string): Promise<InspectExternalResult> {
  console.log('signature: ', signature, ' code: ', code);
  const res = await apiFetch('/api/external/inspect', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ signature, code }),
  })

  if (res.ok) {
    const body = (await res.json()) as { user: { referenceId: number } }
    return { ok: true, referenceId: body.user.referenceId }
  }

  const body = (await res.json().catch(() => ({}))) as { error?: string }
  const error = body.error ?? ''

  if (/already authenticated/.test(error)) return { ok: false, reason: 'already-authenticated' }
  if (/locked/.test(error)) return { ok: false, reason: 'locked' }
  const wrongCode = error.match(/Wrong code (\d+) attempts/)
  if (wrongCode) {
    return { ok: false, reason: 'wrong-code', remaining: Math.max(0, MAX_ATTEMPTS - Number(wrongCode[1])) }
  }
  return { ok: false, reason: 'invalid' }
}

export type SendCodeExternalResult = { ok: true } | { ok: false; reason: 'invalid' | 'blocked' | 'completed' }

export async function sendCodeExternal(signature: string): Promise<SendCodeExternalResult> {
  const res = await apiFetch(`/api/external/${signature}/authenticate`, { method: 'POST' })

  if (res.status === 404) return { ok: false, reason: 'invalid' }
  if (!res.ok) throw new Error(`Envoi du code échoué (${res.status})`)

  const body = (await res.json().catch(() => ({}))) as { message?: string }
  const message = body.message ?? ''
  if (/already completed/.test(message)) return { ok: false, reason: 'completed' }
  if (/expired or locked/.test(message)) return { ok: false, reason: 'blocked' }
  return { ok: true }
}

export async function getExternalProfile(signature: string): Promise<ExternalProfile> {
  const res = await apiFetch(`/api/external/${signature}/profile`)
  if (res.status === 401) throw new ExternalAuthError("Session expirée, veuillez vous identifier à nouveau")
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
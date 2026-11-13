import { apiFetch } from '@/api/httpClient'
import type { Formateur, FormateurDetail, FormateurInput } from '@/types/formateur'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

async function staffCall<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(`/api/formateurs${path}`, init)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(
      typeof body?.error === 'string' ? body.error : `Requête formateurs échouée (${res.status})`,
    )
  }
  return body as T
}

export async function fetchFormateurs(): Promise<Formateur[]> {
  const body = await staffCall<{ formateurs: Formateur[] }>('')
  return body.formateurs
}

export async function fetchFormateur(id: string): Promise<FormateurDetail> {
  const body = await staffCall<{ formateur: FormateurDetail }>(`/${encodeURIComponent(id)}`)
  return body.formateur
}

export async function createFormateur(input: FormateurInput): Promise<FormateurDetail> {
  const body = await staffCall<{ formateur: FormateurDetail }>('', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  })
  return body.formateur
}

export async function updateFormateur(
  id: string,
  input: Partial<FormateurInput>,
): Promise<FormateurDetail> {
  const body = await staffCall<{ formateur: FormateurDetail }>(`/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  })
  return body.formateur
}

export async function addFormateurNote(id: string, note: string): Promise<FormateurDetail> {
  const body = await staffCall<{ formateur: FormateurDetail }>(
    `/${encodeURIComponent(id)}/notes`,
    {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ note }),
    },
  )
  return body.formateur
}

// ── Compte de connexion à l'espace formateur ─────────────────────────────
// Créé, réinitialisé et retiré depuis la fiche : le formateur n'apparaît pas
// dans l'administration des utilisateurs.

export async function createFormateurAccount(id: string, password: string): Promise<FormateurDetail> {
  const body = await staffCall<{ formateur: FormateurDetail }>(
    `/${encodeURIComponent(id)}/account`,
    { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ password }) },
  )
  return body.formateur
}

export async function resetFormateurPassword(id: string, password: string): Promise<FormateurDetail> {
  const body = await staffCall<{ formateur: FormateurDetail }>(
    `/${encodeURIComponent(id)}/account`,
    { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ password }) },
  )
  return body.formateur
}

export async function deleteFormateurAccount(id: string): Promise<FormateurDetail> {
  const body = await staffCall<{ formateur: FormateurDetail }>(
    `/${encodeURIComponent(id)}/account`,
    { method: 'DELETE' },
  )
  return body.formateur
}

/** Supprime la fiche (204 sans corps) — le compte de connexion est retiré avec elle. */
export async function deleteFormateur(id: string): Promise<void> {
  const res = await apiFetch(`/api/formateurs/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(typeof body?.error === 'string' ? body.error : `Suppression impossible (${res.status})`)
  }
}

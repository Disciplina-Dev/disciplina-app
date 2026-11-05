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

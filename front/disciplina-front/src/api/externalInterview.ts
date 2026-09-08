import { apiFetch } from '@/api/httpClient'

export interface InterviewSlotView {
  slot: string
  taken: boolean
}

export interface InterviewSlotsResult {
  location?: string
  slots: InterviewSlotView[]
  bookedSlot?: string
}

export class ExternalAuthError extends Error {}
export class SlotUnavailableError extends Error {}
export class SessionCompletedError extends Error {}

const API_PATH = (signature: string) => `/api/external/${signature}/interview`

function parseError(res: Response): Promise<string> {
  return res.json().then((body) => body?.error ?? `Requête échouée (${res.status})`).catch(() => `Requête échouée (${res.status})`)
}

export async function getInterviewSlots(signature: string): Promise<InterviewSlotsResult> {
  const res = await apiFetch(`${API_PATH(signature)}/slots`)
  if (res.status === 401) throw new ExternalAuthError('Session expirée, veuillez vous identifier à nouveau')
  if (res.status === 403) throw new ExternalAuthError('Démarche inaccessible')
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function bookInterviewSlot(signature: string, slot: string): Promise<void> {
  const res = await apiFetch(`${API_PATH(signature)}/book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slot }),
  })
  if (res.status === 409) {
    const error = await parseError(res)
    if (/already completed/i.test(error)) throw new SessionCompletedError(error)
    throw new SlotUnavailableError(error)
  }
  if (res.status === 401) throw new ExternalAuthError('Session expirée, veuillez vous identifier à nouveau')
  if (!res.ok) throw new Error(await parseError(res))
}
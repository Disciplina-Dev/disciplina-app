const API_BASE = import.meta.env.VITE_API_URL

export type RelanceChannel = 'PHONE' | 'MAIL'

export interface RelanceHistoryEntry {
  id: number
  companyID: number
  userID: number | null
  typeRelance: number | null
  channel: RelanceChannel
  subject: string | null
  note: string | null
  createdAt: string
}

export interface MailAttachment {
  filename: string
  contentType: string
  content: string // base64
}

interface SendMailPayload {
  to: string
  subject: string
  html?: string
  text?: string
  attachments?: MailAttachment[]
  typeRelance?: number | null
}

async function relanceFetch(token: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}/api/relance${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  })
}

/** Envoie la relance mail (envoi réel), historise et retire l'entreprise de la liste. */
export async function sendCompanyMailRelance(token: string, companyId: number, payload: SendMailPayload): Promise<void> {
  const res = await relanceFetch(token, `/company/${companyId}/mail`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error || `Envoi de la relance mail échoué (${res.status})`)
  }
}

/** Marque une relance téléphonique comme faite (résumé d'appel), historise et retire l'entreprise. */
export async function completePhoneRelance(
  token: string,
  companyId: number,
  payload: { note: string; typeRelance?: number | null },
): Promise<void> {
  const res = await relanceFetch(token, `/company/${companyId}/phone`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error || `Enregistrement de la relance échoué (${res.status})`)
  }
}

export async function getCompanyRelanceHistory(token: string, companyId: number): Promise<RelanceHistoryEntry[]> {
  const res = await relanceFetch(token, `/company/${companyId}/history`)
  if (!res.ok) throw new Error(`Chargement de l'historique échoué (${res.status})`)
  return res.json()
}

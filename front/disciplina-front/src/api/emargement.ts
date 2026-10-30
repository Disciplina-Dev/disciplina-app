import { apiFetch } from '@/api/httpClient'
import type {
  CreateSeanceInput,
  EmargementHalf,
  EmargementStatus,
  FormateurView,
  PublicSigning,
  QrSignResult,
  Seance,
  SeanceDetail,
  SeanceLinks,
} from '@/types/emargement'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

// ── Côté Peda (session CRM) ──────────────────────────────────────────────────

async function staffCall<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(`/api/emargement${path}`, init)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(typeof body?.error === 'string' ? body.error : `Requête émargement échouée (${res.status})`)
  }
  return body as T
}

export interface SeanceFilters {
  from?: string
  to?: string
  sessionId?: string
}

export async function fetchSeances(filters: SeanceFilters = {}): Promise<Seance[]> {
  const params = new URLSearchParams()
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.sessionId) params.set('sessionId', filters.sessionId)
  const query = params.toString()
  const body = await staffCall<{ seances: Seance[] }>(`/seances${query ? `?${query}` : ''}`)
  return body.seances
}

export async function fetchSeance(id: string): Promise<SeanceDetail> {
  const body = await staffCall<{ seance: SeanceDetail }>(`/seances/${encodeURIComponent(id)}`)
  return body.seance
}

export interface CreatedSeance {
  seance: Seance
  /** `false` = l'e-mail d'invitation n'a pas pu partir : le lien est à transmettre à la main. */
  inviteSent: boolean
}

export interface InviteResult {
  links: SeanceLinks
  inviteSent: boolean
}

export async function createSeance(input: CreateSeanceInput): Promise<CreatedSeance> {
  return staffCall<CreatedSeance>('/seances', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  })
}

export async function updateSeance(id: string, input: CreateSeanceInput): Promise<Seance> {
  const body = await staffCall<{ seance: Seance }>(`/seances/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  })
  return body.seance
}

export async function deleteSeance(id: string): Promise<void> {
  await staffCall<{ deleted: boolean }>(`/seances/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/** Renvoie l'invitation ; `rotate` révoque les liens déjà diffusés. */
export async function resendInvite(id: string, rotate = false): Promise<InviteResult> {
  return staffCall<InviteResult>(`/seances/${encodeURIComponent(id)}/resend`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ rotate }),
  })
}

// ── Pages publiques (lien formateur / QR alternant) ─────────────────────────
// Pas d'apiFetch : aucun cookie ni en-tête CSRF du CRM ne doit transiter par un
// lien reçu par e-mail ou scanné depuis un téléphone personnel.

export class EmargementLinkError extends Error {
  code: string
  status: number

  constructor(status: number, code: string, message: string) {
    super(message)
    this.code = code
    this.status = status
  }
}

function publicUrl(kind: 'formateur' | 'sign', token: string, suffix = ''): string {
  return `${import.meta.env.VITE_API_URL}/api/emargement/${kind}/${encodeURIComponent(token)}${suffix}`
}

async function publicCall<T>(method: 'GET' | 'POST' | 'PUT', url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'omit',
    headers: body === undefined ? undefined : JSON_HEADERS,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new EmargementLinkError(
      res.status,
      typeof data?.code === 'string' ? data.code : 'error',
      typeof data?.error === 'string' ? data.error : `Requête échouée (${res.status})`,
    )
  }
  return data as T
}

export type AttendancePayload = {
  alternantId: string
  half: EmargementHalf
  status: EmargementStatus
  statusTime: string | null
}

export type AttendanceRecordPayload = FormateurView['alternants'][number]['attendance']['morning']

export async function fetchFormateurView(token: string): Promise<FormateurView> {
  const body = await publicCall<{ emargement: FormateurView }>('GET', publicUrl('formateur', token))
  return body.emargement
}

export async function saveAttendance(token: string, payload: AttendancePayload): Promise<AttendanceRecordPayload> {
  // PUT : la route est un upsert idempotent par (alternant, demi-journée).
  const body = await publicCall<{ attendance: AttendanceRecordPayload }>(
    'PUT',
    publicUrl('formateur', token, '/attendance'),
    payload,
  )
  return body.attendance
}

export async function signSheet(token: string, signature: string): Promise<{ signedAt: string; signedByName: string }> {
  // `confirmed` est construit ici : c'est la preuve du double contrôle demandé
  // au formateur avant verrouillage définitif de la feuille.
  return publicCall<{ signedAt: string; signedByName: string }>('POST', publicUrl('formateur', token, '/sign'), {
    confirmed: true,
    signature,
  })
}

export async function fetchPublicSigning(token: string): Promise<PublicSigning> {
  // Le back enveloppe le DTO : `{ seance: PublicSigningDto }`.
  const body = await publicCall<{ seance: PublicSigning }>('GET', publicUrl('sign', token))
  return body.seance
}

export async function signByQr(token: string, email: string): Promise<QrSignResult> {
  const body = await publicCall<{ result: QrSignResult }>('POST', publicUrl('sign', token), { email })
  return body.result
}

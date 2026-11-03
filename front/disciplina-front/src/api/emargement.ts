import { apiFetch } from '@/api/httpClient'
import type {
  Assiduite,
  AssiduiteAlternant,
  CreateSeanceInput,
  EmargementExportFilter,
  EmargementExportFormat,
  EmargementHalf,
  EmargementPdfTheme,
  EmargementStatus,
  FormateurView,
  PublicSigning,
  QrSignResult,
  Seance,
  SeanceDetail,
  SeanceLinks,
  SeanceSite,
  SeanceValidationStatus,
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
  /** État de validation calculé côté serveur (créneaux + délai de régularisation). */
  validation?: SeanceValidationStatus
  /** Ne garde que les feuilles avec des statuts non saisis sur un créneau fermé. */
  missing?: boolean
}

export async function fetchSeances(filters: SeanceFilters = {}): Promise<Seance[]> {
  const params = new URLSearchParams()
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.sessionId) params.set('sessionId', filters.sessionId)
  if (filters.validation) params.set('validation', filters.validation)
  if (filters.missing) params.set('missing', '1')
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

/**
 * Signature manuscrite de l'alternant, tracée sur l'appareil du formateur
 * (repli quand l'alternant ne peut pas scanner le QR avec son téléphone).
 * Route distincte de la saisie de statut : le tracé est conservé comme preuve.
 */
export async function saveHandwrittenSignature(
  token: string,
  payload: { alternantId: string; half: EmargementHalf; signature: string },
): Promise<AttendanceRecordPayload> {
  const body = await publicCall<{ attendance: AttendanceRecordPayload }>(
    'POST',
    publicUrl('formateur', token, '/attendance/sign'),
    payload,
  )
  return body.attendance
}

export async function signSheet(
  token: string,
  half: EmargementHalf,
  signature: string,
): Promise<{ half: EmargementHalf; signedAt: string; signedByName: string }> {
  // `confirmed` est construit ici : c'est la preuve du double contrôle demandé
  // au formateur avant verrouillage définitif de la demi-journée.
  return publicCall<{ half: EmargementHalf; signedAt: string; signedByName: string }>(
    'POST',
    publicUrl('formateur', token, '/sign'),
    { half, confirmed: true, signature },
  )
}

/** Validation de régularisation par le Peda : motif obligatoire, tracé côté serveur. */
export async function validateSeance(id: string, note: string): Promise<SeanceDetail> {
  const body = await staffCall<{ seance: SeanceDetail }>(`/seances/${encodeURIComponent(id)}/validate`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ note }),
  })
  return body.seance
}

export async function fetchPublicSigning(token: string): Promise<PublicSigning> {
  // Le back enveloppe le DTO : `{ seance: PublicSigningDto }`.
  const body = await publicCall<{ seance: PublicSigning }>('GET', publicUrl('sign', token))
  return body.seance
}

export async function signByQr(token: string, email: string, signature: string): Promise<QrSignResult> {
  const body = await publicCall<{ result: QrSignResult }>('POST', publicUrl('sign', token), { email, signature })
  return body.result
}

// ── Exports (§8) ─────────────────────────────────────────────────────────────

export interface DownloadedFile {
  blob: Blob
  fileName: string
}

/** GET binaire : le nom réel du fichier est dans `Content-Disposition` (UTF-8). */
async function downloadFile(path: string, fallbackName: string): Promise<DownloadedFile> {
  const res = await apiFetch(`/api/emargement${path}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(typeof body?.error === 'string' ? body.error : `Export impossible (${res.status})`)
  }
  const match = /filename\*=UTF-8''([^;]+)/.exec(res.headers.get('Content-Disposition') ?? '')
  return {
    blob: await res.blob(),
    fileName: match ? decodeURIComponent(match[1]) : fallbackName,
  }
}

function exportQuery(filter: EmargementExportFilter, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams()
  if (filter.seanceId) params.set('seanceId', filter.seanceId)
  if (filter.sessionId) params.set('sessionId', filter.sessionId)
  if (filter.from) params.set('from', filter.from)
  if (filter.to) params.set('to', filter.to)
  if (filter.includeArchived) params.set('includeArchived', '1')
  for (const [key, value] of Object.entries(extra)) params.set(key, value)
  const query = params.toString()
  return query ? `?${query}` : ''
}

/** Feuille d'émargement d'une séance (PDF, charte au choix). */
export function fetchSeancePdf(id: string, theme: EmargementPdfTheme): Promise<DownloadedFile> {
  return downloadFile(
    `/seances/${encodeURIComponent(id)}/pdf${exportQuery({}, { theme })}`,
    'emargement.pdf',
  )
}

/** Présences et heures (CSV ou Excel), éventuellement filtrées par séance / session / période. */
export function fetchAttendanceExport(
  filter: EmargementExportFilter,
  format: EmargementExportFormat,
): Promise<DownloadedFile> {
  return downloadFile(
    `/exports/attendance${exportQuery(filter, { format })}`,
    format === 'xlsx' ? 'presences.xlsx' : 'presences.csv',
  )
}

/** Journal d'audit des changements (CSV). */
export function fetchHistoryExport(filter: EmargementExportFilter): Promise<DownloadedFile> {
  return downloadFile(`/exports/history${exportQuery(filter)}`, 'journal-emargement.csv')
}

/** Attestation d'assiduité d'un alternant (PDF). */
export function fetchAttestation(
  alternantId: string,
  options: { from?: string; to?: string; theme?: EmargementPdfTheme } = {},
): Promise<DownloadedFile> {
  const extra: Record<string, string> = {}
  if (options.theme) extra.theme = options.theme
  return downloadFile(
    `/attestations/${encodeURIComponent(alternantId)}${exportQuery(
      { from: options.from, to: options.to },
      extra,
    )}`,
    'attestation-assiduite.pdf',
  )
}

/** Récapitulatif d'assiduité d'un groupe (session, période optionnelle) en PDF. */
export function fetchGroupSummary(
  sessionId: string,
  options: { from?: string; to?: string; theme?: EmargementPdfTheme } = {},
): Promise<DownloadedFile> {
  const extra: Record<string, string> = {}
  if (options.theme) extra.theme = options.theme
  return downloadFile(
    `/sessions/${encodeURIComponent(sessionId)}/attendance.pdf${exportQuery(
      { from: options.from, to: options.to },
      extra,
    )}`,
    'assiduite-groupe.pdf',
  )
}

// ── Assiduité (7.1 / 7.2) ────────────────────────────────────────────────────

export interface AssiduiteFilters {
  from?: string
  to?: string
  sessionId?: string
  site?: SeanceSite
}

function assiduiteQuery(filters: AssiduiteFilters): string {
  const params = new URLSearchParams()
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.sessionId) params.set('sessionId', filters.sessionId)
  if (filters.site) params.set('site', filters.site)
  const query = params.toString()
  return query ? `?${query}` : ''
}

/** Agrégats d'assiduité (par alternant, session et site) sur une période. */
export async function fetchAssiduite(filters: AssiduiteFilters = {}): Promise<Assiduite> {
  const body = await staffCall<{ assiduite: Assiduite }>(`/assiduite${assiduiteQuery(filters)}`)
  return body.assiduite
}

/** Assiduité d'un alternant : synthèse et détail séance par séance. */
export async function fetchAssiduiteAlternant(
  alternantId: string,
  options: { from?: string; to?: string } = {},
): Promise<AssiduiteAlternant> {
  const body = await staffCall<{ assiduite: AssiduiteAlternant }>(
    `/assiduite/${encodeURIComponent(alternantId)}${assiduiteQuery(options)}`,
  )
  return body.assiduite
}

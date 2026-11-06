import { apiFetch } from '@/api/httpClient'

export interface PedaDraftRunReport {
  pedas: number
  tabsRead: number
  tabsFailed: number
  rowsScanned: number
  boxesChecked: number
  created: number
  skippedExisting: number
  skippedNoTemplate: number
  skippedNoMail: number
  errors: number
  /** Motifs lisibles expliquant les brouillons non créés. */
  details: string[]
}

async function pedaFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await apiFetch(`/api/peda${path}`, init)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Requête Peda échouée (${res.status})`)
  }
  return res
}

const jsonHeaders = { 'Content-Type': 'application/json' }

// ── Sheet d'absences du Peda connecté ────────────────────────────────────────
export async function fetchPedaConfig(): Promise<{ sheetId: string | null }> {
  const res = await pedaFetch('/config')
  return res.json()
}

export async function savePedaSheet(link: string): Promise<{ sheetId: string }> {
  const res = await pedaFetch('/config/sheet', {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify({ link }),
  })
  return res.json()
}

export async function deletePedaSheet(): Promise<void> {
  await pedaFetch('/config/sheet', { method: 'DELETE' })
}

// ── Heure globale du job quotidien ───────────────────────────────────────────
export async function fetchDraftHour(): Promise<string> {
  const res = await pedaFetch('/config/hour')
  return ((await res.json()) as { hour: string }).hour
}

export async function saveDraftHour(hour: string): Promise<void> {
  await pedaFetch('/config/hour', { method: 'PUT', headers: jsonHeaders, body: JSON.stringify({ hour }) })
}

// ── Déclenchement manuel ─────────────────────────────────────────────────────
export async function runDraftJobNow(): Promise<PedaDraftRunReport> {
  const res = await pedaFetch('/run', { method: 'POST' })
  return ((await res.json()) as { report: PedaDraftRunReport }).report
}

// ── Agenda Google du Peda (synchronisé avec les SA) ──────────────────────────

export interface PedaCalendarEvent {
  id: string
  summary: string
  description?: string
  location?: string
  /** ISO datetime (événement horaire) ou YYYY-MM-DD (journée entière). */
  start: string
  end: string
  allDay: boolean
  colorId?: string
  htmlLink?: string
  /** Renseigné si l'événement est une SA (séquence d'accompagnement). */
  saSequenceId?: string
  /** Id de l'alternant de la SA (pour ouvrir sa fiche). */
  saAlternantId?: string
}

export interface PedaCalendarReport {
  connected: boolean
  created: number
  updated: number
  deleted: number
  rescheduled: number
  failed: number
}

/** Le compte Google du Peda n'est pas connecté (ou ses jetons sont expirés). */
export class PedaCalendarNotConnectedError extends Error {}

async function pedaCalendarFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await apiFetch(`/api/peda/calendar${path}`, init)
  if (res.status === 409) throw new PedaCalendarNotConnectedError('Google Calendar non connecté')
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Requête calendrier Peda échouée (${res.status})`)
  }
  return res
}

/**
 * Lit l'agenda du Peda connecté sur la plage : le backend réconcilie d'abord
 * les changements faits dans Google, puis pousse l'état des SA vers Google.
 */
export async function fetchPedaCalendarEvents(
  timeMin: Date,
  timeMax: Date,
): Promise<{ events: PedaCalendarEvent[]; report: PedaCalendarReport }> {
  const params = new URLSearchParams({ timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString() })
  const res = await pedaCalendarFetch(`/events?${params}`)
  return res.json()
}

/** Réconcilie Google → app puis repousse l'état des SA sur la fenêtre donnée. */
export async function reconcilePedaCalendar(
  timeMin: Date,
  timeMax: Date,
): Promise<PedaCalendarReport> {
  // La lecture GET réconcilie d'abord les changements faits dans Google puis
  // repousse l'état des SA : c'est le seul point d'entrée qui fait le pull.
  const { report } = await fetchPedaCalendarEvents(timeMin, timeMax)
  return report
}

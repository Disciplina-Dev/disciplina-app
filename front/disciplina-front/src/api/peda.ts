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

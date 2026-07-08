const API_BASE = import.meta.env.VITE_API_URL

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

async function pedaFetch(path: string, token: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${API_BASE}/api/peda${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Requête Peda échouée (${res.status})`)
  }
  return res
}

const jsonHeaders = { 'Content-Type': 'application/json' }

// ── Sheet d'absences du Peda connecté ────────────────────────────────────────
export async function fetchPedaConfig(token: string): Promise<{ sheetId: string | null }> {
  const res = await pedaFetch('/config', token)
  return res.json()
}

export async function savePedaSheet(token: string, link: string): Promise<{ sheetId: string }> {
  const res = await pedaFetch('/config/sheet', token, {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify({ link }),
  })
  return res.json()
}

export async function deletePedaSheet(token: string): Promise<void> {
  await pedaFetch('/config/sheet', token, { method: 'DELETE' })
}

// ── Heure globale du job quotidien ───────────────────────────────────────────
export async function fetchDraftHour(token: string): Promise<string> {
  const res = await pedaFetch('/config/hour', token)
  return ((await res.json()) as { hour: string }).hour
}

export async function saveDraftHour(token: string, hour: string): Promise<void> {
  await pedaFetch('/config/hour', token, { method: 'PUT', headers: jsonHeaders, body: JSON.stringify({ hour }) })
}

// ── Déclenchement manuel ─────────────────────────────────────────────────────
export async function runDraftJobNow(token: string): Promise<PedaDraftRunReport> {
  const res = await pedaFetch('/run', token, { method: 'POST' })
  return ((await res.json()) as { report: PedaDraftRunReport }).report
}

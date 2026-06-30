const API_BASE = import.meta.env.VITE_API_URL

export interface SectorSetting {
  sector: string
  location: string
}

export async function fetchSectorSettings(token: string): Promise<SectorSetting[]> {
  const res = await fetch(`${API_BASE}/api/sector-settings`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Échec du chargement des lieux (${res.status})`)
  const data = (await res.json()) as { settings: SectorSetting[] }
  return data.settings
}

export async function updateSectorSettings(token: string, settings: SectorSetting[]): Promise<SectorSetting[]> {
  const res = await fetch(`${API_BASE}/api/sector-settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ settings }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Échec de la mise à jour (${res.status})`)
  }
  const data = (await res.json()) as { settings: SectorSetting[] }
  return data.settings
}

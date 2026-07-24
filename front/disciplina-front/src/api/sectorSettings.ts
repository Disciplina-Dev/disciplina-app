import { apiFetch } from '@/api/httpClient'

export interface SectorSetting {
  sector: string
  location: string
}

export async function fetchSectorSettings(): Promise<SectorSetting[]> {
  const res = await apiFetch('/api/sector-settings')
  if (!res.ok) throw new Error(`Échec du chargement des lieux (${res.status})`)
  const data = (await res.json()) as { settings: SectorSetting[] }
  return data.settings
}

export async function updateSectorSettings(settings: SectorSetting[]): Promise<SectorSetting[]> {
  const res = await apiFetch('/api/sector-settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Échec de la mise à jour (${res.status})`)
  }
  const data = (await res.json()) as { settings: SectorSetting[] }
  return data.settings
}

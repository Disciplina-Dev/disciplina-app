const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export interface SiretData {
  raison_sociale:       string
  siret:                string
  adresse:              string | null
  code_postal:          string | null
  commune:              string | null
  description_activite: string | null
}

export async function lookupSiret(siret: string): Promise<SiretData> {
  if (!/^\d{14}$/.test(siret)) {
    throw new Error('SIRET invalide — 14 chiffres requis')
  }

  const res = await fetch(`${API_BASE}/api/siret/${siret}`)
  const body = await res.json().catch(() => ({})) as { error?: string; hint?: string }

  if (!res.ok) {
    const msg = body.error ?? 'Erreur lors de la recherche SIRET'
    const hint = body.hint ? `\n${body.hint}` : ''
    throw new Error(msg + hint)
  }

  const json = body as unknown as { data: SiretData }
  return json.data
}

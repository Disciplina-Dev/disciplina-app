import { Router } from 'express'
import type { Request, Response } from 'express'
import type { RowDataPacket } from 'mysql2'
import { pool } from '../db'

const router = Router()
const SIRENE_API = 'https://recherche-entreprises.api.gouv.fr/search'

const SIRENE_HEADERS = {
  'User-Agent': 'Disciplina-CFA/1.0 (contact@disciplina.re)',
  'Accept': 'application/json',
}

// Retry une fois si 429 (rate-limit)
async function fetchSirene(siret: string) {
  const url = `${SIRENE_API}?q=${encodeURIComponent(siret)}&page=1&per_page=1`
  let fetchRes = await fetch(url, { headers: SIRENE_HEADERS })
  if (fetchRes.status === 429) {
    console.warn('[SIRENE] 429 rate-limit — retry dans 2s')
    await new Promise(r => setTimeout(r, 2000))
    fetchRes = await fetch(url, { headers: SIRENE_HEADERS })
  }
  return fetchRes
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SireneResult {
  nom_complet?: string
  nom_raison_sociale?: string
  libelle_activite_principale?: string | { NAFRev2?: string }
  siege?: {
    adresse?: string
    code_postal?: string
    libelle_commune?: string
  }
}

interface SireneResponse {
  results?: SireneResult[]
}

export interface CompanyLookup {
  name: string
  siret: string
  address: string
  code_postal: string
  commune: string
  main_activity: string
}

// ─── GET /api/companies/siret/:siret ─────────────────────────────────────────

router.get('/siret/:siret', async (req: Request, res: Response) => {
  const siret = Array.isArray(req.params['siret']) ? req.params['siret'][0] : req.params['siret'] ?? ''

  if (!/^\d{14}$/.test(siret)) {
    res.status(400).json({ error: 'SIRET invalide (14 chiffres requis)' })
    return
  }

  // 1. Vérifie en base locale d'abord
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT c.name, c.siret, c.address, c.main_activity,
              s.code_postal, s.name AS commune
       FROM companies c
       LEFT JOIN sector s ON c.sector_id = s.id
       WHERE c.siret = ?`,
      [siret]
    )
    if (rows.length > 0) {
      res.json({ source: 'db', data: rows[0] as CompanyLookup })
      return
    }
  } catch (err) {
    console.error('[companies] DB lookup failed:', err)
    // Continue vers SIRENE même si la DB est KO
  }

  // 2. Appel API SIRENE publique (INSEE)
  try {
    const sireneRes = await fetchSirene(siret)

    if (sireneRes.status === 429) {
      console.error('[SIRENE] Toujours 429 après retry')
      res.status(429).json({ error: 'Trop de requêtes SIRENE — réessayez dans quelques secondes' })
      return
    }
    if (sireneRes.status === 404 || sireneRes.status === 400) {
      res.status(404).json({ error: 'SIRET non trouvé' })
      return
    }
    if (!sireneRes.ok) {
      console.error(`[SIRENE] HTTP ${sireneRes.status}`)
      res.status(503).json({ error: `Service SIRENE indisponible (HTTP ${sireneRes.status})` })
      return
    }

    const json = await sireneRes.json() as SireneResponse
    const result = json.results?.[0]

    if (!result) {
      res.status(404).json({ error: 'SIRET non trouvé' })
      return
    }

    const activityLabel =
      typeof result.libelle_activite_principale === 'string'
        ? result.libelle_activite_principale
        : (result.libelle_activite_principale?.NAFRev2 ?? '')

    const data: CompanyLookup = {
      name:          result.nom_complet ?? result.nom_raison_sociale ?? '',
      siret,
      address:       result.siege?.adresse       ?? '',
      code_postal:   result.siege?.code_postal   ?? '',
      commune:       result.siege?.libelle_commune ?? '',
      main_activity: activityLabel,
    }

    res.json({ source: 'sirene', data })
  } catch (err) {
    console.error('[SIRENE] Erreur réseau :', err)
    res.status(503).json({ error: 'Impossible de joindre le service SIRENE' })
  }
})

export default router

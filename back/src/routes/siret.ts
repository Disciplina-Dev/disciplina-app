import { Router, Request, Response } from 'express'
import { pool } from '../db'
import type { RowDataPacket } from 'mysql2'

const router = Router()

const GOUV_API = 'https://recherche-entreprises.api.gouv.fr/search'

interface GouvResult {
  siren:             string
  nom_complet?:      string
  nom_raison_sociale?: string
  siege?: {
    siret?:                       string
    adresse?:                     string
    code_postal?:                 string
    commune?:                     string
    libelle_commune?:             string
    activite_principale?:         string
    libelle_activite_principale?: string
  }
}

async function fetchFromGouv(siret: string): Promise<{ data: GouvResult | null; rateLimited: boolean }> {
  const siren = siret.slice(0, 9)
  const url   = `${GOUV_API}?q=${siren}&per_page=1`

  const attempt = async () => fetch(url, { headers: { Accept: 'application/json' } })

  let res = await attempt()

  if (res.status === 429) {
    await new Promise(r => setTimeout(r, 3000))
    res = await attempt()
  }

  if (res.status === 429) return { data: null, rateLimited: true }
  if (!res.ok)            return { data: null, rateLimited: false }

  const json = await res.json() as { results: GouvResult[]; total_results: number }
  return { data: json.results?.[0] ?? null, rateLimited: false }
}

// GET /api/siret/:siret
router.get('/:siret', async (req: Request, res: Response) => {
  const siret = String(req.params['siret'] ?? '')

  if (!/^\d{14}$/.test(siret)) {
    res.status(400).json({ error: 'SIRET invalide — 14 chiffres requis' })
    return
  }

  // 1. Vérifier en base locale
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT raison_sociale, siret, adresse, code_postal, commune, description_activite FROM entreprise WHERE siret = ?',
      [siret]
    )
    if (rows.length > 0) {
      const e = rows[0]
      res.json({
        source: 'db',
        data: {
          raison_sociale:       e['raison_sociale'],
          siret:                e['siret'],
          adresse:              e['adresse'],
          code_postal:          e['code_postal'],
          commune:              e['commune'],
          description_activite: e['description_activite'],
        },
      })
      return
    }
  } catch (err) {
    console.error('[siret] DB lookup failed', err)
  }

  // 2. API gouvernementale
  try {
    const { data, rateLimited } = await fetchFromGouv(siret)

    if (rateLimited) {
      res.status(503).json({
        error: 'Service temporairement surchargé — réessayez dans quelques secondes.',
        hint: 'Vous pouvez aussi remplir les champs manuellement.',
      })
      return
    }

    if (!data) {
      res.status(404).json({
        error: 'Entreprise introuvable pour ce SIRET.',
        hint: 'Remplissez les champs manuellement.',
      })
      return
    }

    const siege    = data.siege ?? {}
    const nom      = data.nom_complet ?? data.nom_raison_sociale ?? ''
    const activite = siege.libelle_activite_principale ?? siege.activite_principale ?? null

    res.json({
      source: 'gouv',
      data: {
        raison_sociale:       nom,
        siret,
        adresse:              siege.adresse ?? null,
        code_postal:          siege.code_postal ?? null,
        commune:              siege.libelle_commune ?? siege.commune ?? null,
        description_activite: activite,
      },
    })
  } catch (err) {
    console.error('[siret] API gouv error', err)
    res.status(500).json({
      error: 'Erreur lors de la recherche SIRET.',
      hint: 'Remplissez les champs manuellement.',
    })
  }
})

export default router

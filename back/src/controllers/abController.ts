import { Request, Response } from 'express'
import { pool } from '../db'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContactPayload {
  nom_prenom: string
  fonction?: string
  telephone?: string
  email?: string
}

export interface SubmitPayload {
  // Entreprise
  raison_sociale: string
  siret?: string
  adresse?: string
  code_postal?: string
  commune?: string
  description_activite?: string
  // Contacts
  representant_legal: ContactPayload
  responsable_recrutement: ContactPayload
  // AB
  commercial_id?: number
  centre: 'nord' | 'ouest' | 'sud'
  domaine: 'secretariat' | 'vente'
  niveau: 'bac' | 'bac2' | 'bac3'
  intitule_metier?: string
  localisation_poste?: string
  nb_postes?: number
  description_missions?: string
  profil_recherche?: string
  competences?: string
  commentaires?: string
  missions_cochees?: string[]
  age_exige?: string
  permis?: string
  experience?: string
  methode_recrutement?: string
  pmsmp?: string
  jours_formation?: Record<string, string>
  engagement_evolution?: boolean
  engagement_adaptation?: boolean
  engagement_reajustement?: boolean
  clause_confidentialite?: boolean
  lieu_signature?: string
  date_signature?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function upsertEntreprise(
  conn: Awaited<ReturnType<typeof pool.getConnection>>,
  payload: SubmitPayload
): Promise<number> {
  if (payload.siret) {
    const [rows] = await conn.query<RowDataPacket[]>(
      'SELECT id FROM entreprise WHERE siret = ?',
      [payload.siret]
    )
    if (rows.length > 0) {
      await conn.query(
        `UPDATE entreprise SET raison_sociale=?, adresse=?, code_postal=?, commune=?, description_activite=?, updated_at=NOW()
         WHERE siret=?`,
        [payload.raison_sociale, payload.adresse, payload.code_postal, payload.commune, payload.description_activite, payload.siret]
      )
      return rows[0].id as number
    }
  }

  const [result] = await conn.query<ResultSetHeader>(
    `INSERT INTO entreprise (raison_sociale, siret, adresse, code_postal, commune, description_activite)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [payload.raison_sociale, payload.siret ?? null, payload.adresse ?? null,
     payload.code_postal ?? null, payload.commune ?? null, payload.description_activite ?? null]
  )
  return result.insertId
}

async function upsertContacts(
  conn: Awaited<ReturnType<typeof pool.getConnection>>,
  entreprise_id: number,
  payload: SubmitPayload
): Promise<void> {
  await conn.query('DELETE FROM contact_entreprise WHERE entreprise_id = ?', [entreprise_id])

  const contacts: Array<[number, string, string | undefined, string | undefined, string | undefined, string]> = [
    [entreprise_id, payload.representant_legal.nom_prenom, payload.representant_legal.fonction,
     payload.representant_legal.telephone, payload.representant_legal.email, 'representant_legal'],
    [entreprise_id, payload.responsable_recrutement.nom_prenom, payload.responsable_recrutement.fonction,
     payload.responsable_recrutement.telephone, payload.responsable_recrutement.email, 'responsable_recrutement'],
  ]

  for (const c of contacts) {
    if (c[1]) {
      await conn.query(
        `INSERT INTO contact_entreprise (entreprise_id, nom_prenom, fonction, telephone, email, type)
         VALUES (?, ?, ?, ?, ?, ?)`,
        c
      )
    }
  }
}

// ─── Controllers ──────────────────────────────────────────────────────────────

// Valide le formulaire et stocke le payload en attente de signature YouSign
export async function submitAB(req: Request, res: Response): Promise<void> {
  const payload = req.body as SubmitPayload

  if (!payload.raison_sociale || !payload.domaine || !payload.niveau || !payload.centre) {
    res.status(400).json({ error: 'Champs obligatoires manquants (raison_sociale, domaine, niveau, centre)' })
    return
  }
  if (!payload.representant_legal?.nom_prenom) {
    res.status(400).json({ error: 'Représentant légal requis' })
    return
  }

  // Stocker uniquement le payload — la DB principale sera alimentée après signature (webhook)
  res.json({ success: true, payload })
}

// Appelé par yousignController après activation de la demande de signature
export async function saveSignedAB(
  payload: SubmitPayload,
  yousign_request_id: string
): Promise<number> {
  const commercial_id = Number(payload.commercial_id ?? 1)
  const conn = await pool.getConnection()

  try {
    await conn.beginTransaction()

    const entreprise_id = await upsertEntreprise(conn, payload)
    await upsertContacts(conn, entreprise_id, payload)

    const [result] = await conn.query<ResultSetHeader>(
      `INSERT INTO analyse_besoin (
        entreprise_id, commercial_id, centre, statut,
        domaine, niveau, intitule_metier, localisation_poste, nb_postes,
        description_missions, profil_recherche, competences, commentaires, missions_cochees,
        age_exige, permis, experience,
        methode_recrutement, pmsmp, jours_formation,
        engagement_evolution, engagement_adaptation, engagement_reajustement,
        clause_confidentialite, lieu_signature, date_signature,
        yousign_request_id, sent_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())`,
      [
        entreprise_id, commercial_id, payload.centre, 'envoye',
        payload.domaine, payload.niveau, payload.intitule_metier ?? null,
        payload.localisation_poste ?? null, payload.nb_postes ?? 1,
        payload.description_missions ?? null, payload.profil_recherche ?? null,
        payload.competences ?? null, payload.commentaires ?? null,
        payload.missions_cochees ? JSON.stringify(payload.missions_cochees) : null,
        payload.age_exige ?? null, payload.permis ?? null, payload.experience ?? null,
        payload.methode_recrutement ?? null, payload.pmsmp ?? null,
        payload.jours_formation ? JSON.stringify(payload.jours_formation) : null,
        payload.engagement_evolution ? 1 : 0,
        payload.engagement_adaptation ? 1 : 0,
        payload.engagement_reajustement ? 1 : 0,
        payload.clause_confidentialite ? 1 : 0,
        payload.lieu_signature ?? null, payload.date_signature ?? null,
        yousign_request_id,
      ]
    )

    await conn.commit()
    return result.insertId
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

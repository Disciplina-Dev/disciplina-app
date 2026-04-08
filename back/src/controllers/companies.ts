import { Request, Response } from 'express'
import { pool } from '../config/db'
import type {
  Entreprise, EntrepriseDetail, CallLog, Contact, Relance,
  CreateEntrepriseBody, UpdateEntrepriseBody, CreateCallBody, CreateRelanceBody,
} from '../types/company'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'

// ─── GET /api/companies ───────────────────────────────────────
export async function listCompanies(req: Request, res: Response) {
  const { statut, commercial_id, search } = req.query

  const conditions: string[] = []
  const params: unknown[]    = []

  if (statut)        { conditions.push('e.statut = ?');        params.push(statut) }
  if (commercial_id) { conditions.push('e.commercial_id = ?'); params.push(commercial_id) }
  if (search) {
    conditions.push('(e.raison_sociale LIKE ? OR e.siret LIKE ? OR e.secteur LIKE ?)')
    const q = `%${search}%`
    params.push(q, q, q)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       e.*,
       CONCAT(u.prenom, ' ', u.nom) AS commercial_nom,
       (SELECT COUNT(*) FROM relances r
        WHERE r.entreprise_id = e.id AND r.statut = 'planifiée') AS relances_count
     FROM entreprise e
     LEFT JOIN utilisateur u ON u.id = e.commercial_id
     ${where}
     ORDER BY e.updated_at DESC`,
    params,
  )

  res.json({ data: rows as Entreprise[], total: rows.length })
}

// ─── GET /api/companies/:id ───────────────────────────────────
export async function getCompany(req: Request, res: Response) {
  const { id } = req.params

  const [[entreprise]] = await pool.query<RowDataPacket[]>(
    `SELECT e.*, CONCAT(u.prenom, ' ', u.nom) AS commercial_nom
     FROM entreprise e
     LEFT JOIN utilisateur u ON u.id = e.commercial_id
     WHERE e.id = ?`,
    [id],
  )

  if (!entreprise) {
    res.status(404).json({ error: 'Entreprise introuvable' })
    return
  }

  const [contacts] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM contact_entreprise WHERE entreprise_id = ? ORDER BY type',
    [id],
  )

  const [calls] = await pool.query<RowDataPacket[]>(
    `SELECT cl.*, CONCAT(u.prenom, ' ', u.nom) AS commercial_nom
     FROM call_logs cl
     LEFT JOIN utilisateur u ON u.id = cl.commercial_id
     WHERE cl.entreprise_id = ?
     ORDER BY cl.called_at DESC`,
    [id],
  )

  const [relances] = await pool.query<RowDataPacket[]>(
    `SELECT r.*, CONCAT(u.prenom, ' ', u.nom) AS commercial_nom
     FROM relances r
     LEFT JOIN utilisateur u ON u.id = r.commercial_id
     WHERE r.entreprise_id = ?
     ORDER BY FIELD(r.statut,'planifiée','faite','annulée'), r.scheduled_date`,
    [id],
  )

  const result: EntrepriseDetail = {
    ...(entreprise as Entreprise),
    contacts:  contacts as Contact[],
    calls:     calls as CallLog[],
    relances:  relances as Relance[],
    last_call: calls.length > 0 ? (calls[0] as CallLog) : null,
  }

  res.json({ data: result })
}

// ─── POST /api/companies ──────────────────────────────────────
export async function createCompany(req: Request, res: Response) {
  const body: CreateEntrepriseBody = req.body

  if (!body.raison_sociale?.trim()) {
    res.status(400).json({ error: 'Le champ "raison_sociale" est obligatoire' })
    return
  }

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO entreprise
       (raison_sociale, siret, adresse, code_postal, commune,
        description_activite, telephone, email, site,
        secteur, source, commercial_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      body.raison_sociale.trim(),
      body.siret               ?? null,
      body.adresse             ?? null,
      body.code_postal         ?? null,
      body.commune             ?? null,
      body.description_activite ?? null,
      body.telephone           ?? null,
      body.email               ?? null,
      body.site                ?? null,
      body.secteur             ?? null,
      body.source              ?? null,
      body.commercial_id       ?? null,
    ],
  )

  const [[created]] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM entreprise WHERE id = ?', [result.insertId],
  )

  res.status(201).json({ data: created })
}

// ─── PUT /api/companies/:id ───────────────────────────────────
export async function updateCompany(req: Request, res: Response) {
  const { id } = req.params
  const body: UpdateEntrepriseBody = req.body

  const allowed = [
    'raison_sociale','siret','adresse','code_postal','commune',
    'description_activite','telephone','email','site',
    'secteur','source','commercial_id','statut',
  ] as const

  const fields: string[] = []
  const params: unknown[] = []

  for (const key of allowed) {
    if (key in body) {
      fields.push(`${key} = ?`)
      params.push(body[key])
    }
  }

  if (fields.length === 0) {
    res.status(400).json({ error: 'Aucun champ à mettre à jour' })
    return
  }

  params.push(id)
  await pool.query(
    `UPDATE entreprise SET ${fields.join(', ')} WHERE id = ?`,
    params,
  )

  const [[updated]] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM entreprise WHERE id = ?', [id],
  )

  if (!updated) {
    res.status(404).json({ error: 'Entreprise introuvable' })
    return
  }

  res.json({ data: updated })
}

// ─── DELETE /api/companies/:id ────────────────────────────────
export async function deleteCompany(req: Request, res: Response) {
  await pool.query('DELETE FROM entreprise WHERE id = ?', [req.params.id])
  res.status(204).send()
}

// ─── GET /api/companies/:id/calls ────────────────────────────
export async function listCalls(req: Request, res: Response) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT cl.*, CONCAT(u.prenom, ' ', u.nom) AS commercial_nom
     FROM call_logs cl
     LEFT JOIN utilisateur u ON u.id = cl.commercial_id
     WHERE cl.entreprise_id = ?
     ORDER BY cl.called_at DESC`,
    [req.params.id],
  )
  res.json({ data: rows })
}

// ─── POST /api/companies/:id/calls ───────────────────────────
export async function createCall(req: Request, res: Response) {
  const { id } = req.params
  const body: CreateCallBody = req.body

  if (!body.result) {
    res.status(400).json({ error: 'Le champ "result" est obligatoire' })
    return
  }

  // 1. Enregistrer l'appel
  const [callResult] = await pool.query<ResultSetHeader>(
    'INSERT INTO call_logs (entreprise_id, result, notes, commercial_id) VALUES (?, ?, ?, ?)',
    [id, body.result, body.notes ?? null, body.commercial_id ?? null],
  )

  // 2. Mettre à jour le statut de l'entreprise
  await pool.query(
    'UPDATE entreprise SET statut = ? WHERE id = ?',
    [body.result, id],   // result et statut partagent les mêmes valeurs (ok/indécis/non)
  )

  const [[created]] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM call_logs WHERE id = ?', [callResult.insertId],
  )

  res.status(201).json({ data: created })
}

// ─── GET /api/companies/:id/relances ─────────────────────────
export async function listCompanyRelances(req: Request, res: Response) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT r.*, CONCAT(u.prenom, ' ', u.nom) AS commercial_nom
     FROM relances r
     LEFT JOIN utilisateur u ON u.id = r.commercial_id
     WHERE r.entreprise_id = ?
     ORDER BY FIELD(r.statut,'planifiée','faite','annulée'), r.scheduled_date`,
    [req.params.id],
  )
  res.json({ data: rows })
}

// ─── POST /api/companies/:id/relances ────────────────────────
export async function createRelance(req: Request, res: Response) {
  const { id } = req.params
  const body: CreateRelanceBody = req.body

  if (!body.scheduled_date) {
    res.status(400).json({ error: 'Le champ "scheduled_date" est obligatoire' })
    return
  }

  const [result] = await pool.query<ResultSetHeader>(
    'INSERT INTO relances (entreprise_id, scheduled_date, notes, commercial_id) VALUES (?, ?, ?, ?)',
    [id, body.scheduled_date, body.notes ?? null, body.commercial_id ?? null],
  )

  const [[created]] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM relances WHERE id = ?', [result.insertId],
  )

  res.status(201).json({ data: created })
}

// ─── GET /api/relances ────────────────────────────────────────
export async function listAllRelances(req: Request, res: Response) {
  const { commercial_id, statut } = req.query

  const conditions = ['r.statut = ?']
  const params: unknown[] = [statut ?? 'planifiee']

  if (commercial_id) { conditions.push('r.commercial_id = ?'); params.push(commercial_id) }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT r.*, e.raison_sociale, e.statut AS statut_entreprise, e.secteur, e.telephone,
            CONCAT(u.prenom, ' ', u.nom) AS commercial_nom
     FROM relances r
     JOIN entreprise e ON e.id = r.entreprise_id
     LEFT JOIN utilisateur u ON u.id = r.commercial_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY r.scheduled_date ASC`,
    params,
  )

  res.json({ data: rows as Relance[], total: rows.length })
}

// ─── PUT /api/relances/:id ────────────────────────────────────
export async function updateRelance(req: Request, res: Response) {
  const { id } = req.params
  const { statut, scheduled_date, notes } = req.body

  const fields: string[] = []
  const params: unknown[] = []

  if (statut)              { fields.push('statut = ?');         params.push(statut) }
  if (scheduled_date)      { fields.push('scheduled_date = ?'); params.push(scheduled_date) }
  if (notes !== undefined) { fields.push('notes = ?');          params.push(notes) }

  if (fields.length === 0) {
    res.status(400).json({ error: 'Aucun champ à mettre à jour' })
    return
  }

  params.push(id)
  await pool.query(`UPDATE relances SET ${fields.join(', ')} WHERE id = ?`, params)

  const [[updated]] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM relances WHERE id = ?', [id],
  )

  res.json({ data: updated })
}

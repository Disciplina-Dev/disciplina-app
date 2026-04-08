"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCompanies = listCompanies;
exports.getCompany = getCompany;
exports.createCompany = createCompany;
exports.updateCompany = updateCompany;
exports.deleteCompany = deleteCompany;
exports.listCalls = listCalls;
exports.createCall = createCall;
exports.listCompanyRelances = listCompanyRelances;
exports.createRelance = createRelance;
exports.listAllRelances = listAllRelances;
exports.updateRelance = updateRelance;
const db_1 = require("../config/db");
// ─── GET /api/companies ───────────────────────────────────────
async function listCompanies(req, res) {
    const { statut, commercial_id, search } = req.query;
    const conditions = [];
    const params = [];
    if (statut) {
        conditions.push('e.statut = ?');
        params.push(statut);
    }
    if (commercial_id) {
        conditions.push('e.commercial_id = ?');
        params.push(commercial_id);
    }
    if (search) {
        conditions.push('(e.raison_sociale LIKE ? OR e.siret LIKE ? OR e.secteur LIKE ?)');
        const q = `%${search}%`;
        params.push(q, q, q);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await db_1.pool.query(`SELECT
       e.*,
       CONCAT(u.prenom, ' ', u.nom) AS commercial_nom,
       (SELECT COUNT(*) FROM relances r
        WHERE r.entreprise_id = e.id AND r.statut = 'planifiée') AS relances_count
     FROM entreprise e
     LEFT JOIN utilisateur u ON u.id = e.commercial_id
     ${where}
     ORDER BY e.updated_at DESC`, params);
    res.json({ data: rows, total: rows.length });
}
// ─── GET /api/companies/:id ───────────────────────────────────
async function getCompany(req, res) {
    const { id } = req.params;
    const [[entreprise]] = await db_1.pool.query(`SELECT e.*, CONCAT(u.prenom, ' ', u.nom) AS commercial_nom
     FROM entreprise e
     LEFT JOIN utilisateur u ON u.id = e.commercial_id
     WHERE e.id = ?`, [id]);
    if (!entreprise) {
        res.status(404).json({ error: 'Entreprise introuvable' });
        return;
    }
    const [contacts] = await db_1.pool.query('SELECT * FROM contact_entreprise WHERE entreprise_id = ? ORDER BY type', [id]);
    const [calls] = await db_1.pool.query(`SELECT cl.*, CONCAT(u.prenom, ' ', u.nom) AS commercial_nom
     FROM call_logs cl
     LEFT JOIN utilisateur u ON u.id = cl.commercial_id
     WHERE cl.entreprise_id = ?
     ORDER BY cl.called_at DESC`, [id]);
    const [relances] = await db_1.pool.query(`SELECT r.*, CONCAT(u.prenom, ' ', u.nom) AS commercial_nom
     FROM relances r
     LEFT JOIN utilisateur u ON u.id = r.commercial_id
     WHERE r.entreprise_id = ?
     ORDER BY FIELD(r.statut,'planifiée','faite','annulée'), r.scheduled_date`, [id]);
    const result = {
        ...entreprise,
        contacts: contacts,
        calls: calls,
        relances: relances,
        last_call: calls.length > 0 ? calls[0] : null,
    };
    res.json({ data: result });
}
// ─── POST /api/companies ──────────────────────────────────────
async function createCompany(req, res) {
    const body = req.body;
    if (!body.raison_sociale?.trim()) {
        res.status(400).json({ error: 'Le champ "raison_sociale" est obligatoire' });
        return;
    }
    const [result] = await db_1.pool.query(`INSERT INTO entreprise
       (raison_sociale, siret, adresse, code_postal, commune,
        description_activite, telephone, email, site,
        secteur, source, commercial_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        body.raison_sociale.trim(),
        body.siret ?? null,
        body.adresse ?? null,
        body.code_postal ?? null,
        body.commune ?? null,
        body.description_activite ?? null,
        body.telephone ?? null,
        body.email ?? null,
        body.site ?? null,
        body.secteur ?? null,
        body.source ?? null,
        body.commercial_id ?? null,
    ]);
    const [[created]] = await db_1.pool.query('SELECT * FROM entreprise WHERE id = ?', [result.insertId]);
    res.status(201).json({ data: created });
}
// ─── PUT /api/companies/:id ───────────────────────────────────
async function updateCompany(req, res) {
    const { id } = req.params;
    const body = req.body;
    const allowed = [
        'raison_sociale', 'siret', 'adresse', 'code_postal', 'commune',
        'description_activite', 'telephone', 'email', 'site',
        'secteur', 'source', 'commercial_id', 'statut',
    ];
    const fields = [];
    const params = [];
    for (const key of allowed) {
        if (key in body) {
            fields.push(`${key} = ?`);
            params.push(body[key]);
        }
    }
    if (fields.length === 0) {
        res.status(400).json({ error: 'Aucun champ à mettre à jour' });
        return;
    }
    params.push(id);
    await db_1.pool.query(`UPDATE entreprise SET ${fields.join(', ')} WHERE id = ?`, params);
    const [[updated]] = await db_1.pool.query('SELECT * FROM entreprise WHERE id = ?', [id]);
    if (!updated) {
        res.status(404).json({ error: 'Entreprise introuvable' });
        return;
    }
    res.json({ data: updated });
}
// ─── DELETE /api/companies/:id ────────────────────────────────
async function deleteCompany(req, res) {
    await db_1.pool.query('DELETE FROM entreprise WHERE id = ?', [req.params.id]);
    res.status(204).send();
}
// ─── GET /api/companies/:id/calls ────────────────────────────
async function listCalls(req, res) {
    const [rows] = await db_1.pool.query(`SELECT cl.*, CONCAT(u.prenom, ' ', u.nom) AS commercial_nom
     FROM call_logs cl
     LEFT JOIN utilisateur u ON u.id = cl.commercial_id
     WHERE cl.entreprise_id = ?
     ORDER BY cl.called_at DESC`, [req.params.id]);
    res.json({ data: rows });
}
// ─── POST /api/companies/:id/calls ───────────────────────────
async function createCall(req, res) {
    const { id } = req.params;
    const body = req.body;
    if (!body.result) {
        res.status(400).json({ error: 'Le champ "result" est obligatoire' });
        return;
    }
    // 1. Enregistrer l'appel
    const [callResult] = await db_1.pool.query('INSERT INTO call_logs (entreprise_id, result, notes, commercial_id) VALUES (?, ?, ?, ?)', [id, body.result, body.notes ?? null, body.commercial_id ?? null]);
    // 2. Mettre à jour le statut de l'entreprise
    await db_1.pool.query('UPDATE entreprise SET statut = ? WHERE id = ?', [body.result, id]);
    const [[created]] = await db_1.pool.query('SELECT * FROM call_logs WHERE id = ?', [callResult.insertId]);
    res.status(201).json({ data: created });
}
// ─── GET /api/companies/:id/relances ─────────────────────────
async function listCompanyRelances(req, res) {
    const [rows] = await db_1.pool.query(`SELECT r.*, CONCAT(u.prenom, ' ', u.nom) AS commercial_nom
     FROM relances r
     LEFT JOIN utilisateur u ON u.id = r.commercial_id
     WHERE r.entreprise_id = ?
     ORDER BY FIELD(r.statut,'planifiée','faite','annulée'), r.scheduled_date`, [req.params.id]);
    res.json({ data: rows });
}
// ─── POST /api/companies/:id/relances ────────────────────────
async function createRelance(req, res) {
    const { id } = req.params;
    const body = req.body;
    if (!body.scheduled_date) {
        res.status(400).json({ error: 'Le champ "scheduled_date" est obligatoire' });
        return;
    }
    const [result] = await db_1.pool.query('INSERT INTO relances (entreprise_id, scheduled_date, notes, commercial_id) VALUES (?, ?, ?, ?)', [id, body.scheduled_date, body.notes ?? null, body.commercial_id ?? null]);
    const [[created]] = await db_1.pool.query('SELECT * FROM relances WHERE id = ?', [result.insertId]);
    res.status(201).json({ data: created });
}
// ─── GET /api/relances ────────────────────────────────────────
async function listAllRelances(req, res) {
    const { commercial_id, statut } = req.query;
    const conditions = ['r.statut = ?'];
    const params = [statut ?? 'planifiee'];
    if (commercial_id) {
        conditions.push('r.commercial_id = ?');
        params.push(commercial_id);
    }
    const [rows] = await db_1.pool.query(`SELECT r.*, e.raison_sociale, e.statut AS statut_entreprise, e.secteur, e.telephone,
            CONCAT(u.prenom, ' ', u.nom) AS commercial_nom
     FROM relances r
     JOIN entreprise e ON e.id = r.entreprise_id
     LEFT JOIN utilisateur u ON u.id = r.commercial_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY r.scheduled_date ASC`, params);
    res.json({ data: rows, total: rows.length });
}
// ─── PUT /api/relances/:id ────────────────────────────────────
async function updateRelance(req, res) {
    const { id } = req.params;
    const { statut, scheduled_date, notes } = req.body;
    const fields = [];
    const params = [];
    if (statut) {
        fields.push('statut = ?');
        params.push(statut);
    }
    if (scheduled_date) {
        fields.push('scheduled_date = ?');
        params.push(scheduled_date);
    }
    if (notes !== undefined) {
        fields.push('notes = ?');
        params.push(notes);
    }
    if (fields.length === 0) {
        res.status(400).json({ error: 'Aucun champ à mettre à jour' });
        return;
    }
    params.push(id);
    await db_1.pool.query(`UPDATE relances SET ${fields.join(', ')} WHERE id = ?`, params);
    const [[updated]] = await db_1.pool.query('SELECT * FROM relances WHERE id = ?', [id]);
    res.json({ data: updated });
}

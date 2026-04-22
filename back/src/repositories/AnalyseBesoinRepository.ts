import { query, getConnection } from '../db/connection';
import { AnalyseBesoinRow } from './interfaces';

export class AnalyseBesoinRepository {
  async create(data: Partial<AnalyseBesoinRow>): Promise<number> {
    const conn = await getConnection();
    try {
      const fields = Object.keys(data).join(', ');
      const placeholders = Object.keys(data).map(() => '?').join(', ');
      const values = Object.values(data);
      const result = await conn.execute(
        `INSERT INTO analyse_besoin (${fields}) VALUES (${placeholders})`,
        values
      );
      return (result[0] as any).insertId;
    } finally {
      conn.release();
    }
  }

  async findByToken(token: string): Promise<AnalyseBesoinRow | null> {
    const results = await query<AnalyseBesoinRow[]>(
      'SELECT * FROM analyse_besoin WHERE token = ?',
      [token]
    );
    return results.length > 0 ? results[0] : null;
  }

  async findByYousignId(yousignId: string): Promise<AnalyseBesoinRow | null> {
    const results = await query<AnalyseBesoinRow[]>(
      'SELECT * FROM analyse_besoin WHERE yousign_procedure_id = ?',
      [yousignId]
    );
    return results.length > 0 ? results[0] : null;
  }

  async findAll(filters: { statut?: string; campus?: string }): Promise<AnalyseBesoinRow[]> {
    let sql = 'SELECT * FROM analyse_besoin WHERE 1=1';
    const params: any[] = [];
    if (filters.statut) { sql += ' AND statut = ?'; params.push(filters.statut); }
    if (filters.campus) { sql += ' AND campus = ?'; params.push(filters.campus); }
    sql += ' ORDER BY created_at DESC';
    return query<AnalyseBesoinRow[]>(sql, params);
  }

  async updateByToken(token: string, data: Partial<AnalyseBesoinRow>): Promise<boolean> {
    const conn = await getConnection();
    try {
      const sets = Object.keys(data).map((k) => `${k} = ?`).join(', ');
      const values = [...Object.values(data), token];
      const result = await conn.execute(
        `UPDATE analyse_besoin SET ${sets} WHERE token = ?`,
        values
      );
      return (result[0] as any).affectedRows > 0;
    } finally {
      conn.release();
    }
  }

  async updateByYousignId(yousignId: string, data: Partial<AnalyseBesoinRow>): Promise<boolean> {
    const conn = await getConnection();
    try {
      const sets = Object.keys(data).map((k) => `${k} = ?`).join(', ');
      const values = [...Object.values(data), yousignId];
      const result = await conn.execute(
        `UPDATE analyse_besoin SET ${sets} WHERE yousign_procedure_id = ?`,
        values
      );
      return (result[0] as any).affectedRows > 0;
    } finally {
      conn.release();
    }
  }
}

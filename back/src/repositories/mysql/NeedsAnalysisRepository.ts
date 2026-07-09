import { query, getConnection } from '../../db/mysql/connection';
import { NeedsAnalysisRow } from '../../types/db-rows.types';

export class NeedsAnalysisRepository {
    async findAll(): Promise<NeedsAnalysisRow[]> {
        return query<NeedsAnalysisRow[]>('SELECT * FROM needs_analysis');
    }

    async findById(id: number): Promise<NeedsAnalysisRow | null> {
        const results = await query<NeedsAnalysisRow[]>('SELECT * FROM needs_analysis WHERE id = ?', [id]);
        return results.length > 0 ? results[0] : null;
    }

    async findByCompanyId(companyId: number): Promise<NeedsAnalysisRow[]> {
        return query<NeedsAnalysisRow[]>('SELECT * FROM needs_analysis WHERE company_id = ?', [companyId]);
    }

    async findByYousignId(yousignId: string): Promise<NeedsAnalysisRow | null> {
        const results = await query<NeedsAnalysisRow[]>(
            'SELECT * FROM needs_analysis WHERE yousign_signature_request_id = ?',
            [yousignId],
        );
        return results.length > 0 ? results[0] : null;
    }

    async create(data: Partial<NeedsAnalysisRow>): Promise<number> {
        const conn = await getConnection();
        try {
            const fields = Object.keys(data).join(', ');
            const placeholders = Object.keys(data)
                .map(() => '?')
                .join(', ');
            const values = Object.values(data);
            const result = await conn.execute(
                `INSERT INTO needs_analysis (${fields}) VALUES (${placeholders})`,
                values,
            );
            return (result[0] as any).insertId;
        } finally {
            conn.release();
        }
    }

    async update(id: number, data: Partial<NeedsAnalysisRow>): Promise<boolean> {
        const conn = await getConnection();
        try {
            // Filter out undefined values to only update provided fields
            const cleaned = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
            if (Object.keys(cleaned).length === 0) {
                return false;
            }
            const sets = Object.keys(cleaned)
                .map((key) => `${key} = ?`)
                .join(', ');
            const values = [...Object.values(cleaned), id];
            const result = await conn.execute(`UPDATE needs_analysis SET ${sets} WHERE id = ?`, values);
            return (result[0] as any).affectedRows > 0;
        } finally {
            conn.release();
        }
    }

    async delete(id: number): Promise<boolean> {
        const conn = await getConnection();
        try {
            const result = await conn.execute('DELETE FROM needs_analysis WHERE id = ?', [id]);
            return (result[0] as any).affectedRows > 0;
        } finally {
            conn.release();
        }
    }
}

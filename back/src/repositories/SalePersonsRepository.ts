import { query, getConnection } from '../db/connection';
import { SalePersonsRow } from './interfaces';

export class SalePersonsRepository {
  async findAll(): Promise<SalePersonsRow[]> {
    return query<SalePersonsRow[]>('SELECT * FROM sale_persons');
  }

  async findById(id: number): Promise<SalePersonsRow | null> {
    const results = await query<SalePersonsRow[]>(
      'SELECT * FROM sale_persons WHERE id = ?',
      [id]
    );
    return results.length > 0 ? results[0] : null;
  }

  async findByEmail(email: string): Promise<SalePersonsRow | null> {
    const results = await query<SalePersonsRow[]>(
      'SELECT * FROM sale_persons WHERE email = ?',
      [email]
    );
    return results.length > 0 ? results[0] : null;
  }
}

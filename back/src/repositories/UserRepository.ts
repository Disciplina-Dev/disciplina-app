import { query } from '../db/connection';
import { UserRow } from './interfaces';

export class UserRepository {
  async findByEmail(email: string): Promise<UserRow | null> {
    const result = await query<UserRow[]>('SELECT * FROM users WHERE email = ?', [email]);
    return result.length > 0 ? result[0] : null;
  }

  async findById(id: number): Promise<UserRow | null> {
    const result = await query<UserRow[]>('SELECT * FROM users WHERE id = ?', [id]);
    return result.length > 0 ? result[0] : null;
  }

  async create(user: Omit<UserRow, 'id'>): Promise<number> {
    const sectorsJson = user.sectors ? JSON.stringify(user.sectors) : null;
    const result = await query<any>(
      'INSERT INTO users (email, name, password, role, sectors, oauth_token, refresh_token) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [user.email, user.name, user.password, user.role, sectorsJson, user.oauth_token, user.refresh_token]
    );
    return result.insertId;
  }

  async updateTokens(id: number, oauthToken: string | null, refreshToken: string | null): Promise<void> {
    await query('UPDATE users SET oauth_token = ?, refresh_token = ? WHERE id = ?', [
      oauthToken,
      refreshToken,
      id
    ]);
  }
}

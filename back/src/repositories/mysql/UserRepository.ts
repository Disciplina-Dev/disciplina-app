import { query } from '../../db/mysql/connection';
import { UserRow } from '../../types/db-rows.types';
import { Role } from '../../types/user.types';

export class UserRepository {
    async findByEmail(email: string): Promise<UserRow | null> {
        const result = await query<UserRow[]>('SELECT * FROM users WHERE email = ?', [email]);
        return result.length > 0 ? result[0] : null;
    }

    async findById(id: number): Promise<UserRow | null> {
        const result = await query<UserRow[]>('SELECT * FROM users WHERE id = ?', [id]);
        return result.length > 0 ? result[0] : null;
    }

    async findByRole(role: Role): Promise<UserRow[] | null> {
        const result = await query<UserRow[]>('SELECT * FROM users WHERE role = ?', [role]);
        return result;
    }

    async findByRoles(roles: Role[]): Promise<UserRow[]> {
        if (roles.length === 0) return [];
        const placeholders = roles.map(() => '?').join(', ');
        return query<UserRow[]>(`SELECT * FROM users WHERE role IN (${placeholders})`, roles);
    }

    async create(user: Omit<UserRow, 'id'>): Promise<number> {
        const sectorsJson = user.sectors ? JSON.stringify(user.sectors) : null;
        const result = await query<any>(
            'INSERT INTO users (email, first_name, last_name, password, role, sectors, oauth_token, refresh_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
                user.email,
                user.first_name,
                user.last_name,
                user.password,
                user.role,
                sectorsJson,
                user.oauth_token,
                user.refresh_token,
            ],
        );
        return result.insertId;
    }

    async findAll(): Promise<UserRow[]> {
        return query<UserRow[]>('SELECT * FROM users ORDER BY role, first_name, last_name');
    }

    async updateSectors(id: number, sectors: string[]): Promise<void> {
        const sectorsJson = sectors.length > 0 ? JSON.stringify(sectors) : null;
        await query('UPDATE users SET sectors = ? WHERE id = ?', [sectorsJson, id]);
    }

    /**
     * Met à jour les colonnes éditables d'un user (whitelist stricte des champs).
     * Aucune suppression possible : pas de méthode delete exposée.
     */
    async updateProfile(
        id: number,
        fields: Partial<Pick<UserRow, 'email' | 'first_name' | 'last_name' | 'password' | 'role' | 'sectors'>>,
    ): Promise<void> {
        const allowed: (keyof UserRow)[] = ['email', 'first_name', 'last_name', 'password', 'role', 'sectors'];
        const entries = Object.entries(fields).filter(([k]) => allowed.includes(k as keyof UserRow));
        if (entries.length === 0) return;
        const sets = entries.map(([k]) => `${k} = ?`).join(', ');
        const values = entries.map(([, v]) => v);
        await query(`UPDATE users SET ${sets} WHERE id = ?`, [...values, id]);
    }

    async updateTokens(id: number, oauthToken: string | null, refreshToken: string | null): Promise<void> {
        await query('UPDATE users SET oauth_token = ?, refresh_token = ? WHERE id = ?', [oauthToken, refreshToken, id]);
    }
}

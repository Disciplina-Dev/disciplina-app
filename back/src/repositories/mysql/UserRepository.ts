import { query } from '../../db/mysql/connection';
import { UserRow, UserRowJoined } from '../../types/db-rows.types';

const USER_SELECT_COLUMNS = [
    'u.id',
    'u.email',
    'u.first_name',
    'u.last_name',
    'u.password',
    'u.role_id',
    'u.permission_id',
    'u.sectors',
    'u.oauth_token',
    'u.refresh_token',
    'u.is_interviewer',
    'u.is_deleted',
    'u.deleted_at',
];

const USER_JOIN = `
    r.name AS role_name,
    p.name AS permission_name
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    LEFT JOIN permissions p ON p.id = u.permission_id
`;

// Les users soft-deleted (markDeleted) sortent de tous les workflows :
// login, listes, directory, sélecteurs. Seul findByIdIncludingDeleted les voit.
const USER_ACTIVE = 'u.is_deleted = 0';

export class UserRepository {
    async findByEmail(email: string): Promise<UserRowJoined | null> {
        const result = await query<UserRowJoined[]>(
            `SELECT ${USER_SELECT_COLUMNS.join(', ')}, ${USER_JOIN} WHERE u.email = ? AND ${USER_ACTIVE}`,
            [email],
        );
        return result.length > 0 ? result[0] : null;
    }

    async findById(id: number): Promise<UserRowJoined | null> {
        const result = await query<UserRowJoined[]>(
            `SELECT ${USER_SELECT_COLUMNS.join(', ')}, ${USER_JOIN} WHERE u.id = ? AND ${USER_ACTIVE}`,
            [id],
        );
        return result.length > 0 ? result[0] : null;
    }

    async findByIdIncludingDeleted(id: number): Promise<UserRowJoined | null> {
        const result = await query<UserRowJoined[]>(
            `SELECT ${USER_SELECT_COLUMNS.join(', ')}, ${USER_JOIN} WHERE u.id = ?`,
            [id],
        );
        return result.length > 0 ? result[0] : null;
    }

    async findByRoleId(roleId: number): Promise<UserRowJoined[]> {
        return query<UserRowJoined[]>(
            `SELECT ${USER_SELECT_COLUMNS.join(', ')}, ${USER_JOIN} WHERE u.role_id = ? AND ${USER_ACTIVE}`,
            [roleId],
        );
    }

    async findByRoleIdAndPermissionId(roleId: number, permissionId: number): Promise<UserRowJoined[]> {
        return query<UserRowJoined[]>(
            `SELECT ${USER_SELECT_COLUMNS.join(
                ', ',
            )}, ${USER_JOIN} WHERE u.role_id = ? AND u.permission_id = ? AND ${USER_ACTIVE}`,
            [roleId, permissionId],
        );
    }

    async findByRoleIds(roleIds: number[]): Promise<UserRowJoined[]> {
        if (roleIds.length === 0) return [];
        const placeholders = roleIds.map(() => '?').join(', ');
        return query<UserRowJoined[]>(
            `SELECT ${USER_SELECT_COLUMNS.join(', ')}, ${USER_JOIN} WHERE u.role_id IN (${placeholders}) AND ${USER_ACTIVE}`,
            roleIds,
        );
    }

    async findByPermissionId(permissionId: number): Promise<UserRowJoined[]> {
        return query<UserRowJoined[]>(
            `SELECT ${USER_SELECT_COLUMNS.join(', ')}, ${USER_JOIN} WHERE u.permission_id = ? AND ${USER_ACTIVE}`,
            [permissionId],
        );
    }

    async findByPermissionIds(permissionIds: number[]): Promise<UserRowJoined[]> {
        if (permissionIds.length === 0) return [];
        const placeholders = permissionIds.map(() => '?').join(', ');
        return query<UserRowJoined[]>(
            `SELECT ${USER_SELECT_COLUMNS.join(
                ', ',
            )}, ${USER_JOIN} WHERE u.permission_id IN (${placeholders}) AND ${USER_ACTIVE}`,
            permissionIds,
        );
    }

    /** Users habilités à mener les entretiens AB (is_interviewer ou rôle RH). */
    async findInterviewers(): Promise<UserRowJoined[]> {
        return query<UserRowJoined[]>(
            `SELECT ${USER_SELECT_COLUMNS.join(
                ', ',
            )}, ${USER_JOIN} WHERE u.is_interviewer = 1 OR r.name = 'RH' ORDER BY u.first_name, u.last_name`,
        );
    }

    async create(user: Omit<UserRow, 'id'>): Promise<number> {
        const sectorsJson = user.sectors ? JSON.stringify(user.sectors) : null;
        const result = await query<any>(
            'INSERT INTO users (email, first_name, last_name, password, role_id, permission_id, sectors, oauth_token, refresh_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                user.email,
                user.first_name,
                user.last_name,
                user.password,
                user.role_id,
                user.permission_id,
                sectorsJson,
                user.oauth_token,
                user.refresh_token,
            ],
        );
        return result.insertId;
    }

    /** Lookup batché pour enrichir des lignes KPI avec les noms d'affichage. */
    async findByIds(ids: number[]): Promise<UserRowJoined[]> {
        if (ids.length === 0) return [];
        const placeholders = ids.map(() => '?').join(', ');
        return query<UserRowJoined[]>(
            `SELECT ${USER_SELECT_COLUMNS.join(', ')}, ${USER_JOIN} WHERE u.id IN (${placeholders}) AND ${USER_ACTIVE}`,
            ids,
        );
    }

    async findAll(): Promise<UserRowJoined[]> {
        return query<UserRowJoined[]>(
            `SELECT ${USER_SELECT_COLUMNS.join(', ')}, ${USER_JOIN} WHERE ${USER_ACTIVE} ORDER BY u.role_id, u.first_name, u.last_name`,
        );
    }

    /**
     * Soft delete : la ligne reste en base (les historiques FK continuent de
     * pointer dessus) mais le user sort de tous les workflows. Le mot de passe
     * est remplacé par une valeur aléatoire invalide et les tokens OAuth sont
     * purgés en défense supplémentaire.
     */
    async markDeleted(id: number, invalidatedPassword: string): Promise<boolean> {
        const result = await query<any>(
            'UPDATE users SET is_deleted = 1, deleted_at = NOW(), password = ?, oauth_token = NULL, refresh_token = NULL WHERE id = ? AND is_deleted = 0',
            [invalidatedPassword, id],
        );
        return result.affectedRows > 0;
    }

    /** Comptes ADMIN encore actifs (pour interdire la suppression du dernier admin). */
    async countActiveByPermissionId(permissionId: number): Promise<number> {
        const rows = await query<{ total: number }[]>(
            `SELECT COUNT(*) AS total FROM users u WHERE u.permission_id = ? AND ${USER_ACTIVE}`,
            [permissionId],
        );
        return rows[0].total;
    }

    async updateSectors(id: number, sectors: string[]): Promise<void> {
        const sectorsJson = sectors.length > 0 ? JSON.stringify(sectors) : null;
        await query('UPDATE users SET sectors = ? WHERE id = ?', [sectorsJson, id]);
    }

    /**
     * Met à jour les colonnes éditables d'un user (whitelist stricte des champs).
     * La suppression passe exclusivement par markDeleted (soft delete).
     */
    async updateProfile(
        id: number,
        fields: Partial<
            Pick<UserRow, 'email' | 'first_name' | 'last_name' | 'password' | 'role_id' | 'permission_id' | 'sectors'>
        >,
    ): Promise<void> {
        const allowed: (keyof UserRow)[] = [
            'email',
            'first_name',
            'last_name',
            'password',
            'role_id',
            'permission_id',
            'sectors',
        ];
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

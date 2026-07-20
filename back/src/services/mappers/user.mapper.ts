import { UserRow, UserRowJoined } from '../../types/db-rows.types';
import { User, JobRole, Permission, UserResponse, DirectoryEntry } from '../../types/user.types';

/**
 * Map des id → noms pour les rôles et permissions.
 * Utilisé par le mapper pour convertir les FK en énumérations.
 */
const ROLE_ID_TO_NAME: Record<number, JobRole> = {
    1: JobRole.COMMERCIAL,
    2: JobRole.RH,
    3: JobRole.PEDA,
    4: JobRole.AD,
    5: JobRole.GESTION,
};

const PERMISSION_ID_TO_NAME: Record<number, Permission> = {
    1: Permission.EMPLOYEE,
    2: Permission.RESPONSABLE,
    3: Permission.ADMIN,
};

function resolveRole(row: UserRowJoined): JobRole {
    if (row.role_name) return row.role_name as JobRole;
    return ROLE_ID_TO_NAME[row.role_id] ?? JobRole.COMMERCIAL;
}

function resolvePermission(row: UserRowJoined): Permission {
    if (row.permission_name) return row.permission_name as Permission;
    return PERMISSION_ID_TO_NAME[row.permission_id] ?? Permission.EMPLOYEE;
}

export function toUser(row: UserRowJoined): User {
    let parsedSectors: string[] | null = null;
    if (row.sectors) {
        try {
            parsedSectors =
                typeof row.sectors === 'string' ? JSON.parse(row.sectors) : (row.sectors as unknown as string[]);
        } catch {
            parsedSectors = [];
        }
    }
    return {
        id: row.id,
        email: row.email,
        firstName: row.first_name,
        lastName: row.last_name,
        password: row.password,
        role: resolveRole(row),
        permission: resolvePermission(row),
        sectors: parsedSectors,
        oauthToken: row.oauth_token,
        refreshToken: row.refresh_token,
    };
}

export function toUserResponse(user: User): UserResponse {
    return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        permission: user.permission,
        sectors: user.sectors,
        googleConnected: Boolean(user.oauthToken),
    };
}

// Annuaire d'affichage : le strict nécessaire pour résoudre un id en nom + rôle + permission.
// Volontairement sans email ni secteurs — tout le staff y a accès.
export function toDirectoryEntry(user: User): DirectoryEntry {
    return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        permission: user.permission,
    };
}

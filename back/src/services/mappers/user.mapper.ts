import { UserRow } from '../../types/db-rows.types';
import { User, Role, UserResponse } from '../../types/user.types';

export function toUser(row: UserRow): User {
    let parsedSectors: string[] | null = null;
    if (row.sectors) {
        try {
            parsedSectors = JSON.parse(row.sectors);
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
        role: row.role as Role,
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
        sectors: user.sectors,
        googleConnected: Boolean(user.oauthToken),
    };
}

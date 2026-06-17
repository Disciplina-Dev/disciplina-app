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
        name: row.name,
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
        name: user.name,
        role: user.role,
        sectors: user.sectors,
    };
}

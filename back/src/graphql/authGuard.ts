import { Role } from '../types/user.types';

export function authGuard(user: any, allowedRoles: Role[]): void {
    if (!user) {
        throw new Error('Unauthorized: No valid session found');
    }
    if (user.role === Role.ADMIN) {
        return;
    }
    if (!allowedRoles.includes(user.role)) {
        throw new Error('Forbidden: Insufficient permissions');
    }
}

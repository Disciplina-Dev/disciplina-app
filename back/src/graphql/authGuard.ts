import { Role } from '../services/interfaces';

export function authGuard(user: any, allowedRoles: Role[]): void {
  if (!user) {
    throw new Error('Unauthorized: No valid session found');
  }

  if (user.role === Role.ADMIN) {
    return; // ADMIN has access to everything
  }

  if (!allowedRoles.includes(user.role)) {
    throw new Error('Forbidden: Insufficient permissions');
  }
}

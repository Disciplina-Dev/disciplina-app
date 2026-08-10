import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { Permission } from '../../types/user.types';

/** Allows only the given roles. Must run after authenticate(). */
export function requireRoles(...roles: string[]) {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        const role = req.user?.role;
        if (!role || !roles.includes(role)) {
            res.status(403).json({ error: 'Forbidden: insufficient role' });
            return;
        }
        next();
    };
}

/**
 * Allows the given job roles OR any user with ADMIN/RESPONSABLE permission.
 * A RESPONSABLE (e.g. an HR responsable on the commercial dashboard) manages
 * cross-sector views regardless of its job role. Must run after authenticate().
 */
export function requireRolesOrManager(...roles: string[]) {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        const role = req.user?.role;
        const permission = req.user?.permission;
        if (
            permission === Permission.ADMIN ||
            permission === Permission.RESPONSABLE ||
            (role != null && roles.includes(role))
        ) {
            next();
            return;
        }
        res.status(403).json({ error: 'Forbidden: insufficient role' });
    };
}

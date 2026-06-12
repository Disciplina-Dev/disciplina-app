import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

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

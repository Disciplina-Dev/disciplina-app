import { Request, Response, NextFunction } from 'express';
import { JobRole } from '../../types/user.types';
import { ACCESS_TOKEN_COOKIE, verifyAccessToken } from './tokenAuth';
import { isCsrfValid, rejectCsrf } from './csrf';

export interface AuthRequest extends Request {
    user?: any;
}

const STAFF_ROLES: string[] = [JobRole.COMMERCIAL, JobRole.RH, JobRole.PEDA, JobRole.AD, JobRole.GESTION];
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
    const token = req.cookies?.[ACCESS_TOKEN_COOKIE];
    if (!token) {
        res.status(401).json({ error: 'Missing or invalid authentication cookie' });
        return;
    }
    const payload = verifyAccessToken(token);
    if (!payload) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
    }
    if (!payload.role || !STAFF_ROLES.includes(payload.role)) {
        res.status(403).json({ error: 'Forbidden: guest token' });
        return;
    }
    if (!SAFE_METHODS.has(req.method) && !isCsrfValid(req)) {
        rejectCsrf(res);
        return;
    }
    req.user = payload;
    next();
}

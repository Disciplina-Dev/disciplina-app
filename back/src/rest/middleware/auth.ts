import { Request, Response, NextFunction } from 'express';
import { JobRole } from '../../types/user.types';
import { ACCESS_TOKEN_COOKIE, verifyAccessToken } from './tokenAuth';
import { isCsrfValid, rejectCsrf } from './csrf';
import { env } from '../../config/env';
import { syncWithRegion } from '../../db/tenant';
import { isRegion } from '../../types/tenant';

export interface AuthRequest extends Request {
    user?: any;
}

const STAFF_ROLES: string[] = [JobRole.COMMERCIAL, JobRole.RH, JobRole.PEDA, JobRole.AD, JobRole.GESTION];
/**
 * Rôles hors staff autorisés sur un périmètre restreint (voir `authenticateAny`).
 * Un formateur est un contact externe : il ne doit jamais atteindre une route
 * gardée par `authenticate()` seule.
 */
const NON_STAFF_ROLES: string[] = [JobRole.FORMATEUR];
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function authenticateWith(allowedRoles: string[], req: AuthRequest, res: Response, next: NextFunction): void {
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
    if (!payload.role || !allowedRoles.includes(payload.role)) {
        res.status(403).json({ error: 'Forbidden: guest token' });
        return;
    }
    if (!SAFE_METHODS.has(req.method) && !isCsrfValid(req)) {
        rejectCsrf(res);
        return;
    }
    req.user = payload;
    syncWithRegion(isRegion(payload.region) ? payload.region : env.DB_DEFAULT_TENANT, () => next());
}

/** Routes du staff uniquement : un jeton formateur est refusé (403). */
export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
    authenticateWith(STAFF_ROLES, req, res, next);
}

/**
 * Routes partagées entre staff et formateurs : identité (`/me`, `/logout`) et
 * espace formateur. Le cloisonnement réel est fait par `requireRoles` en aval —
 * ici on ouvre juste la porte aux deux familles de comptes.
 */
export function authenticateAny(req: AuthRequest, res: Response, next: NextFunction): void {
    authenticateWith([...STAFF_ROLES, ...NON_STAFF_ROLES], req, res, next);
}

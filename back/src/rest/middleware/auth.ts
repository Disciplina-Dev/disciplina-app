import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { JobRole } from '../../types/user.types';

export interface AuthRequest extends Request {
    user?: any;
}

const STAFF_ROLES: string[] = [JobRole.COMMERCIAL, JobRole.RH, JobRole.PEDA, JobRole.AD, JobRole.GESTION];

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid authorization header' });
        return;
    }
    const token = header.split(' ')[1];
    try {
        const payload = jwt.verify(token, env.JWT_SECRET) as { role?: string };
        if (!payload.role || !STAFF_ROLES.includes(payload.role)) {
            res.status(403).json({ error: 'Forbidden: guest token' });
            return;
        }
        req.user = payload;
        next();
    } catch {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

export interface AuthRequest extends Request {
    user?: any;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid authorization header' });
        return;
    }
    const token = header.split(' ')[1];
    try {
        const payload = jwt.verify(token, env.JWT_SECRET) as { scope?: string };
        // Les jetons de scope `2fa` (login en attente de code) ne sont pas des sessions.
        if (payload.scope === '2fa') {
            res.status(401).json({ error: 'Invalid or expired token' });
            return;
        }
        req.user = payload;
        next();
    } catch {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}

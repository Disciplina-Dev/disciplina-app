import { Request, Response, NextFunction } from 'express';
import { verifyExternalToken, ExternalTokenPayload } from '../../services/externalToken';

export interface ExternalGuestRequest extends Request {
    guest?: ExternalTokenPayload;
}

export function requireExternalGuest(req: ExternalGuestRequest, res: Response, next: NextFunction): void {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid authorization header' });
        return;
    }
    const payload = verifyExternalToken(header.split(' ')[1]);
    if (!payload || payload.signature !== req.params.signature) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
    }
    req.guest = payload;
    next();
}

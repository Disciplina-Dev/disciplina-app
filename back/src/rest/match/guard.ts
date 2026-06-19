import { Request, Response, NextFunction } from 'express';
import { verifyMatchToken, MatchTokenPayload } from '../../services/matchToken';

export interface MatchGuestRequest extends Request {
    guest?: MatchTokenPayload;
}

export function requireMatchGuest(req: MatchGuestRequest, res: Response, next: NextFunction): void {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid authorization header' });
        return;
    }
    const payload = verifyMatchToken(header.split(' ')[1]);
    if (!payload || payload.signature !== req.params.signature) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
    }
    req.guest = payload;
    next();
}

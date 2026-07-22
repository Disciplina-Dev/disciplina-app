import { Request, Response, NextFunction } from 'express';
import { verifyExternalToken, ExternalTokenPayload } from '../../services/externalToken';
import { ExternalLinkService } from '../../services/ExternalLinkService';

export interface ExternalGuestRequest extends Request {
    guest?: ExternalTokenPayload;
}

const externalLinkService = new ExternalLinkService();

export async function requireExternalGuest(
    req: ExternalGuestRequest,
    res: Response,
    next: NextFunction,
): Promise<void> {
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
    const validation = await externalLinkService.validateLink(req.params.signature);
    if (!validation.valid) {
        res.status(401).json({ error: `Link is ${validation.reason}` });
        return;
    }
    req.guest = payload;
    next();
}

import { Request, Response, NextFunction } from 'express';
import { ACCESS_TOKEN_COOKIE, verifyAccessToken } from '../middleware/tokenAuth';
import { ExternalAccessRepository } from '../../repositories/mysql/ExternalAccessRepository';
import { GuestRole } from '../../types/user.types';

export interface ExternalGuestRequest extends Request {
    guest?: {
        signature?: string;
        referenceId?: number;
        externalUuid?: string;
    };
}

const externalAccessRepository = new ExternalAccessRepository();

export async function requireExternalGuest(
    req: ExternalGuestRequest,
    res: Response,
    next: NextFunction,
): Promise<void> {
    const token = req.cookies?.[ACCESS_TOKEN_COOKIE];
    if (!token) {
        res.status(401).json({ error: 'Missing or invalid authentication cookie' });
        return;
    }
    const payload = verifyAccessToken(token);
    if (!payload || payload.role !== GuestRole.EXTERNAL_GUEST) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
    }
    if (payload.signature !== req.params.signature) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
    }
    const row = await externalAccessRepository.findBySignature(req.params.signature);
    if (!row || row.status === 'LOCKED') {
        res.status(401).json({ error: 'Link is locked' });
        return;
    }
    req.guest = {
        signature: payload.signature,
        referenceId: payload.referenceId,
        externalUuid: row.external_id,
    };
    next();
}

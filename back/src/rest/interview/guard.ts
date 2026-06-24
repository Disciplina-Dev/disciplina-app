import { Request, Response, NextFunction } from 'express';
import { verifyInterviewToken, InterviewTokenPayload } from '../../services/interviewToken';

export interface InterviewGuestRequest extends Request {
    guest?: InterviewTokenPayload;
}

export function requireInterviewGuest(req: InterviewGuestRequest, res: Response, next: NextFunction): void {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid authorization header' });
        return;
    }
    const payload = verifyInterviewToken(header.split(' ')[1]);
    if (!payload || payload.signature !== req.params.signature) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
    }
    req.guest = payload;
    next();
}

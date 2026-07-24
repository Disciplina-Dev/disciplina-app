import { Response } from 'express';
import { JobRole } from '../../types/user.types';
import { AuthRequest } from './auth';
import { ACCESS_TOKEN_COOKIE, verifyAccessToken } from './tokenAuth';

const STAFF_ROLES: string[] = [JobRole.COMMERCIAL, JobRole.RH, JobRole.PEDA, JobRole.AD, JobRole.GESTION];

export interface StaffStreamPayload {
    id: number;
    email: string;
    role: string;
    permission: string;
}

// EventSource envoie les cookies automatiquement (avec withCredentials côté client) :
// plus besoin de faire transiter le token en query string.
export function authenticateStaffStream(req: AuthRequest, res: Response): StaffStreamPayload | null {
    const token = req.cookies?.[ACCESS_TOKEN_COOKIE];
    if (!token) {
        res.status(401).end();
        return null;
    }
    const payload = verifyAccessToken(token) as StaffStreamPayload | null;
    if (!payload) {
        res.status(401).end();
        return null;
    }
    if (!payload.role || !STAFF_ROLES.includes(payload.role)) {
        res.status(403).end();
        return null;
    }
    return payload;
}

import { Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { JobRole } from '../../types/user.types';
import { AuthRequest } from './auth';

const STAFF_ROLES: string[] = [JobRole.COMMERCIAL, JobRole.RH, JobRole.PEDA, JobRole.AD, JobRole.GESTION];

export interface StaffStreamPayload {
    id: number;
    email: string;
    role: string;
    permission: string;
}

// EventSource ne peut pas porter d'en-tête Authorization : le token transite en query.
export function authenticateStaffStream(req: AuthRequest, res: Response): StaffStreamPayload | null {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    if (!token) {
        res.status(401).end();
        return null;
    }
    try {
        const payload = jwt.verify(token, env.JWT_SECRET) as StaffStreamPayload;
        if (!payload.role || !STAFF_ROLES.includes(payload.role)) {
            res.status(403).end();
            return null;
        }
        return payload;
    } catch {
        res.status(401).end();
        return null;
    }
}

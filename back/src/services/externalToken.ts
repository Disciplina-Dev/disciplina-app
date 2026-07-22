import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { GuestRole } from '../types/user.types';

export interface ExternalTokenPayload {
    role: GuestRole.EXTERNAL_GUEST;
    signature: string;
    guestType: 'COMPANY' | 'CANDIDATE';
    externalUuid: string;
}

export function issueExternalToken(
    signature: string,
    guestType: 'COMPANY' | 'CANDIDATE',
    externalUuid: string,
    expiresInSeconds: number,
): string {
    const payload: ExternalTokenPayload = { role: GuestRole.EXTERNAL_GUEST, signature, guestType, externalUuid };
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: expiresInSeconds });
}

export function verifyExternalToken(token: string): ExternalTokenPayload | null {
    try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as ExternalTokenPayload;
        return decoded.role === GuestRole.EXTERNAL_GUEST ? decoded : null;
    } catch {
        return null;
    }
}

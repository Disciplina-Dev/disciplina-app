import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { Role } from '../types/user.types';

export interface MatchTokenPayload {
    role: Role.ENTREPRISE_GUEST;
    signature: string;
    offerId: string;
}

export function issueMatchToken(signature: string, offerId: string, expiresInSeconds: number): string {
    const payload: MatchTokenPayload = { role: Role.ENTREPRISE_GUEST, signature, offerId };
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: expiresInSeconds });
}

export function verifyMatchToken(token: string): MatchTokenPayload | null {
    try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as MatchTokenPayload;
        return decoded.role === Role.ENTREPRISE_GUEST ? decoded : null;
    } catch {
        return null;
    }
}

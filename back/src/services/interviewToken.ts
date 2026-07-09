import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { Role } from '../types/user.types';

export interface InterviewTokenPayload {
    role: Role.CANDIDATE_GUEST;
    signature: string;
    offerId: string;
    candidateId: string;
}

export function issueInterviewToken(
    signature: string,
    offerId: string,
    candidateId: string,
    expiresInSeconds: number,
): string {
    const payload: InterviewTokenPayload = { role: Role.CANDIDATE_GUEST, signature, offerId, candidateId };
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: expiresInSeconds });
}

export function verifyInterviewToken(token: string): InterviewTokenPayload | null {
    try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as InterviewTokenPayload;
        return decoded.role === Role.CANDIDATE_GUEST ? decoded : null;
    } catch {
        return null;
    }
}

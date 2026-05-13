import { createHmac } from 'crypto';
import { env } from '../config/env';

export function signRelanceUrl(id: string, answer: string): string {
    return createHmac('sha256', env.RELANCE_HMAC_SECRET).update(`${id}:${answer}`).digest('hex');
}

export function verifyRelanceUrl(id: string, answer: string, sig: string): boolean {
    const expected = signRelanceUrl(id, answer);
    return expected === sig;
}

export function signGoogleState(userId: number): string {
    const sig = createHmac('sha256', env.GOOGLE_STATE_SECRET).update(`google:state:${userId}`).digest('hex');
    return `${userId}:${sig}`;
}

export function verifyGoogleState(state: string): { userId: number } | null {
    const idx = state.indexOf(':');
    if (idx === -1) return null;
    const userId = parseInt(state.slice(0, idx), 10);
    const sig = state.slice(idx + 1);
    const expected = createHmac('sha256', env.GOOGLE_STATE_SECRET).update(`google:state:${userId}`).digest('hex');
    return sig === expected ? { userId } : null;
}

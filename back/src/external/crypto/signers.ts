import { hmac } from './hmac.service';
import { env } from '../../config/env';

export function signRelanceUrl(id: string, answer: string): string {
    return hmac.sign(env.RELANCE_HMAC_SECRET, `${id}:${answer}`);
}

export function verifyRelanceUrl(id: string, answer: string, sig: string): boolean {
    return hmac.verify(env.RELANCE_HMAC_SECRET, `${id}:${answer}`, sig);
}

export function signMatchUrl(jobId: string, candidateId: string, answer: string): string {
    return hmac.sign(env.RELANCE_HMAC_SECRET, `${jobId}:${candidateId}:${answer}`);
}

export function verifyMatchUrl(jobId: string, candidateId: string, answer: string, sig: string): boolean {
    return hmac.verify(env.RELANCE_HMAC_SECRET, `${jobId}:${candidateId}:${answer}`, sig);
}

export function signGoogleState(userId: number): string {
    const sig = hmac.sign(env.GOOGLE_STATE_SECRET, `google:state:${userId}`);
    return `${userId}:${sig}`;
}

export function verifyGoogleState(state: string): { userId: number } | null {
    const idx = state.indexOf(':');
    if (idx === -1) return null;
    const userId = parseInt(state.slice(0, idx), 10);
    const sig = state.slice(idx + 1);
    return hmac.verify(env.GOOGLE_STATE_SECRET, `google:state:${userId}`, sig) ? { userId } : null;
}

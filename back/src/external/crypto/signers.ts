import { hmac } from './hmac.service';
import { env } from '../../config/env';

// L'horodatage entre dans le message signé : il voyage en clair dans l'URL sans être falsifiable.
const SIGNED_URL_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface SignedUrl {
    sig: string;
    ts: number;
}

function isWithinTtl(ts: number): boolean {
    if (!Number.isFinite(ts)) return false;
    const age = Date.now() - ts;
    return age >= 0 && age <= SIGNED_URL_TTL_MS;
}

export function signRelanceUrl(id: string, answer: string): SignedUrl {
    const ts = Date.now();
    return { sig: hmac.sign(env.RELANCE_HMAC_SECRET, `${id}:${answer}:${ts}`), ts };
}

export function verifyRelanceUrl(id: string, answer: string, sig: string, ts: number): boolean {
    if (!isWithinTtl(ts)) return false;
    return hmac.verify(env.RELANCE_HMAC_SECRET, `${id}:${answer}:${ts}`, sig);
}

export function signMatchUrl(offerId: string, candidateId: string, answer: string): SignedUrl {
    const ts = Date.now();
    return { sig: hmac.sign(env.RELANCE_HMAC_SECRET, `${offerId}:${candidateId}:${answer}:${ts}`), ts };
}

export function verifyMatchUrl(offerId: string, candidateId: string, answer: string, sig: string, ts: number): boolean {
    if (!isWithinTtl(ts)) return false;
    return hmac.verify(env.RELANCE_HMAC_SECRET, `${offerId}:${candidateId}:${answer}:${ts}`, sig);
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

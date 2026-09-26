import { hmac } from './hmac.service';
import { env } from '../../config/env';
import { isRegion, type Region } from '../../types/tenant';

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

export function signGoogleState(userId: number, region: Region): string {
    const sig = hmac.sign(env.GOOGLE_STATE_SECRET, `google:state:${userId}:${region}`);
    return `${userId}:${region}:${sig}`;
}

export function verifyGoogleState(state: string): { userId: number; region: Region } | null {
    const first = state.indexOf(':');
    if (first === -1) return null;
    const userId = parseInt(state.slice(0, first), 10);
    const second = state.indexOf(':', first + 1);
    // État legacy `${userId}:${sig}` (avant l'ajout de la région) → tenant par défaut.
    if (second === -1) {
        const legacySig = state.slice(first + 1);
        if (!hmac.verify(env.GOOGLE_STATE_SECRET, `google:state:${userId}`, legacySig)) return null;
        return { userId, region: env.DB_DEFAULT_TENANT };
    }
    const region = state.slice(first + 1, second);
    const sig = state.slice(second + 1);
    if (!isRegion(region)) return null;
    if (!hmac.verify(env.GOOGLE_STATE_SECRET, `google:state:${userId}:${region}`, sig)) return null;
    return { userId, region };
}

import { hmac } from '../external/crypto';
import { appendRegion, getRegion } from '../db/tenant';
import type { Region } from '../types/tenant';

export type SeanceTokenKind = 'formateur' | 'qr';

interface SeanceTokenSource {
    _id: string;
    token_secret: string;
}

/**
 * Jeton de capability dérivé du secret de la séance : `<seanceId>.<hmac>:<region>`.
 *
 * Aucun jeton brut n'est stocké — le secret par séance suffit à les recalculer
 * (le Peda peut réafficher le QR à tout moment) et le suffixe `:<region>` route
 * la requête publique vers la bonne base (`resolveExternalRegion`).
 */
export function buildSeanceToken(seance: SeanceTokenSource, kind: SeanceTokenKind, region?: Region): string {
    const signature = hmac.sign(seance.token_secret, kind);
    return appendRegion(`${seance._id}.${signature}`, region ?? getRegion());
}

export function parseSeanceToken(token: string): { seanceId: string; signature: string } | null {
    const body = token.includes(':') ? token.slice(0, token.lastIndexOf(':')) : token;
    const separator = body.lastIndexOf('.');
    if (separator <= 0 || separator === body.length - 1) return null;
    return { seanceId: body.slice(0, separator), signature: body.slice(separator + 1) };
}

export function verifySeanceToken(token: string, seance: SeanceTokenSource, kind: SeanceTokenKind): boolean {
    const parsed = parseSeanceToken(token);
    if (!parsed || parsed.seanceId !== seance._id) return false;
    return hmac.verify(seance.token_secret, kind, parsed.signature);
}

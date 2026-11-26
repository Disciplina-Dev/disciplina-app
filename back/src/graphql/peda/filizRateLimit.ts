import { getRegion } from '../../db/tenant';

/**
 * Plafond des mutations péda qui appellent l'API Filiz. Fenêtre glissante en mémoire (un seul process),
 * comme les middlewares express-rate-limit : le GraphQL péda passe par un unique endpoint HTTP, donc on
 * ne peut pas limiter par mutation en amont.
 */
interface Limit {
    max: number;
    windowMs: number;
}

const hits = new Map<string, number[]>();

export const FILIZ_SYNC_LIMIT: Limit = { max: 1, windowMs: 60 * 1000 };
export const FILIZ_CREATE_LIMIT: Limit = { max: 5, windowMs: 60 * 1000 };

/**
 * Enregistre un appel et lève une erreur si le plafond est atteint. La clé inclut la région :
 * chaque tenant a son propre compte Filiz.
 */
export function consumeFilizQuota(scope: string, limit: Limit, subject: string | number = 'all'): void {
    const key = `${getRegion()}:${scope}:${subject}`;
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < limit.windowMs);
    if (recent.length >= limit.max) {
        const retryIn = Math.ceil((limit.windowMs - (now - recent[0])) / 1000);
        hits.set(key, recent);
        throw new Error(`Trop de requêtes vers Filiz, réessayez dans ${retryIn} s.`);
    }
    recent.push(now);
    hits.set(key, recent);
}

/** Vide les compteurs (tests). */
export function resetFilizQuotas(): void {
    hits.clear();
}

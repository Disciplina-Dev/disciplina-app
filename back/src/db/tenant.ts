import { AsyncLocalStorage } from 'node:async_hooks';
import { env } from '../config/env';
import { isRegion, type Region } from '../types/tenant';

const regionStorage = new AsyncLocalStorage<Region>();

export function withRegion<T>(region: Region, fn: () => Promise<T>): Promise<T> {
    return regionStorage.run(region, fn);
}

export function syncWithRegion<T>(region: Region, fn: () => T): T {
    return regionStorage.run(region, fn);
}

export function getRegion(): Region {
    return regionStorage.getStore() ?? env.DB_DEFAULT_TENANT;
}

/**
 * Suffixe une signature de lien externe avec la région courante (`<sig>:<region>`)
 * pour retrouver la bonne connexion (MySQL/Mongo) lors du parcours guest, qui
 * ne porte pas de JWT. Rétro-compatible : les signatures sans suffixe restent
 * rattachées au tenant par défaut (parsing fait ultérieurement).
 */
export function appendRegion(signature: string, region: Region = getRegion()): string {
    return `${signature}:${region}`;
}

/**
 * Région portée par une signature suffixée (`<sig>:<region>`). Sans suffixe ou
 * suffixe invalide → tenant par défaut (rétro-compatibilité des liens existants).
 */
export function regionFromExternalSignature(signature: string): Region {
    const idx = signature.lastIndexOf(':');
    if (idx === -1) return env.DB_DEFAULT_TENANT;
    const candidate = signature.slice(idx + 1);
    return isRegion(candidate) ? candidate : env.DB_DEFAULT_TENANT;
}
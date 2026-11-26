import { getRegion } from '../db/tenant';
import type { Region } from '../types/tenant';

/**
 * Fuseau horaire IANA par tenant — source de vérité unique. Les fuseaux étaient
 * écrits en dur dans le code (`Indian/Reunion` côté backend, `Europe/Paris` par
 * défaut YouSign), ce qui décalait de 2-3 h tous les horaires du tenant
 * annemasse. Voir AUDIT_MULTITENANT.md (lot 1).
 */
export const TENANT_TIMEZONE: Record<Region, string> = {
    reunion: 'Indian/Reunion',
    annemasse: 'Europe/Paris',
};

/** Fuseau IANA du tenant courant, résolu via l'ALS de `db/tenant`. */
export function tenantTimezone(region: Region = getRegion()): string {
    return TENANT_TIMEZONE[region];
}

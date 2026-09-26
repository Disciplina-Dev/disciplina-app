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

/** Indicatif téléphonique international par tenant (payload Filiz, normalisation des numéros). */
export const TENANT_DIAL_CODE: Record<Region, string> = {
    reunion: '262',
    annemasse: '33',
};

/**
 * Département de naissance par défaut d'un candidat sans valeur saisie. Réunion conserve
 * l'historique `97400` ; annemasse : Haute-Savoie. Un défaut reste une hypothèse : la
 * saisie explicite prime toujours.
 */
export const TENANT_DEFAULT_BIRTH_DEPARTMENT: Record<Region, string> = {
    reunion: '97400',
    annemasse: '74',
};

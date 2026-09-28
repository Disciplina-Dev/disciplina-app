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

/**
 * Lieux de RDV par secteur (`sector_settings`), par tenant. Les 3 clés de
 * secteur (`Nord-Est`/`Ouest`/`Sud`) sont un référentiel fermé (voir
 * `GEO-09`/`GEO-10`, AUDIT_MULTITENANT.md) : seul le libellé affiché change
 * par tenant, pas les clés.
 */
export const TENANT_SECTOR_LOCATIONS: Record<Region, { sector: string; location: string }[]> = {
    reunion: [
        { sector: 'Nord-Est', location: 'Disciplina Nord-Est — Sainte-Marie' },
        { sector: 'Ouest', location: 'Disciplina Ouest — Saint-Paul' },
        { sector: 'Sud', location: 'Disciplina Sud — Saint-Pierre' },
    ],
    annemasse: [
        { sector: 'Nord-Est', location: 'Disciplina Annemasse — Annemasse' },
        { sector: 'Ouest', location: 'Disciplina Annemasse — Ambilly' },
        { sector: 'Sud', location: 'Disciplina Annemasse — Ville-la-Grand' },
    ],
};

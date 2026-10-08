import { DriveRegion } from '../services/DriveFolderConfigService';
import { CompanyRegion } from '../types/needsAnalysisNoSql.types';
import { Permission } from '../types/user.types';
import { getRegion } from '../db/tenant';

/**
 * Secteurs géographiques Disciplina. Valeurs canoniques côté métier
 * (entreprises, users). À ne pas confondre avec les secteurs *fonctionnels*
 * d'un candidat (mobilité, formation, métiers visés) qui sont indépendants.
 */
export const SECTORS = ['Nord-Est', 'Ouest', 'Sud'] as const;
export type Sector = (typeof SECTORS)[number];

/**
 * Secteurs entreprise du tenant Annemasse (Haute-Savoie) : les 6 secteurs
 * opérationnels du référentiel communes (cf. ZONE_TO_COMMUNES dans
 * services/mappers/abToOffer.ts). Vocabulaire **entreprise et mobilité
 * candidats uniquement** : utilisateurs, dashboards, Drive et notifications
 * partagent le secteur unique `ANNEMASSE_SECTOR` sur ce tenant.
 */
export const ANNEMASSE_COMPANY_SECTORS = [
    'Genève / Frontière',
    'Saint-Julien / Genevois',
    'Arve',
    'Faucigny / La Roche',
    'Annecy',
    'Chablais',
] as const;
export type AnnemasseCompanySector = (typeof ANNEMASSE_COMPANY_SECTORS)[number];

/** Secteur entreprise par défaut du tenant Annemasse (Annemasse y est rattachée). */
export const DEFAULT_ANNEMASSE_COMPANY_SECTOR: AnnemasseCompanySector = 'Genève / Frontière';

/**
 * Secteur Drive unique du tenant Annemasse : un seul dossier par couple
 * TP (candidats) ou par type (AB signée / non signée), pas un par secteur
 * opérationnel. C'est aussi le secteur utilisateur, dashboard et notifications
 * unique du tenant : Annemasse est mono-secteur, les 6 secteurs restent le
 * vocabulaire entreprise (companies.sector) et candidats (mobilité).
 */
export const ANNEMASSE_SECTOR = 'Annemasse';

/** Alias historique (Drive) du secteur unique Annemasse. */
export const ANNEMASSE_DRIVE_SECTOR = ANNEMASSE_SECTOR;

/** Secteurs Drive AB proposés selon le tenant (region null → Réunion par défaut). */
export function abDriveSectorsForTenant(region?: string | null): string[] {
    return region === 'annemasse' ? [ANNEMASSE_SECTOR] : [...SECTORS];
}

/** Secteurs utilisateurs proposés selon le tenant (region null → Réunion par défaut). */
export function userSectorsForTenant(region?: string | null): string[] {
    return region === 'annemasse' ? [ANNEMASSE_SECTOR] : [...SECTORS];
}

// Un secteur métier ↔ une région de dossiers Drive (NORD/OUEST/SUD).
const SECTOR_TO_REGION: Record<Sector, DriveRegion> = {
    'Nord-Est': 'NORD',
    Ouest: 'OUEST',
    Sud: 'SUD',
};

export function isSector(value: unknown, region?: string | null): value is Sector {
    if (typeof value !== 'string') return false;
    if ((SECTORS as readonly string[]).includes(value)) return true;
    // Tenant Annemasse : secteur unique + valeurs historiques (transition).
    // Hors tenant Annemasse, ces valeurs restent invalides.
    const tenant = region ?? getRegion();
    return (
        tenant === 'annemasse' &&
        (value === ANNEMASSE_SECTOR || (ANNEMASSE_COMPANY_SECTORS as readonly string[]).includes(value))
    );
}

/** Ne garde que les secteurs valides d'une liste libre (défense en profondeur). */
export function sanitizeSectors(sectors?: unknown, region?: string | null): string[] {
    if (!Array.isArray(sectors)) return [];
    const tenant = region ?? getRegion();
    return sectors.filter((s) => isSector(s, tenant)).map(String);
}

/**
 * Secteur principal d'un user : sur Annemasse (mono-secteur), tout user doté
 * d'un secteur connu remonte `ANNEMASSE_SECTOR` (snapshots owner, KPI) ;
 * sinon premier secteur valide assigné, sinon undefined.
 */
export function primarySector(sectors?: string[] | null, region?: string | null): string | undefined {
    const tenant = region ?? getRegion();
    if (tenant === 'annemasse') return sanitizeSectors(sectors, tenant).length > 0 ? ANNEMASSE_SECTOR : undefined;
    return sectors?.find((s) => isSector(s, tenant));
}

/**
 * Valeurs acceptées pour le champ `sector` d'une entreprise (MySQL) :
 * vocabulaire Réunion + 6 secteurs Annemasse. Le filtrage acceptereste
 * global (pas par tenant) : les bases sont étanches par tenant, et un filtre
 * par région rejetterait des lignes légitimes au lieu de les classer.
 */
const COMPANY_SECTORS = new Set<string>([...SECTORS, ...ANNEMASSE_COMPANY_SECTORS]);

/** Vrai si la valeur est un secteur entreprise connu (tous tenants). */
export function isCompanySector(value: unknown): boolean {
    return typeof value === 'string' && COMPANY_SECTORS.has(value);
}

/** Ne garde que les secteurs entreprise valides d'une liste libre. */
export function sanitizeCompanySectors(sectors?: unknown): string[] {
    if (Array.isArray(sectors)) return sectors.filter(isCompanySector).map(String);
    if (typeof sectors === 'string') return sectors.split(',').map((s) => s.trim()).filter(isCompanySector);
    return [];
}

/** Région Drive déduite d'un secteur métier (Réunion ou Annemasse). */
export function regionFromSector(sector?: string | null): DriveRegion | undefined {
    if (isSector(sector, 'reunion')) return SECTOR_TO_REGION[sector as Sector];
    // Secteur unique et 6 secteurs Annemasse → l'unique région Drive du tenant.
    if (
        typeof sector === 'string' &&
        (sector === ANNEMASSE_SECTOR || (ANNEMASSE_COMPANY_SECTORS as readonly string[]).includes(sector))
    )
        return 'ANNEMASSE';
    return undefined;
}

// Région de l'AB (NORD/OUEST/SUD) → secteur métier (Nord-Est/Ouest/Sud).
const REGION_TO_SECTOR: Partial<Record<CompanyRegion, Sector>> = {
    [CompanyRegion.NORD]: 'Nord-Est',
    [CompanyRegion.OUEST]: 'Ouest',
    [CompanyRegion.SUD]: 'Sud',
};

/** Secteur métier d'une AB, déduit de la région de l'entreprise. */
export function sectorFromRegion(region?: CompanyRegion | null): Sector | undefined {
    return region ? REGION_TO_SECTOR[region] : undefined;
}

/**
 * Vrai si les deux listes de secteurs ont au moins un secteur en commun.
 * Sur Annemasse (mono-secteur), deux users dotés d'un secteur connu
 * partagent toujours le secteur unique (tolérance legacy incluse).
 */
export function shareSector(a?: string[] | null, b?: string[] | null, region?: string | null): boolean {
    const tenant = region ?? getRegion();
    if (tenant === 'annemasse')
        return sanitizeSectors(a, tenant).length > 0 && sanitizeSectors(b, tenant).length > 0;
    const sectorsB = new Set(sanitizeSectors(b, tenant));
    return sanitizeSectors(a, tenant).some((sector) => sectorsB.has(sector));
}

/**
 * ADMIN/RESPONSABLE ont un accès multi-secteurs (tous les secteurs visibles) ;
 * les autres niveaux (EMPLOYEE) sont restreints à leurs propres secteurs.
 */
export function canAccessAllSectors(permission?: string | null): boolean {
    return permission === Permission.ADMIN || permission === Permission.RESPONSABLE;
}

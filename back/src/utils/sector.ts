import { DriveRegion } from '../services/DriveFolderConfigService';
import { CompanyRegion } from '../types/needsAnalysisNoSql.types';
import { Permission } from '../types/user.types';

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
 * services/mappers/abToOffer.ts). Vocabulaire **entreprise uniquement** :
 * les secteurs *utilisateurs* (agenda, notifications AB, KPI) restent
 * volontairement sur `SECTORS` pour les deux tenants.
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

// Un secteur métier ↔ une région de dossiers Drive (NORD/OUEST/SUD).
const SECTOR_TO_REGION: Record<Sector, DriveRegion> = {
    'Nord-Est': 'NORD',
    Ouest: 'OUEST',
    Sud: 'SUD',
};

export function isSector(value: unknown): value is Sector {
    return typeof value === 'string' && (SECTORS as readonly string[]).includes(value);
}

/** Ne garde que les secteurs valides d'une liste libre (défense en profondeur). */
export function sanitizeSectors(sectors?: unknown): Sector[] {
    if (!Array.isArray(sectors)) return [];
    return sectors.filter(isSector);
}

/** Secteur principal d'un user : premier secteur valide assigné, sinon undefined. */
export function primarySector(sectors?: string[] | null): Sector | undefined {
    return sectors?.find(isSector);
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

/** Région Drive déduite d'un secteur métier. */
export function regionFromSector(sector?: string | null): DriveRegion | undefined {
    return isSector(sector) ? SECTOR_TO_REGION[sector] : undefined;
}

// Région de l'AB (NORD/OUEST/SUD) → secteur métier (Nord-Est/Ouest/Sud).
const REGION_TO_SECTOR: Record<CompanyRegion, Sector> = {
    [CompanyRegion.NORD]: 'Nord-Est',
    [CompanyRegion.OUEST]: 'Ouest',
    [CompanyRegion.SUD]: 'Sud',
};

/** Secteur métier d'une AB, déduit de la région de l'entreprise. */
export function sectorFromRegion(region?: CompanyRegion | null): Sector | undefined {
    return region ? REGION_TO_SECTOR[region] : undefined;
}

/** Vrai si les deux listes de secteurs ont au moins un secteur en commun. */
export function shareSector(a?: string[] | null, b?: string[] | null): boolean {
    const sectorsB = new Set(sanitizeSectors(b));
    return sanitizeSectors(a).some((sector) => sectorsB.has(sector));
}

/**
 * ADMIN/RESPONSABLE ont un accès multi-secteurs (tous les secteurs visibles) ;
 * les autres niveaux (EMPLOYEE) sont restreints à leurs propres secteurs.
 */
export function canAccessAllSectors(permission?: string | null): boolean {
    return permission === Permission.ADMIN || permission === Permission.RESPONSABLE;
}

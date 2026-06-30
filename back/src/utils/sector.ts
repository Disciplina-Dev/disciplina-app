import { DriveRegion } from '../services/DriveFolderConfigService';

/**
 * Secteurs géographiques Disciplina. Valeurs canoniques côté métier
 * (entreprises, users). À ne pas confondre avec les secteurs *fonctionnels*
 * d'un candidat (mobilité, formation, métiers visés) qui sont indépendants.
 */
export const SECTORS = ['Nord-Est', 'Ouest', 'Sud'] as const;
export type Sector = (typeof SECTORS)[number];

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

/** Région Drive déduite d'un secteur métier. */
export function regionFromSector(sector?: string | null): DriveRegion | undefined {
    return isSector(sector) ? SECTOR_TO_REGION[sector] : undefined;
}

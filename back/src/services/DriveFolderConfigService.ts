import { env } from '../config/env';
import { getRegion } from '../db/tenant';
import { TitleProfessionalType, TrainingSite } from '../types/candidate.types';
import {
    DriveFolderConfig,
    DriveFolderConfigRepository,
} from '../repositories/mongo/DriveFolderConfigRepository';

// Régions disponibles (un dossier Drive par couple TP × Région).
// Réunion : NORD/OUEST/SUD. Annemasse : une seule région « ANNEMASSE ».
export const DRIVE_REGIONS = ['NORD', 'OUEST', 'SUD'] as const;
export const ANNEMASSE_DRIVE_REGION = 'ANNEMASSE' as const;
export const ALL_DRIVE_REGIONS = [...DRIVE_REGIONS, ANNEMASSE_DRIVE_REGION] as const;
export type DriveRegion = (typeof ALL_DRIVE_REGIONS)[number];

/** Régions Drive proposées selon le tenant (region null → Réunion par défaut). */
export function driveRegionsForTenant(region?: string | null): DriveRegion[] {
    const tenant = region ?? getRegion();
    return tenant === 'annemasse' ? [ANNEMASSE_DRIVE_REGION] : [...DRIVE_REGIONS];
}

// Le site de formation du candidat détermine sa région.
const SITE_TO_REGION: Record<TrainingSite, DriveRegion> = {
    [TrainingSite.NORD_SAINTE_MARIE]: 'NORD',
    [TrainingSite.OUEST_SAINT_PAUL]: 'OUEST',
    [TrainingSite.SUD_SAINT_PIERRE]: 'SUD',
};

/** Clé de stockage d'un dossier dans tpFolders : `${TP}_${REGION}` (ex: AD_NORD). */
export function driveFolderKey(tp: string, region: string): string {
    return `${tp}_${region}`;
}

// Fallback .env : utilisé tant que rien n'est configuré en base (rétro-compat).
const ENV_TP_FOLDER_IDS: Record<TitleProfessionalType, string | undefined> = {
    [TitleProfessionalType.AD]: env.DRIVE_CANDIDATS_NORD_AD_FOLDER_ID,
    [TitleProfessionalType.CC]: env.DRIVE_CANDIDATS_NORD_CC_FOLDER_ID,
    [TitleProfessionalType.NTC]: env.DRIVE_CANDIDATS_NORD_NTC_FOLDER_ID,
    [TitleProfessionalType.REM]: env.DRIVE_CANDIDATS_NORD_REM_FOLDER_ID,
    [TitleProfessionalType.SA]: env.DRIVE_CANDIDATS_NORD_SA_FOLDER_ID,
};

export class DriveFolderConfigService {
    private repo = new DriveFolderConfigRepository();

    async getConfig(): Promise<DriveFolderConfig> {
        return this.repo.get();
    }

    async updateConfig(input: DriveFolderConfig): Promise<DriveFolderConfig> {
        // Nettoie les valeurs vides pour ne pas stocker de chaînes blanches.
        const tpFolders: Record<string, string> = {};
        for (const [k, v] of Object.entries(input.tpFolders ?? {})) {
            const trimmed = (v ?? '').trim();
            if (trimmed) tpFolders[k] = trimmed;
        }
        const rootFolderId = (input.rootFolderId ?? '').trim() || null;
        return this.repo.save({ rootFolderId, tpFolders });
    }

    /**
     * Dossier Drive parent où créer le dossier d'un candidat, selon son TP et sa région.
     * La région provient en priorité du secteur du créateur (`region`), sinon du site
     * de formation. Priorité de résolution : config en base (TP × région → racine) puis fallback .env.
     */
    async resolveParentForTp(
        tp?: TitleProfessionalType | string,
        trainingSite?: TrainingSite | string,
        region?: DriveRegion,
    ): Promise<string | undefined> {
        const config = await this.repo.get();
        // Secteur du créateur > région du site de formation > défaut du tenant
        // (NORD pour Réunion, ANNEMASSE pour Annemasse).
        const tenantDefault: DriveRegion = getRegion() === 'annemasse' ? ANNEMASSE_DRIVE_REGION : 'NORD';
        const resolvedRegion: DriveRegion =
            region ?? (trainingSite ? SITE_TO_REGION[trainingSite as TrainingSite] : undefined) ?? tenantDefault;

        if (tp && resolvedRegion) {
            const id = config.tpFolders[driveFolderKey(tp, resolvedRegion)];
            if (id) return id;
        }
        if (config.rootFolderId) return config.rootFolderId;

        const envTp = tp ? ENV_TP_FOLDER_IDS[tp as TitleProfessionalType] : undefined;
        return envTp || env.DRIVE_CANDIDATS_NORD_FOLDER_ID;
    }
}

export const driveFolderConfigService = new DriveFolderConfigService();

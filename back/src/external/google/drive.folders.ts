import { TitleProfessionalType, TrainingSite } from '../../types/candidate.types';
import { DriveRegion, driveFolderConfigService } from '../../services/DriveFolderConfigService';

/**
 * Dossier Drive parent où créer le dossier d'un candidat, selon son TP et sa région.
 * La région provient en priorité du secteur du créateur (`region`) — ex: RH Nord →
 * dossier Nord —, sinon du site de formation. La config est éditable depuis l'UI
 * (stockée en base) ; le .env sert uniquement de fallback. Voir DriveFolderConfigService.
 */
export async function driveParentFolderForTp(
    tp?: TitleProfessionalType | string,
    trainingSite?: TrainingSite | string,
    region?: DriveRegion,
): Promise<string | undefined> {
    return driveFolderConfigService.resolveParentForTp(tp, trainingSite, region);
}

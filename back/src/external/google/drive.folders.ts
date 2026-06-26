import { TitleProfessionalType, TrainingSite } from '../../types/candidate.types';
import { driveFolderConfigService } from '../../services/DriveFolderConfigService';

/**
 * Dossier Drive parent où créer le dossier d'un candidat, selon son TP et sa région
 * (déduite du site de formation). La config est éditable depuis l'UI (stockée en base) ;
 * le .env sert uniquement de fallback. Voir DriveFolderConfigService.
 */
export async function driveParentFolderForTp(
    tp?: TitleProfessionalType | string,
    trainingSite?: TrainingSite | string,
): Promise<string | undefined> {
    return driveFolderConfigService.resolveParentForTp(tp, trainingSite);
}

import { env } from '../../config/env';
import { TitleProfessionalType } from '../../types/candidate.types';

// Sous-dossier "Candidat Nord" cible selon le type de Titre Professionnel.
// Fallback sur la racine "Candidat Nord" si le sous-dossier n'est pas configuré.
const TP_FOLDER_IDS: Record<TitleProfessionalType, string | undefined> = {
    [TitleProfessionalType.AD]: env.DRIVE_CANDIDATS_NORD_AD_FOLDER_ID,
    [TitleProfessionalType.CC]: env.DRIVE_CANDIDATS_NORD_CC_FOLDER_ID,
    [TitleProfessionalType.NTC]: env.DRIVE_CANDIDATS_NORD_NTC_FOLDER_ID,
    [TitleProfessionalType.REM]: env.DRIVE_CANDIDATS_NORD_REM_FOLDER_ID,
    [TitleProfessionalType.SA]: env.DRIVE_CANDIDATS_NORD_SA_FOLDER_ID,
};

/** Dossier Drive parent où créer le dossier d'un candidat, selon son TP. */
export function driveParentFolderForTp(tp?: TitleProfessionalType | string): string | undefined {
    const id = tp ? TP_FOLDER_IDS[tp as TitleProfessionalType] : undefined;
    return id || env.DRIVE_CANDIDATS_NORD_FOLDER_ID;
}

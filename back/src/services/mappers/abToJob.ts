import { randomUUID } from 'crypto';
import { NeedsAnalysis, NeedsAnalysisPosition } from '../../types/needsAnalysis.types';
import { Job, JobStatus, DesiredSex, Sector, Localisation } from '../../types/job.types';
import { TitleProfessionalType } from '../../types/candidate.types';

// Zones de l'AB (NORD/OUEST/SUD) → communes du moteur de matching.
// L'AB raisonne par grande zone, le matching par commune : on étend.
const ZONE_TO_COMMUNES: Record<NeedsAnalysisPosition['localisation'], Localisation[]> = {
    NORD: [Localisation.SAINT_DENIS, Localisation.SAINTE_MARIE, Localisation.SAINTE_SUZANNE],
    OUEST: [
        Localisation.SAINT_PAUL,
        Localisation.LA_POSSESSION,
        Localisation.LE_PORT,
        Localisation.TROIS_BASSINS,
        Localisation.SAINT_LEU,
        Localisation.LES_AVIRONS,
    ],
    SUD: [
        Localisation.SAINT_PIERRE,
        Localisation.SAINT_LOUIS,
        Localisation.ETANG_SALE,
        Localisation.LE_TAMPON,
        Localisation.SAINT_JOSEPH,
        Localisation.SAINT_PHILLIPE,
        Localisation.PETIT_ILE,
        Localisation.CILAOS,
        Localisation.ENTRE_DEUX,
    ],
};

// Domaine de formation de l'AB → Titre Professionnel du matching.
// Seuls deux domaines existent côté AB ; correspondance la plus proche.
const DOMAIN_TO_TP: Record<NeedsAnalysisPosition['trainingDomain'], TitleProfessionalType> = {
    SECRETARIAT: TitleProfessionalType.SA,
    VENTE: TitleProfessionalType.NTC,
};

/**
 * Construit les offres (jobs) du moteur de matching à partir d'une AB.
 * Une offre par poste à pourvoir.
 */
export function buildJobsFromAb(analysis: NeedsAnalysis, companyName: string): Partial<Job>[] {
    const ageRange =
        analysis.ageMin != null && analysis.ageMax != null ? `${analysis.ageMin}-${analysis.ageMax}` : undefined;
    const drivingLicenseB = analysis.drivingLicense === 'OUI';
    const professionalExperience = analysis.experienceRequired === 'OBLIGATOIRE';

    // Fallback sur les champs « poste principal » de l'AB si la liste positions est vide (anciennes AB).
    const positions: NeedsAnalysisPosition[] =
        analysis.positions && analysis.positions.length > 0
            ? analysis.positions
            : [
                  {
                      trainingDomain: analysis.trainingDomain,
                      jobTitle: analysis.jobTitle,
                      selectedMissions: analysis.selectedMissions ?? [],
                      localisation: analysis.localisation,
                  },
              ];

    return positions.map((pos) => ({
        _id: randomUUID(),
        needs_analysis_id: analysis.id,
        company_name: companyName,
        age_range: ageRange,
        desired_tp: DOMAIN_TO_TP[pos.trainingDomain],
        desired_sex: DesiredSex.MIXTE,
        driving_license_b: drivingLicenseB,
        professional_experience: professionalExperience,
        sector: Sector.NONE,
        status: JobStatus.NOT_MATCHED,
        localisation: ZONE_TO_COMMUNES[pos.localisation] ?? [],
        matched_candidate: [],
    }));
}

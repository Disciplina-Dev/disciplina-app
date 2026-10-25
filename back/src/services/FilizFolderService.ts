import { Candidate } from '../types/candidate.types';
import { Offer } from '../types/offer.types';
import { NeedsAnalysis, Referents } from '../types/needsAnalysisNoSql.types';
import { FilizCreateFolderPayload, FilizPersonInfos, FilizStartStep } from '../external/filiz/type';
import { OfferRepository } from '../repositories/mongo/OfferRepository';
import { NeedsAnalysisRepository } from '../repositories/mongo/NeedsAnalysisRepository';
import {
    isAdult,
    mapCandidateToFilizBasics,
    mapCandidateToFilizStudent,
    missingFilizBasicFields,
    missingFilizStudentFields,
    splitFullName,
} from './mappers/candidate.mapper';

export interface FilizEmployer {
    siret?: string;
    legalName?: string;
    contact?: FilizPersonInfos;
    missionTitle?: string;
    missionDescription?: string;
}

export type FilizFolderPreparation =
    | { ok: true; payload: FilizCreateFolderPayload; step: FilizStartStep; companySiret: string | null }
    | { ok: false; error: string; missing?: string[] };

// Le contact de recrutement prime sur le représentant légal ; Filiz exige prénom, nom et email.
function contactFromReferents(referents: Referents | undefined): FilizPersonInfos | undefined {
    for (const referent of [referents?.recruitment_referents, referents?.legal_referents]) {
        if (!referent?.email || !referent.name) continue;
        const { firstName, lastName } = splitFullName(referent.name);
        if (firstName && lastName) return { firstName, lastName, mailAddress: referent.email };
    }
    return undefined;
}

export function extractFilizEmployer(offer: Offer | null, needsAnalysis: NeedsAnalysis | null): FilizEmployer {
    const siret = needsAnalysis?.company_infos?.siret?.replace(/\s/g, '');
    const descriptions = [...new Set((offer?.desired_tp ?? []).flatMap((tp) => tp.description_missions ?? []))];
    return {
        siret: siret && /^\d{14}$/.test(siret) ? siret : undefined,
        legalName: needsAnalysis?.company_infos?.name,
        contact: contactFromReferents(needsAnalysis?.referents ?? offer?.referents),
        missionTitle: offer?.title || undefined,
        missionDescription: descriptions.length > 0 ? descriptions.join('\n') : undefined,
    };
}

// Plus haute étape dont tous les champs obligatoires sont connus ; sinon l'étudiant et l'entreprise
// complètent leurs informations dans Filiz (étape 1).
export function pickFilizStartStep(candidate: Candidate, employer: FilizEmployer): FilizStartStep {
    if (missingFilizStudentFields(candidate).length > 0 || !employer.contact) return 1;
    return employer.siret ? 4 : 3;
}

export function buildFilizFolderPayload(
    candidate: Candidate,
    employer: FilizEmployer,
    step: FilizStartStep,
    classId: string,
    fileManager: FilizPersonInfos,
): FilizCreateFolderPayload {
    return {
        studentInfos: step === 1 ? mapCandidateToFilizBasics(candidate) : mapCandidateToFilizStudent(candidate),
        ...(step === 4 && employer.siret
            ? {
                  companyInfos: {
                      siretNumber: employer.siret,
                      sirenNumber: employer.siret.slice(0, 9),
                      legalName: employer.legalName,
                  },
              }
            : {}),
        contactCompanyInfos: employer.contact,
        fileManagerInfos: fileManager,
        config: {
            folder: {
                type: 'STUDY',
                // Étape 4 : Filiz exige le type de contrat ; Disciplina ne gère que l'alternance en apprentissage.
                ...(step === 4 ? { contractType: 'APPRENTICESHIP' as const } : {}),
                classId,
                step,
                missionTitle: employer.missionTitle,
                missionDescription: employer.missionDescription,
                contractInformations: {
                    followUpModality: 1,
                    numberOfTrainingOrganizationsInvolved: '1',
                    remainsAtNilCharge: true,
                },
            },
        },
    };
}

export class FilizFolderService {
    private offerRepository = new OfferRepository();
    private needsAnalysisRepository = new NeedsAnalysisRepository();

    // Entreprise du contrat du candidat : offre → besoin entreprise. Vide tant qu'aucun contrat n'est enregistré.
    private async resolveEmployer(candidate: Candidate): Promise<FilizEmployer> {
        if (!candidate.contract_offer_id) return {};
        const offer = await this.offerRepository.findById(candidate.contract_offer_id);
        const needsAnalysis = offer?.needs_analysis_id
            ? await this.needsAnalysisRepository.findById(offer.needs_analysis_id)
            : null;
        return extractFilizEmployer(offer, needsAnalysis);
    }

    async prepare(
        candidate: Candidate,
        classId: string,
        fileManager: FilizPersonInfos,
    ): Promise<FilizFolderPreparation> {
        const missing = missingFilizBasicFields(candidate);
        if (missing.length > 0) {
            return {
                ok: false,
                error: `Candidate is missing required fields for Filiz: ${missing.join(', ')}`,
                missing,
            };
        }
        if (!isAdult(candidate)) {
            return { ok: false, error: 'Candidate is a minor: Filiz folders are only created once they are 18' };
        }
        const employer = await this.resolveEmployer(candidate);
        const step = pickFilizStartStep(candidate, employer);
        return {
            ok: true,
            payload: buildFilizFolderPayload(candidate, employer, step, classId, fileManager),
            step,
            companySiret: step === 4 ? (employer.siret ?? null) : null,
        };
    }
}

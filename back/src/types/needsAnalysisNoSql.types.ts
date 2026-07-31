import { Localisation } from './matching.types';
import { TitleProfessionalType } from './candidate.types';

export enum CompanyRegion {
    NORD = 'NORD',
    OUEST = 'OUEST',
    SUD = 'SUD',
}

export enum Opco {
    AKTO = 'AKTO',
    ATLAS = 'ATLAS',
    AFDAS = 'AFDAS',
    CONSTRUCTYS = 'CONSTRUCTYS',
    OCAPIAT = 'OCAPIAT',
    OPCO_2I = 'OPCO_2I',
    OPCO_EP = 'OPCO_EP',
    OPCO_MOBILITES = 'OPCO_MOBILITES',
    OPCO_SANTE = 'OPCO_SANTE',
    OPCOMMERCE = 'OPCOMMERCE',
    UNIFORMATION = 'UNIFORMATION',
}

export enum ReferralSource {
    KOANN = 'KOANN',
    E2CR = 'E2CR',
    FRANCE_TRAVAIL = 'FRANCE_TRAVAIL',
    TELEVISION_PUB = 'TELEVISION_PUB',
    BOUCHE_A_OREILLE = 'BOUCHE_A_OREILLE',
    MISSION_LOCALE = 'MISSION_LOCALE',
    SALON = 'SALON',
    RSMA = 'RSMA',
    RESEAUX_SOCIAUX = 'RESEAUX_SOCIAUX',
}

export enum EducationLevel {
    BAC = 'BAC',
    BAC_PLUS_2 = 'BAC_PLUS_2',
    BAC_PLUS_3 = 'BAC_PLUS_3',
}

export enum TrainingDomain {
    SECRETARIAT = 'SECRETARIAT',
    VENTE = 'VENTE',
}

export enum RecruitmentMethod {
    ALL_CV = 'ALL_CV',
    PRESELECTION = 'PRESELECTION',
    PRE_INTERVIEW = 'PRE_INTERVIEW',
}

export enum ImmersionPeriod {
    OUI = 'OUI',
    NON = 'NON',
    A_DISCUTER = 'A_DISCUTER',
}

export enum NeedsAnalysisStatus {
    BROUILLON = 'BROUILLON',
    EN_ATTENTE_SIGNATURE = 'EN_ATTENTE_SIGNATURE',
    SIGNE = 'SIGNE',
    EXPIRE = 'EXPIRE',
}

export interface CompanyInfos {
    id?: number;
    name?: string;
    ape?: string | null;
    idcc?: string | null;
    siret?: string;
    main_activity?: string | null;
    opco?: Opco | null;
    referral_source?: ReferralSource | null;
    sector?: CompanyRegion;
    activities?: string[];
    description?: string | null;
    postal_code?: string | null;
    commune?: string | null;
}

export interface SalerInfo {
    id?: number;
    email?: string;
}

export interface ReferentDetails {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    function?: string | null;
}

export interface Referents {
    is_same?: boolean;
    legal_referents?: ReferentDetails;
    recruitment_referents?: ReferentDetails;
}

export interface OfferCriteria {
    education_level?: EducationLevel | null;
    driving_license?: boolean;
    experience_required?: boolean;
    training_domain?: TrainingDomain | null;
    age_min?: number | null;
    age_max?: number | null;
    desired_sex?: string | null;
    soft_skills?: string | null;
    schedule_options?: string[];
    conditions?: string | null;
    additional_comments?: string | null;
}

// Titre professionnel visé par le poste, avec ses missions propres : un même poste
// peut relever de plusieurs TP (ex. CC ou NTC) dont les missions diffèrent.
export interface PositionTp {
    tp_type?: TitleProfessionalType | null;
    missions?: string[];
    description_missions?: string[];
    other_missions?: string | null;
    other_description_missions?: string | null;
}

// Poste demandé par l'AB (formulaire commercial). Contient uniquement la donnée de
// poste : le snapshot entreprise/référents/saler et l'état de matching ne vivent que
// dans la collection `offers`, créée au premier envoi en signature.
export interface Position {
    localisation?: Localisation[];
    desired_tp?: PositionTp[];
    training_domain?: TrainingDomain | null;
    job_role?: string | null;
    title?: string;
    count?: number;
    criteria?: OfferCriteria;
}

export interface NeedsAnalysis {
    _id?: string;
    company_infos?: CompanyInfos;
    saler_info?: SalerInfo;
    referents?: Referents;
    positions?: Position[];
    recruitment_method?: RecruitmentMethod;
    immersion_period?: ImmersionPeriod;
    training_days?: string;
    signature_request_id?: string | null;
    status?: NeedsAnalysisStatus;
    tags?: string[];
    // Soft delete : une AB « supprimée » devient inactive (onglet Inactif) au lieu
    // d'être retirée — on conserve le document pour l'historique.
    is_deleted?: boolean;
    created_at?: Date;
    updated_at?: Date;
}

// Forme d'écriture (mutation GraphQL) : les FK relationnelles (companyID/userID)
// et les champs référent/entreprise restent plats côté input — le mapper les
// replie dans company_infos/referents. `positions` correspond 1:1 à PositionInput.
export interface NeedsAnalysisWriteInput {
    id?: string;
    companyID?: number;
    userID?: number;
    legalRepFunction?: string | null;
    recruitmentResponsibleName?: string | null;
    recruitmentResponsiblePhone?: string | null;
    recruitmentResponsibleEmail?: string | null;
    recruitmentResponsibleFunction?: string | null;
    companySectors?: string[];
    companyDescription?: string | null;
    opco?: Opco | null;
    referralSource?: ReferralSource | null;
    postalCode?: string | null;
    commune?: string | null;
    positions?: Position[];
    recruitmentMethod?: RecruitmentMethod;
    immersionPeriod?: ImmersionPeriod;
    trainingDays?: string;
    yousignSignatureRequestID?: string | null;
    status?: NeedsAnalysisStatus;
    tags?: string[];
    createdAt?: string;
}

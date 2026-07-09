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

// Poste demandé par l'AB (formulaire commercial). Contient uniquement la donnée de
// poste : le snapshot entreprise/référents/saler et l'état de matching ne vivent que
// dans la collection `offers`, créée au premier envoi en signature.
export interface Position {
    localisation?: Localisation[];
    tp_type?: TitleProfessionalType | null;
    training_domain?: TrainingDomain | null;
    title?: string;
    missions?: string[];
    description_missions?: string[];
    other_description_missions?: string | null;
    other_missions?: string | null;
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
    created_at?: Date;
    updated_at?: Date;
}

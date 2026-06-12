export interface NeedsAnalysisPosition {
    trainingDomain: 'SECRETARIAT' | 'VENTE';
    jobTitle: string;
    selectedMissions: string[];
    localisation: 'NORD' | 'OUEST' | 'SUD';
}

export interface NeedsAnalysis {
    id: number;
    companyID: number;
    userID: number;
    legalRepFunction: string | null;
    recruitmentResponsibleName: string | null;
    recruitmentResponsiblePhone: string | null;
    recruitmentResponsibleEmail: string | null;
    recruitmentResponsibleFunction: string | null;
    companySectors: string[];
    companyDescription: string | null;
    positionsCount: number;
    positions: NeedsAnalysisPosition[];
    localisation: 'NORD' | 'OUEST' | 'SUD';
    trainingDomain: 'SECRETARIAT' | 'VENTE';
    jobTitle: string;
    selectedMissions: string[];
    otherMissions: string | null;
    jobDescriptionMissions: string[];
    jobDescriptionOther: string | null;
    educationLevel: 'BAC' | 'BAC_PLUS_2' | 'BAC_PLUS_3' | null;
    drivingLicense: 'OUI' | 'OPTIONNEL';
    experienceRequired: 'DEBUTANT' | 'OBLIGATOIRE';
    ageRequirements: string[];
    ageMin: number | null;
    ageMax: number | null;
    softSkills: string | null;
    scheduleOptions: string[];
    conditions: string | null;
    additionalComments: string | null;
    recruitmentMethod: 'ALL_CV' | 'PRESELECTION' | 'PRE_INTERVIEW';
    immersionPeriod: 'OUI' | 'NON' | 'A_DISCUTER';
    trainingDays: string;
    yousignSignatureRequestID: string | null;
    status: 'BROUILLON' | 'EN_ATTENTE_SIGNATURE' | 'SIGNE' | 'EXPIRE';
    createdAt?: string;
    updatedAt?: string;
}

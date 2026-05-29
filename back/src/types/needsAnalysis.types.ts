export interface NeedsAnalysis {
    id: number;
    companyID: number;
    userID: number;
    recruitmentResponsibleName: string | null;
    recruitmentResponsiblePhone: string | null;
    recruitmentResponsibleEmail: string | null;
    positionsCount: number;
    localisation: 'NORD' | 'OUEST' | 'SUD';
    trainingDomain: 'SECRETARIAT' | 'VENTE';
    jobTitle: string;
    selectedMissions: string[];
    otherMissions: string | null;
    educationLevel: 'BAC' | 'BAC_PLUS_2' | 'BAC_PLUS_3';
    drivingLicense: 'OUI' | 'OPTIONNEL';
    experienceRequired: 'DEBUTANT' | 'OBLIGATOIRE';
    ageRequirements: string[];
    softSkills: string | null;
    recruitmentMethod: 'ALL_CV' | 'PRESELECTION' | 'PRE_INTERVIEW';
    immersionPeriod: 'OUI' | 'NON' | 'A_DISCUTER';
    trainingDays: string;
    yousignSignatureRequestID: string | null;
    status: 'BROUILLON' | 'EN_ATTENTE_SIGNATURE' | 'SIGNE' | 'EXPIRE';
    createdAt?: string;
    updatedAt?: string;
}

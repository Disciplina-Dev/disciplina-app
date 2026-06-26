export interface FilizToken {
    access_token: string;
    expires_in: number;
    token_type: string;
}

interface FilizContractType {
    apprenticeshipContract: boolean;
    professionalizationContract: boolean;
}

interface FilizApprenticeshipContractConfig {
    firstEducationalEquipment: boolean;
    firstEducationalEquipmentType: number;
    accomodationCosts: boolean;
    accomodationCostsNumber: string;
    cateringCosts: boolean;
    cateringCostsNumber: string;
    costsRelatedToInternationalMobility: boolean;
}

interface FilizProfessionalizationContractConfig {
    specialityDegree: number;
    titleSpeciality: number;
    typeOfQualificationTargeted: number;
}

interface FilizDegreeStudyConfig {
    contractType: FilizContractType;
    degreeStudyType: number;
    rncpNumber: string;
    rncpNumberLevel: string;
    degreeCode: string;
    degreeExpirationDate: string;
    degreeAmount: string;
    degreeDegree: number;
    degreeLevel: number;
    degreeDuration: string;
    generalEducationDuration: string;
    remainsAtNilCharge: boolean;
    apprenticeshipContractConfig: FilizApprenticeshipContractConfig;
    professionalizationContractConfig: FilizProfessionalizationContractConfig;
}

interface FilizRealizationAddress {
    housenumber: string;
    street: string;
    complement: string;
    city: string;
    country: string;
    postcode: string;
    formatted: string;
    address_line2: string;
    address_line1: string;
}

export interface FilizDegree {
    degreeId: string;
    degreeType: string;
    exactDegreeTitle: string;
    preparedTitleName: string;
    degreeStudyConfig: FilizDegreeStudyConfig;
    headTeacher: FilizPersonInfos;
    realizationAddress: FilizRealizationAddress;
}

interface FilizClassStudyConfig {
    contractType: FilizContractType;
    degreeAmount: string;
    degreeDuration: string;
    generalEducationDuration: string;
    remainsAtNilCharge: boolean;
    apprenticeshipContractConfig: FilizApprenticeshipContractConfig;
}

export interface FilizClass {
    degreeId: string;
    classId: string;
    className: string;
    startDate?: string;
    endDate?: string;
    classStudyConfig: FilizClassStudyConfig;
    headTeacher: FilizPersonInfos;
    referentTeacher: FilizPersonInfos;
    realizationAddress: FilizRealizationAddress;
}

export interface FilizAddress {
    street: string;
    complement?: string;
    city: string;
    country: string;
    postcode: string;
}

export interface FilizPhoneNumber {
    dialCode: string;
    number: string;
}

export interface FilizPersonInfos {
    firstName: string;
    lastName: string;
    mailAddress: string;
}

export interface FilizStudentInfos {
    firstName: string;
    lastName: string;
    mailAddress: string;
    address: FilizAddress;
    birthDate: string;
    cityOfBirth: string;
    departmentOfBirth: string;
    nationality: number;
    phoneNumber: FilizPhoneNumber;
    sexe: number;
}

export interface FilizFolderContractInfos {
    followUpModality: number;
    numberOfTrainingOrganizationsInvolved: string;
    remainsAtNilCharge: boolean;
    contractType?: {
        apprenticeshipContract: boolean;
        professionalizationContract: boolean;
    };
    realizationAddress?: FilizAddress;
}

export interface FilizCreateFolderPayload {
    studentInfos: FilizStudentInfos;
    contactCompanyInfos?: FilizPersonInfos;
    fileManagerInfos: FilizPersonInfos;
    referentTeacherInfos?: FilizPersonInfos;
    headTeacher?: FilizPersonInfos;
    config: {
        folder: {
            type: string;
            classId: string;
            step: number;
            contractInformations: FilizFolderContractInfos;
        };
    };
}

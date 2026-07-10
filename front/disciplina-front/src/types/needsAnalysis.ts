export interface CompanyInfos {
  id?: number | null
  name?: string | null
  ape?: string | null
  idcc?: string | null
  siret?: string | null
  mainActivity?: string | null
  opco?: string | null
  referralSource?: string | null
  sector?: string | null
  activities?: string[] | null
  description?: string | null
  postalCode?: string | null
  commune?: string | null
}

export interface SalerInfo {
  id?: number | null
  email?: string | null
}

export interface ReferentDetails {
  name?: string | null
  phone?: string | null
  email?: string | null
  function?: string | null
}

export interface Referents {
  isSame?: boolean | null
  legalReferents?: ReferentDetails | null
  recruitmentReferents?: ReferentDetails | null
}

export interface OfferCriteria {
  educationLevel?: string | null
  drivingLicense?: boolean | null
  experienceRequired?: boolean | null
  trainingDomain?: string | null
  ageMin?: number | null
  ageMax?: number | null
  desiredSex?: string | null
  softSkills?: string | null
  scheduleOptions?: string[] | null
  conditions?: string | null
  additionalComments?: string | null
}

export interface Position {
  localisation?: string[] | null
  tpType?: string | null
  trainingDomain?: string | null
  title?: string | null
  missions?: string[] | null
  descriptionMissions?: string[] | null
  otherDescriptionMissions?: string | null
  otherMissions?: string | null
  criteria?: OfferCriteria | null
}

export interface NeedsAnalysis {
  id: string
  companyInfos?: CompanyInfos | null
  salerInfo?: SalerInfo | null
  referents?: Referents | null
  positionsCount?: number | null
  positions?: Position[] | null
  recruitmentMethod?: string | null
  immersionPeriod?: string | null
  trainingDays?: string | null
  yousignSignatureRequestID?: string | null
  status?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

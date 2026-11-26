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

export interface OfferTp {
  tpType: string | null
  missions: string[]
  descriptionMissions: string[]
  otherDescriptionMissions?: string | null
  otherMissions?: string | null
}

export interface OfferHistoryEntry {
  id: string
  firstName: string | null
  lastName: string | null
  text: string
  ownerEmail: string | null
  createdAt: string
}

export interface Job {
  id: string
  needsAnalysisId?: string | null
  companyInfos?: { id?: number; name?: string; activities?: string[] | null } | null
  softSkills?: string | null
  companyName: string
  ageRange: string
  desiredTp: OfferTp[]
  desiredSex: string | null
  drivingLicencseB: boolean | null
  hasVehicle: boolean | null
  professionalExperience: boolean | null
  status: string | null
  localisation: string[] | null
  sector: string | null
  salerInfo?: SalerInfo | null
  referents?: Referents | null
  title?: string | null
}

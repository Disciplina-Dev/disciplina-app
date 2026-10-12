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

export interface ScheduleSlot {
  day?: string | null
  startHour?: string | null
  endHour?: string | null
}

export interface OfferCriteria {
  educationLevel?: string | null
  drivingLicense?: boolean | null
  hasVehicle?: boolean | null
  experienceRequired?: boolean | null
  trainingDomain?: string | null
  ageMin?: number | null
  ageMax?: number | null
  desiredSex?: string | null
  softSkills?: string | null
  scheduleOptions?: ScheduleSlot[] | null
  conditions?: string | null
  additionalComments?: string | null
}

export interface PositionTp {
  tpType?: string | null
  missions?: string[] | null
  descriptionMissions?: string[] | null
  otherDescriptionMissions?: string | null
  otherMissions?: string | null
}

export interface Position {
  localisation?: string[] | null
  desiredTp?: PositionTp[] | null
  trainingDomain?: string | null
  jobRole?: string | null
  count?: number | null
  title?: string | null
  criteria?: OfferCriteria | null
}

export type AdministrationType = 'NON_RENSEIGNE' | 'ADMINISTRATION_PUBLIQUE' | 'ADMINISTRATION_PRIVEE'

export const ADMINISTRATION_LABELS: Record<AdministrationType, string> = {
  NON_RENSEIGNE: 'Non renseigné',
  ADMINISTRATION_PUBLIQUE: 'Administration publique',
  ADMINISTRATION_PRIVEE: 'Administration privée',
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
  /** Brouillon rendu visible dans le matching sans envoi en signature (affiché « Non envoyée »). */
  isVisibleInMatching?: boolean | null
  /** Statut d'onglet (liste matching RH) : forcé manuellement ou dérivé des offres. */
  abStatus?: string | null
  isRelanceDisabled?: boolean | null
  administrationType?: AdministrationType | null
  tags?: string[] | null
  createdAt?: string | null
  updatedAt?: string | null
  /** Date du dernier passage au statut effectif ACTIVE (null = antérieur au suivi). */
  lastActiveAt?: string | null
  /** URL Drive du dossier contenant le mandat signé (uniquement si SIGNE). */
  driveFolderUrl?: string | null
  /** Pastille couleur manuelle du suivi entreprise (annuaire RH). Null = automatique. */
  companyIndicator?: string | null
}

export interface AbBadge {
  bg: string
  text: string
  label: string
}

const AB_BADGES: Record<string, AbBadge> = {
  BROUILLON: {
    bg: 'bg-[var(--ds-surface-sunken)]',
    text: 'text-[var(--ds-text-muted)]',
    label: 'Brouillon',
  },
  NON_ENVOYEE: {
    bg: 'bg-[var(--ds-warning-bg)]',
    text: 'text-[var(--ds-warning)]',
    label: 'Non envoyée',
  },
  EN_ATTENTE_SIGNATURE: {
    bg: 'bg-[var(--ds-warning-bg)]',
    text: 'text-[var(--ds-warning)]',
    label: 'En attente de signature',
  },
  SIGNE: { bg: 'bg-[var(--ds-success-bg)]', text: 'text-[var(--ds-success)]', label: 'Signé' },
  EXPIRE: { bg: 'bg-[var(--ds-danger-bg)]', text: 'text-[var(--ds-danger)]', label: 'Expiré' },
}

/**
 * Badge de statut d'AB : un brouillon publié dans le matching (sans envoi en
 * signature) s'affiche « Non envoyée » — il se matche comme une AB non signée.
 */
export function abStatusBadge(
  status?: string | null,
  isVisibleInMatching?: boolean | null,
): AbBadge {
  if (status === 'BROUILLON' && isVisibleInMatching) return AB_BADGES['NON_ENVOYEE']
  return AB_BADGES[status ?? 'BROUILLON'] ?? AB_BADGES['BROUILLON']
}

/** Libellé textuel du statut d'AB (lignes « Statut AB », listes compactes). */
export function abStatusLabel(status?: string | null, isVisibleInMatching?: boolean | null): string {
  return abStatusBadge(status, isVisibleInMatching).label
}

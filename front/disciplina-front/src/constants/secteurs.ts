import { TrainingSite } from '@/types/candidate'
import type { Region } from '@/store/regionStore'

/**
 * Secteurs géographiques Disciplina (NORD/OUEST/SUD).
 * Vocabulaire commun du front : les trois fichiers ci-dessous devaient chacun
 * définir leurs propres libellés — certains parfois « Nord » au lieu de
 * « Nord-Est ». Tout passe désormais par ce module pour garantir un seul
 * vocabulaire (valeurs canoniques cf. back/src/utils/sector.ts).
 */

/** Secteur métier (valeurs canoniques affichées/stockées). */
export type Secteur = 'Nord-Est' | 'Ouest' | 'Sud'

export const SECTEUR_VALUES: Secteur[] = ['Nord-Est', 'Ouest', 'Sud']

export const DEFAULT_SECTEUR: Secteur = 'Nord-Est'

/**
 * Secteurs entreprise du tenant Annemasse (Haute-Savoie) : les 6 secteurs
 * opérationnels du référentiel communes. Vocabulaire **entreprise uniquement** —
 * les secteurs utilisateurs (inscription, agenda, KPI) restent sur `SECTEUR_VALUES`
 * pour les deux tenants (cf. back/src/utils/sector.ts).
 */
export type SecteurAnnemasse =
  | 'Genève / Frontière'
  | 'Saint-Julien / Genevois'
  | 'Arve'
  | 'Faucigny / La Roche'
  | 'Annecy'
  | 'Chablais'

export const ANNEMASSE_SECTEUR_VALUES: SecteurAnnemasse[] = [
  'Genève / Frontière',
  'Saint-Julien / Genevois',
  'Arve',
  'Faucigny / La Roche',
  'Annecy',
  'Chablais',
]

export const DEFAULT_ANNEMASSE_SECTEUR: SecteurAnnemasse = 'Genève / Frontière'

/** Secteurs entreprise proposés selon le tenant (region null → Réunion par défaut). */
export function companySecteursForRegion(region: Region | null | undefined): string[] {
  return region === 'annemasse' ? [...ANNEMASSE_SECTEUR_VALUES] : [...SECTEUR_VALUES]
}

/** Secteur entreprise par défaut selon le tenant. */
export function defaultCompanySecteurForRegion(region: Region | null | undefined): string {
  return region === 'annemasse' ? DEFAULT_ANNEMASSE_SECTEUR : DEFAULT_SECTEUR
}

/** Union des vocabulaires entreprise (validation : ne jamais perdre une valeur stockée). */
export const ALL_COMPANY_SECTEURS: string[] = [...SECTEUR_VALUES, ...ANNEMASSE_SECTEUR_VALUES]

/** Clé brute secteur (ENUM BDD/API : NORD/OUEST/SUD). */
export type SecteurKey = 'NORD' | 'OUEST' | 'SUD'

export const SECTEUR_KEYS: SecteurKey[] = ['NORD', 'OUEST', 'SUD']

/** Libellé canonique d'un secteur par clé brute (source de vérité UI). */
export const SECTEUR_LABELS: Record<SecteurKey, string> = {
  NORD: 'Nord-Est',
  OUEST: 'Ouest',
  SUD: 'Sud',
}

/** Secteur métier → clé brute (inverse de SECTEUR_LABELS). */
export const SECTEUR_KEY_BY_LABEL: Record<Secteur, SecteurKey> = {
  'Nord-Est': 'NORD',
  Ouest: 'OUEST',
  Sud: 'SUD',
}

/** Site de formation → clé secteur brute. */
export const TRAINING_SITE_SECTEUR_KEYS: Record<TrainingSite, SecteurKey> = {
  [TrainingSite.NORD_SAINTE_MARIE]: 'NORD',
  [TrainingSite.OUEST_SAINT_PAUL]: 'OUEST',
  [TrainingSite.SUD_SAINT_PIERRE]: 'SUD',
}

/** Clé secteur brute d'un site de formation (ou null si inconnu). */
export function secteurKeyOfTrainingSite(site?: TrainingSite | null): SecteurKey | null {
  return site ? TRAINING_SITE_SECTEUR_KEYS[site] ?? null : null
}

/** Libellé canonique du secteur d'un site de formation (ou null si inconnu). */
export function secteurLabelOfTrainingSite(site?: TrainingSite | null): string | null {
  const key = secteurKeyOfTrainingSite(site)
  return key ? SECTEUR_LABELS[key] : null
}
import { Localisation } from './jobEnums'
import { SECTEUR_LABELS, SECTEUR_KEY_BY_LABEL } from '@/constants/secteurs'
import type { Secteur, SecteurKey } from '@/constants/secteurs'
import type { Region as TenantRegion } from '@/store/regionStore'

export type Region = SecteurKey

export const REGION_COMMUNES: Record<Region, Localisation[]> = {
  NORD: [
    Localisation.SAINT_DENIS,
    Localisation.SAINTE_MARIE,
    Localisation.SAINTE_SUZANNE,
    Localisation.SAINTE_ROSE,
    Localisation.SAINT_BENOIT,
    Localisation.BRAS_PANON,
    Localisation.SAINT_ANDRE,
    Localisation.LA_PLAINE_DES_PALMISTES,
    Localisation.SALAZIE,
    Localisation.SAINTE_ANNE,
  ],
  OUEST: [
    Localisation.SAINT_PAUL,
    Localisation.SAINT_GILLES,
    Localisation.LA_POSSESSION,
    Localisation.LE_PORT,
    Localisation.TROIS_BASSINS,
    Localisation.SAINT_LEU,
    Localisation.LES_AVIRONS,
  ],
  SUD: [
    Localisation.SAINT_PIERRE,
    Localisation.CILAOS,
    Localisation.ETANG_SALE,
    Localisation.SAINT_LOUIS,
    Localisation.ENTRE_DEUX,
    Localisation.LE_TAMPON,
    Localisation.SAINT_PHILLIPE,
    Localisation.SAINT_JOSEPH,
    Localisation.PETIT_ILE,
  ],
}

export const SECTOR_TO_REGION: Record<Secteur, Region> = SECTEUR_KEY_BY_LABEL

export const REGION_LABELS: Record<Region, string> = SECTEUR_LABELS

/**
 * Tenant Annemasse (Haute-Savoie) : les 6 secteurs opérationnels et leurs
 * communes. Volontairement séparé de `REGION_COMMUNES` (typé sur les 3 clés
 * Réunion `SecteurKey`) pour ne pas casser les 12 écrans secteur existants.
 * `BONS_EN_CHABLAIS` est revendiqué par Genève / frontière et Chablais.
 */
export type AnnemasseRegion =
  | 'GENEVE_FRONTIERE'
  | 'GENEVOIS'
  | 'ARVE'
  | 'FAUCIGNY'
  | 'ANNECY'
  | 'CHABLAIS'

export const ANNEMASSE_REGION_COMMUNES: Record<AnnemasseRegion, Localisation[]> = {
  GENEVE_FRONTIERE: [
    Localisation.ANNEMASSE,
    Localisation.AMBILLY,
    Localisation.GAILLARD,
    Localisation.VILLE_LA_GRAND,
    Localisation.VETRAZ_MONTHOUX,
    Localisation.ETREMBIERES,
    Localisation.CRANVES_SALES,
    Localisation.SAINT_CERGUES,
    Localisation.JUVIGNY,
    Localisation.BONNE,
    Localisation.MACHILLY,
    Localisation.DOUVAINE,
    Localisation.VEIGY_FONCENEX,
    Localisation.BONS_EN_CHABLAIS,
    Localisation.SCIEZ,
    Localisation.THONON_LES_BAINS,
    Localisation.EVIAN_LES_BAINS,
  ],
  GENEVOIS: [
    Localisation.SAINT_JULIEN_EN_GENEVOIS,
    Localisation.ARCHAMPS,
    Localisation.NEYDENS,
    Localisation.COLLONGES_SOUS_SALEVE,
    Localisation.PRESILLY,
    Localisation.BEAUMONT,
    Localisation.FEIGERES,
    Localisation.VIRY,
    Localisation.VALLEIRY,
    Localisation.VULBENS,
    Localisation.CHENEX,
  ],
  ARVE: [
    Localisation.REIGNIER_ESERY,
    Localisation.ARENTHON,
    Localisation.CONTAMINE_SUR_ARVE,
    Localisation.BONNEVILLE,
    Localisation.AYSE,
    Localisation.MARIGNIER,
    Localisation.VOUGY,
    Localisation.CLUSES,
    Localisation.SCIONZIER,
    Localisation.MARNAZ,
  ],
  FAUCIGNY: [
    Localisation.LA_ROCHE_SUR_FORON,
    Localisation.AMANCY,
    Localisation.SAINT_PIERRE_EN_FAUCIGNY,
    Localisation.ETAUX,
    Localisation.CORNIER,
    Localisation.PERS_JUSSY,
    Localisation.SCIENTRIER,
    Localisation.ARBUSIGNY,
  ],
  ANNECY: [
    Localisation.ANNECY,
    Localisation.PRINGY,
    Localisation.EPAGNY_METZ_TESSY,
    Localisation.POISY,
    Localisation.MEYTHET,
    Localisation.SEYNOD,
    Localisation.CRAN_GEVRIER,
    Localisation.ARGONAY,
  ],
  CHABLAIS: [
    Localisation.BONS_EN_CHABLAIS,
    Localisation.PERRIGNIER,
    Localisation.BOEGE,
    Localisation.FILLINGES,
    Localisation.VIUZ_EN_SALLAZ,
    Localisation.SAINT_JEOIRE,
  ],
}

export const ANNEMASSE_REGION_LABELS: Record<AnnemasseRegion, string> = {
  GENEVE_FRONTIERE: 'Genève / Frontière',
  GENEVOIS: 'Saint-Julien / Genevois',
  ARVE: 'Arve',
  FAUCIGNY: 'Faucigny / La Roche',
  ANNECY: 'Annecy',
  CHABLAIS: 'Chablais',
}

export interface CommuneSection {
  key: string
  label: string
  options: string[]
}

const REUNION_REGION_KEYS: Region[] = ['NORD', 'OUEST', 'SUD']

export const ANNEMASSE_REGION_KEYS: AnnemasseRegion[] = [
  'GENEVE_FRONTIERE',
  'GENEVOIS',
  'ARVE',
  'FAUCIGNY',
  'ANNECY',
  'CHABLAIS',
]

/**
 * Sections de communes pour les sélecteurs de mobilité (3 zones Réunion +
 * 6 secteurs Annemasse). Les deux enums `Localisation` (candidat et matching)
 * partagent les mêmes valeurs string — passage par `string[]`.
 */
export const ALL_COMMUNE_SECTIONS: CommuneSection[] = [
  ...REUNION_REGION_KEYS.map((r) => ({
    key: r,
    label: REGION_LABELS[r],
    options: [...(REGION_COMMUNES[r] as unknown as string[])],
  })),
  ...ANNEMASSE_REGION_KEYS.map((r) => ({
    key: r,
    label: ANNEMASSE_REGION_LABELS[r],
    options: [...(ANNEMASSE_REGION_COMMUNES[r] as unknown as string[])],
  })),
]

const REUNION_SECTION_KEYS: string[] = [...REUNION_REGION_KEYS]
const ANNEMASSE_SECTION_KEYS: string[] = [...ANNEMASSE_REGION_KEYS]

/**
 * Sections de communes selon le tenant : Réunion ne voit que ses 3 zones,
 * Annemasse ses 6 secteurs (region null → Réunion par défaut).
 */
export function communeSectionsForRegion(region: TenantRegion | null | undefined): CommuneSection[] {
  const keys = region === 'annemasse' ? ANNEMASSE_SECTION_KEYS : REUNION_SECTION_KEYS
  return ALL_COMMUNE_SECTIONS.filter((s) => keys.includes(s.key))
}

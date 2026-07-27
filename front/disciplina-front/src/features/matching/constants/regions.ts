import { Localisation } from './jobEnums'

export type Region = 'NORD' | 'OUEST' | 'SUD'

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

export const SECTOR_TO_REGION: Record<string, Region> = {
  'Nord-Est': 'NORD',
  Ouest: 'OUEST',
  Sud: 'SUD',
}

export const REGION_LABELS: Record<Region, string> = {
  NORD: 'Nord',
  OUEST: 'Ouest',
  SUD: 'Sud',
}

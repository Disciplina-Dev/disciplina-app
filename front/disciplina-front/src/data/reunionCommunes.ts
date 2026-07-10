// La Réunion (974) — code postal → commune, et liste des communes pour la mobilité.

import { Localisation } from '@/types/candidate'

/** Code postal → nom de commune (La Réunion). Plusieurs codes peuvent pointer la même commune. */
export const REUNION_POSTAL_TO_CITY: Record<string, string> = {
  // Saint-Denis
  '97400': 'Saint-Denis',
  '97417': 'Saint-Denis',
  '97490': 'Saint-Denis',
  // La Possession
  '97419': 'La Possession',
  // Le Port
  '97420': 'Le Port',
  // Saint-Paul
  '97460': 'Saint-Paul',
  '97411': 'Saint-Paul',
  '97422': 'Saint-Paul',
  '97423': 'Saint-Paul',
  '97434': 'Saint-Paul',
  '97435': 'Saint-Paul',
  // Trois-Bassins
  '97426': 'Trois-Bassins',
  // Saint-Leu
  '97436': 'Saint-Leu',
  '97416': 'Saint-Leu',
  '97424': 'Saint-Leu',
  // Les Avirons
  '97425': 'Les Avirons',
  // L'Étang-Salé
  '97427': "L'Étang-Salé",
  // Saint-Louis
  '97450': 'Saint-Louis',
  '97421': 'Saint-Louis',
  // Cilaos
  '97413': 'Cilaos',
  // Saint-Pierre
  '97410': 'Saint-Pierre',
  '97432': 'Saint-Pierre',
  // Le Tampon
  '97430': 'Le Tampon',
  '97418': 'Le Tampon',
  // Entre-Deux
  '97414': 'Entre-Deux',
  // Petite-Île
  '97429': 'Petite-Île',
  // Saint-Joseph
  '97480': 'Saint-Joseph',
  // Saint-Philippe
  '97442': 'Saint-Philippe',
  // Sainte-Rose
  '97439': 'Sainte-Rose',
  // La Plaine-des-Palmistes
  '97431': 'La Plaine-des-Palmistes',
  // Saint-Benoît
  '97470': 'Saint-Benoît',
  '97437': 'Saint-Benoît',
  // Bras-Panon
  '97412': 'Bras-Panon',
  // Salazie
  '97433': 'Salazie',
  // Saint-André
  '97440': 'Saint-André',
  // Sainte-Suzanne
  '97441': 'Sainte-Suzanne',
  // Sainte-Marie
  '97438': 'Sainte-Marie',
}

/** Renvoie la commune correspondant au code postal saisi, ou undefined. */
export function cityFromPostalCode(postalCode: string): string | undefined {
  return REUNION_POSTAL_TO_CITY[postalCode.trim()]
}

/** Libellés FR des communes de La Réunion, indexés par l'enum `Localisation` (mobilité géographique). */
export const LOCALISATION_LABELS: Record<Localisation, string> = {
  [Localisation.SAINT_DENIS]: 'Saint-Denis',
  [Localisation.SAINTE_MARIE]: 'Sainte-Marie',
  [Localisation.SAINTE_SUZANNE]: 'Sainte-Suzanne',
  [Localisation.SAINT_PAUL]: 'Saint-Paul',
  [Localisation.SAINT_GILLES]: 'Saint-Gilles',
  [Localisation.LA_POSSESSION]: 'La Possession',
  [Localisation.LE_PORT]: 'Le Port',
  [Localisation.TROIS_BASSINS]: 'Trois-Bassins',
  [Localisation.SAINT_LEU]: 'Saint-Leu',
  [Localisation.SAINT_PIERRE]: 'Saint-Pierre',
  [Localisation.CILAOS]: 'Cilaos',
  [Localisation.ETANG_SALE]: "L'Étang-Salé",
  [Localisation.SAINT_LOUIS]: 'Saint-Louis',
  [Localisation.ENTRE_DEUX]: 'Entre-Deux',
  [Localisation.LES_AVIRONS]: 'Les Avirons',
  [Localisation.LE_TAMPON]: 'Le Tampon',
  [Localisation.SAINT_PHILLIPE]: 'Saint-Philippe',
  [Localisation.SAINT_JOSEPH]: 'Saint-Joseph',
  [Localisation.PETIT_ILE]: 'Petite-Île',
  [Localisation.SAINTE_ROSE]: 'Sainte-Rose',
  [Localisation.SAINT_BENOIT]: 'Saint-Benoît',
  [Localisation.BRAS_PANON]: 'Bras-Panon',
  [Localisation.SAINT_ANDRE]: 'Saint-André',
  [Localisation.LA_PLAINE_DES_PALMISTES]: 'La Plaine-des-Palmistes',
  [Localisation.SALAZIE]: 'Salazie',
  [Localisation.SAINTE_ANNE]: 'Sainte-Anne',
}

/**
 * Formate une commune pour l'affichage : accepte une clé enum `Localisation`
 * (`SAINT_DENIS`), une variante insensible à la casse (`Saint_Denis`) ou une
 * saisie libre. Renvoie toujours le libellé officiel (« Saint-Denis »), et
 * nettoie les underscores résiduels pour toute valeur hors référentiel.
 */
export function formatCommune(value?: string | null): string {
  if (!value) return '—'
  const raw = value.trim()
  if (raw in LOCALISATION_LABELS) return LOCALISATION_LABELS[raw as Localisation]
  const upper = raw.toUpperCase()
  if (upper in LOCALISATION_LABELS) return LOCALISATION_LABELS[upper as Localisation]
  return raw.replace(/_/g, '-')
}

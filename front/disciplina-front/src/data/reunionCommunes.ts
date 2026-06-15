// La Réunion (974) — code postal → commune, et liste des communes pour la mobilité.

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

/**
 * Communes de l'arc nord de La Réunion (Sainte-Rose → Saint-Paul :
 * nord, nord-est, nord-ouest), pour la mobilité géographique.
 */
export const NORTH_MOBILITY_COMMUNES: string[] = [
  'Sainte-Rose',
  'Saint-Benoît',
  'Bras-Panon',
  'Saint-André',
  'Salazie',
  'Sainte-Suzanne',
  'Sainte-Marie',
  'Saint-Denis',
  'La Possession',
  'Le Port',
  'Saint-Paul',
]

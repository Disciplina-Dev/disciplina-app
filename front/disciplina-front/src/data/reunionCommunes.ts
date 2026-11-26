// La Réunion (974) + Haute-Savoie / Annemasse (74) — code postal → commune,
// et liste des communes pour la mobilité.

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

/**
 * Haute-Savoie — tenant Annemasse (74). Un code postal partagé par plusieurs
 * communes pointe vers la commune principale (bureau distributeur), comme
 * pour la carte Réunion ci-dessus (ex. 97460 → Saint-Paul).
 */
export const ANNEMASSE_POSTAL_TO_CITY: Record<string, string> = {
  // Secteur Genève / frontière
  '74100': 'Annemasse',
  '74240': 'Gaillard',
  '74380': 'Cranves-Sales',
  '74140': 'Douvaine',
  '74890': 'Bons-en-Chablais',
  '74200': 'Thonon-les-Bains',
  '74500': 'Évian-les-Bains',
  // Secteur Saint-Julien / Genevois
  '74160': 'Saint-Julien-en-Genevois',
  '74580': 'Viry',
  '74520': 'Valleiry',
  // Secteur Arve
  '74930': 'Reignier-Ésery',
  '74130': 'Bonneville',
  '74970': 'Marignier',
  '74300': 'Cluses',
  '74950': 'Scionzier',
  '74460': 'Marnaz',
  // Secteur Faucigny / La Roche
  '74800': 'La Roche-sur-Foron',
  // Secteur Annecy
  '74000': 'Annecy',
  '74370': 'Pringy',
  '74330': 'Épagny Metz-Tessy',
  '74960': 'Meythet',
  '74600': 'Seynod',
  // Secteur Chablais
  '74550': 'Perrignier',
  '74420': 'Boëge',
  '74250': 'Fillinges',
  '74490': 'Saint-Jeoire',
}

/** Renvoie la commune correspondant au code postal saisi, ou undefined. */
export function cityFromPostalCode(postalCode: string): string | undefined {
  const code = postalCode.trim()
  return REUNION_POSTAL_TO_CITY[code] ?? ANNEMASSE_POSTAL_TO_CITY[code]
}

/**
 * Communes de Haute-Savoie (tenant Annemasse) pour la recherche SIRENE
 * multicritère (page Sourcing). Même convention que la liste Réunion de
 * `pages/commercial/sourcing.tsx` : slugs minuscules — `denormalizeCommune` les repasse en
 * libellés pour `libelleCommuneEtablissement`. Regroupées par secteur
 * opérationnel (Genève / frontière, Genevois, Arve, Faucigny, Annecy, Chablais).
 */
export const ANNEMASSE_COMMUNES: string[] = [
  // Genève / frontière
  'annemasse',
  'ambilly',
  'gaillard',
  'ville-la-grand',
  'vetraz-monthoux',
  'etrembieres',
  'cranves-sales',
  'saint-cergues',
  'juvigny',
  'bonne',
  'machilly',
  'douvaine',
  'veigy-foncenex',
  'bons-en-chablais',
  'sciez',
  'thonon-les-bains',
  'evian-les-bains',
  // Saint-Julien / Genevois
  'saint-julien-en-genevois',
  'archamps',
  'neydens',
  'collonges-sous-saleve',
  'presilly',
  'beaumont',
  'feigeres',
  'viry',
  'valleiry',
  'vulbens',
  'chenex',
  // Arve
  'reignier-esery',
  'arenthon',
  'contamine-sur-arve',
  'bonneville',
  'ayse',
  'marignier',
  'vougy',
  'cluses',
  'scionzier',
  'marnaz',
  // Faucigny / La Roche
  'la-roche-sur-foron',
  'amancy',
  'saint-pierre-en-faucigny',
  'eteaux',
  'cornier',
  'pers-jussy',
  'scientrier',
  'arbusigny',
  // Annecy
  'annecy',
  'pringy',
  'epagny-metz-tessy',
  'poisy',
  'meythet',
  'seynod',
  'cran-gevrier',
  'argonay',
  // Chablais
  'perrignier',
  'boege',
  'fillinges',
  'viuz-en-sallaz',
  'saint-jeoire',
]

/** Libellés FR des communes de La Réunion et de Haute-Savoie (Annemasse), indexés par l'enum `Localisation` (mobilité géographique). */
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
  // Haute-Savoie — secteur Genève / frontière.
  [Localisation.ANNEMASSE]: 'Annemasse',
  [Localisation.AMBILLY]: 'Ambilly',
  [Localisation.GAILLARD]: 'Gaillard',
  [Localisation.VILLE_LA_GRAND]: 'Ville-la-Grand',
  [Localisation.VETRAZ_MONTHOUX]: 'Vétraz-Monthoux',
  [Localisation.ETREMBIERES]: 'Étrembières',
  [Localisation.CRANVES_SALES]: 'Cranves-Sales',
  [Localisation.SAINT_CERGUES]: 'Saint-Cergues',
  [Localisation.JUVIGNY]: 'Juvigny',
  [Localisation.BONNE]: 'Bonne',
  [Localisation.MACHILLY]: 'Machilly',
  [Localisation.DOUVAINE]: 'Douvaine',
  [Localisation.VEIGY_FONCENEX]: 'Veigy-Foncenex',
  [Localisation.BONS_EN_CHABLAIS]: 'Bons-en-Chablais',
  [Localisation.SCIEZ]: 'Sciez',
  [Localisation.THONON_LES_BAINS]: 'Thonon-les-Bains',
  [Localisation.EVIAN_LES_BAINS]: 'Évian-les-Bains',
  // Haute-Savoie — secteur Saint-Julien / Genevois.
  [Localisation.SAINT_JULIEN_EN_GENEVOIS]: 'Saint-Julien-en-Genevois',
  [Localisation.ARCHAMPS]: 'Archamps',
  [Localisation.NEYDENS]: 'Neydens',
  [Localisation.COLLONGES_SOUS_SALEVE]: 'Collonges-sous-Salève',
  [Localisation.PRESILLY]: 'Présilly',
  [Localisation.BEAUMONT]: 'Beaumont',
  [Localisation.FEIGERES]: 'Feigères',
  [Localisation.VIRY]: 'Viry',
  [Localisation.VALLEIRY]: 'Valleiry',
  [Localisation.VULBENS]: 'Vulbens',
  [Localisation.CHENEX]: 'Chênex',
  // Haute-Savoie — secteur Arve.
  [Localisation.REIGNIER_ESERY]: 'Reignier-Ésery',
  [Localisation.ARENTHON]: 'Arenthon',
  [Localisation.CONTAMINE_SUR_ARVE]: 'Contamine-sur-Arve',
  [Localisation.BONNEVILLE]: 'Bonneville',
  [Localisation.AYSE]: 'Ayse',
  [Localisation.MARIGNIER]: 'Marignier',
  [Localisation.VOUGY]: 'Vougy',
  [Localisation.CLUSES]: 'Cluses',
  [Localisation.SCIONZIER]: 'Scionzier',
  [Localisation.MARNAZ]: 'Marnaz',
  // Haute-Savoie — secteur Faucigny / La Roche.
  [Localisation.LA_ROCHE_SUR_FORON]: 'La Roche-sur-Foron',
  [Localisation.AMANCY]: 'Amancy',
  [Localisation.SAINT_PIERRE_EN_FAUCIGNY]: 'Saint-Pierre-en-Faucigny',
  [Localisation.ETAUX]: 'Éteaux',
  [Localisation.CORNIER]: 'Cornier',
  [Localisation.PERS_JUSSY]: 'Pers-Jussy',
  [Localisation.SCIENTRIER]: 'Scientrier',
  [Localisation.ARBUSIGNY]: 'Arbusigny',
  // Haute-Savoie — secteur Annecy.
  [Localisation.ANNECY]: 'Annecy',
  [Localisation.PRINGY]: 'Pringy',
  [Localisation.EPAGNY_METZ_TESSY]: 'Épagny Metz-Tessy',
  [Localisation.POISY]: 'Poisy',
  [Localisation.MEYTHET]: 'Meythet',
  [Localisation.SEYNOD]: 'Seynod',
  [Localisation.CRAN_GEVRIER]: 'Cran-Gevrier',
  [Localisation.ARGONAY]: 'Argonay',
  // Haute-Savoie — secteur Chablais.
  [Localisation.PERRIGNIER]: 'Perrignier',
  [Localisation.BOEGE]: 'Boëge',
  [Localisation.FILLINGES]: 'Fillinges',
  [Localisation.VIUZ_EN_SALLAZ]: 'Viuz-en-Sallaz',
  [Localisation.SAINT_JEOIRE]: 'Saint-Jeoire',
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

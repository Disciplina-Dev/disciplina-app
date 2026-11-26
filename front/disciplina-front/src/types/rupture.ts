/** Motifs légaux de rupture — liste fermée, identique au backend (`RUPTURE_MOTIFS`). */
export const RUPTURE_MOTIFS = [
  "Rupture pendant les 45 premiers jours en emploi, consécutifs ou non, de l'apprenti, par ce dernier ou l'employeur (art. L. 6222-18)",
  "Rupture d'un commun accord entre l'apprenti et l'employeur — aucune faute ne peut motiver un tel accord (art. L. 6222-18)",
  "Rupture en cas de faute grave ou de manquements répétés à ses obligations, de la part de l'employeur ou de l'apprenti — résiliation prononcée par le Conseil des Prud'hommes ou le juge d'instance (art. L. 6222-18)",
  "Rupture en cas d'inaptitude de l'apprenti à exercer le métier auquel il voulait se préparer, prononcée par le Conseil des Prud'hommes (art. L. 6222-18)",
  "Rupture en cas d'obtention du diplôme ou du titre de l'enseignement technologique préparé par l'apprenti — le contrat peut prendre fin de plein droit à l'initiative de l'apprenti (art. L. 6222-19)",
  "Rupture par décision administrative du directeur départemental du travail, de l'emploi et de la formation professionnelle, consécutive au risque sérieux d'atteinte à la santé ou à l'intégrité physique ou morale de l'apprenti",
  "Rupture par décision motivée du Préfet du département pour méconnaissance des obligations à la charge de l'employeur",
] as const

export interface Rupture {
  id: string
  alternantId: string
  firstName: string | null
  lastName: string | null
  fullName: string
  session: string
  sessionId: string | null
  dateRupture: string
  entreprise: string | null
  motif: string
  detail: string | null
  poursuitFormation: boolean
  createdAt: string | null
  updatedAt: string | null
}

export interface DeclareRuptureInput {
  alternantId: string
  dateRupture: string
  entreprise?: string | null
  motif: string
  detail?: string | null
  poursuitFormation: boolean
}

export interface UpdateRuptureInput {
  dateRupture?: string
  entreprise?: string | null
  motif?: string
  detail?: string | null
  poursuitFormation?: boolean
}

/** Libellé affiché sur la page Ruptures selon la poursuite de formation. */
export function poursuiteLabel(poursuit: boolean): 'Poursuit la formation' | 'Quitte la formation' {
  return poursuit ? 'Poursuit la formation' : 'Quitte la formation'
}

/** « 7 Oct. 2026 » — mois court français avec majuscule initiale. */
export function formatRuptureDate(iso: string): string {
  const raw = new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  return raw.replace(/^(\d{1,2}) ([a-zàâêîôûéèç])/, (_, day: string, first: string) => `${day} ${first.toUpperCase()}`)
}

import type { Region } from '@/store/regionStore'

/**
 * Valeurs substituées dans les documents légaux (`content/legal/*.md`, placeholders
 * `[[CLE]]`). Même société (SARL) pour les deux tenants : seules les valeurs propres
 * à un établissement diffèrent. Toute clé manquante fait échouer `fillLegal` en dev.
 */
export interface LegalProfile {
  NOM_ORGANISME: string
  FORME_JURIDIQUE: string
  CAPITAL: string
  SIRET: string
  RCS: string
  TVA_INTRA: string
  ADRESSE_SIEGE: string
  TELEPHONE: string
  EMAIL_CONTACT: string
  EMAIL_DPO: string
  DIRECTEUR_PUBLICATION: string
  NDA_FORMATION: string
  N_QUALIOPI: string
  HEBERGEUR: string
  HEBERGEUR_ADRESSE: string
  MEDIATEUR_NOM: string
  URL_APP: string
  VERSION_DOC: string
  DATE_MAJ: string
}

const REUNION: LegalProfile = {
  NOM_ORGANISME: 'Disciplina Réunion',
  FORME_JURIDIQUE: 'SARL',
  CAPITAL: '1 000 €',
  SIRET: '978 289 866 00011',
  RCS: '978 289 866 RCS Saint-Denis',
  TVA_INTRA: 'FR71 978 289 866',
  ADRESSE_SIEGE: '71 rue Roger Payet, 97438 Sainte-Marie',
  TELEPHONE: '0693 88 80 21',
  EMAIL_CONTACT: 'contact@disciplina.re',
  EMAIL_DPO: 'contact@disciplina.re',
  DIRECTEUR_PUBLICATION: 'Lorenzo ENCATASSAMY',
  NDA_FORMATION: '04 97 34841 97',
  N_QUALIOPI: '595511-1',
  HEBERGEUR: 'Disciplina Réunion — auto-hébergement (Mac mini + Docker)',
  HEBERGEUR_ADRESSE: '8 rue Pondichéry, 97438 Sainte-Marie',
  MEDIATEUR_NOM: 'Séverine DUGAIN',
  URL_APP: 'https://app-reunion.disciplina.re',
  VERSION_DOC: '2026-09-v1',
  DATE_MAJ: '25 septembre 2026',
}

// Annemasse = établissement de la même société : identité juridique partagée.
// À confirmer (cf. AUDIT_MULTITENANT.md §8.3) : SIRET d'établissement, téléphone, hébergeur.
const ANNEMASSE: LegalProfile = {
  ...REUNION,
}

export const LEGAL_PROFILES: Record<Region, LegalProfile> = {
  reunion: REUNION,
  annemasse: ANNEMASSE,
}

export const DEFAULT_LEGAL_REGION: Region = 'reunion'

export function isLegalRegion(value: string | null): value is Region {
  return value === 'reunion' || value === 'annemasse'
}

/** Remplace `[[CLE]]` ; une clé inconnue reste visible et est signalée en console. */
export function fillLegal(source: string, profile: LegalProfile): string {
  return source.replace(/\[\[([A-Z_]+)\]\]/g, (match, key: string) => {
    const value = (profile as unknown as Record<string, string | undefined>)[key]
    if (value === undefined) {
      console.warn(`[legal] placeholder sans valeur : ${match}`)
      return match
    }
    return value
  })
}

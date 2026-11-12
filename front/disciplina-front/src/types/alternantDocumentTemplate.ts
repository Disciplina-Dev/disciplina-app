import type { AlternantSequenceType } from './alternant'

/** Modèle de document pour une SA (#888). j15/j10w : 2 lignes système permanentes. periodique : créables/supprimables, choisies par Session. */
export interface AlternantDocumentTemplate {
  id: string
  type: AlternantSequenceType
  label: string
  maitreApprentissage: string
  alternant: string
  formateur: string
  createdAt: string | null
  updatedAt: string | null
}

export interface AlternantDocumentTemplateInput {
  label: string
  maitreApprentissage: string
  alternant: string
  formateur: string
}

export interface AlternantSequenceDocumentHeader {
  alternantFullName: string
  session: string | null
  companyName: string | null
  mentorName: string | null
  companyStartDate: string | null
  companyEndDate: string | null
}

/** Les 3 parties d'un document (texte riche), sans en-tête ni signatures. */
export interface AlternantSequenceDocumentParts {
  maitreApprentissage: string | null
  alternant: string | null
  formateur: string | null
}

export interface AlternantSequenceDocument {
  sequenceId: string
  header: AlternantSequenceDocumentHeader
  maitreApprentissage: string | null
  alternant: string | null
  formateur: string | null
  /** Signature dessinée par partie (PNG en data-URL) — usage informel, aucune valeur légale. */
  signatureMaitreApprentissage: string | null
  signatureAlternant: string | null
  signatureFormateur: string | null
  /** `true` si le contenu vient d'un snapshot déjà sauvegardé, `false` si c'est encore le modèle résolu. */
  isSnapshotted: boolean
  /** Contenu brut du modèle résolu, indépendant du snapshot — pour "Réinitialiser au modèle vierge". */
  template: AlternantSequenceDocumentParts | null
}

export interface SaveAlternantSequenceDocumentInput {
  maitreApprentissage: string
  alternant: string
  formateur: string
  signatureMaitreApprentissage?: string | null
  signatureAlternant?: string | null
  signatureFormateur?: string | null
}

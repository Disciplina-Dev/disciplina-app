export type ConflictType =
  | 'missing_siret'
  | 'invalid_siret'
  | 'multiple_commercials_same_siren'
  | 'duplicate_digiforma_siret'
  | 'commercial_mismatch'
  | 'unknown_commercial'

export const CONFLICT_LABELS: Record<ConflictType, string> = {
  missing_siret: 'SIRET manquant',
  invalid_siret: 'SIRET invalide',
  multiple_commercials_same_siren: 'Plusieurs commerciaux sur ce SIREN',
  duplicate_digiforma_siret: 'Doublon SIRET Digiforma',
  commercial_mismatch: 'Commercial incohérent',
  unknown_commercial: 'Commercial inconnu',
}

export function parseConflictType(conclusion: string | null): ConflictType | null {
  if (!conclusion) return null
  const type = conclusion.replace(/^Conflit\s*:\s*/, '').trim()
  return (type in CONFLICT_LABELS ? type : null) as ConflictType | null
}

export function conflictLabel(conclusion: string | null): string {
  const type = parseConflictType(conclusion)
  if (!type) return conclusion?.trim() || 'Conflit'
  return CONFLICT_LABELS[type]
}

interface ConflictTypeConfig {
  /** Le conflit nécessite de choisir explicitement un commercial avant résolution. */
  requiresCommercial: boolean
  /** Le SIRET doit être corrigible (conflit lié au SIRET). */
  siretEditable: boolean
}

const DEFAULT_CONFIG: ConflictTypeConfig = { requiresCommercial: false, siretEditable: true }

export const CONFLICT_TYPE_CONFIG: Record<ConflictType, ConflictTypeConfig> = {
  missing_siret: { requiresCommercial: false, siretEditable: true },
  invalid_siret: { requiresCommercial: false, siretEditable: true },
  duplicate_digiforma_siret: { requiresCommercial: false, siretEditable: true },
  unknown_commercial: { requiresCommercial: true, siretEditable: false },
  commercial_mismatch: { requiresCommercial: true, siretEditable: false },
  multiple_commercials_same_siren: { requiresCommercial: true, siretEditable: false },
}

export function getConflictTypeConfig(conclusion: string | null): ConflictTypeConfig {
  const type = parseConflictType(conclusion)
  return type ? CONFLICT_TYPE_CONFIG[type] : DEFAULT_CONFIG
}

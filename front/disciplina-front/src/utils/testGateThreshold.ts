import { TitleProfessionalType } from '@/types/candidate'

/**
 * Moyenne minimale requise au gate des tests (épreuve écrite + ClassMarker)
 * selon le TP visé : 10 pour CC, 12 pour NTC, REM, AD et SA.
 */
export function gateThresholdForTp(tp: TitleProfessionalType): number {
  return tp === TitleProfessionalType.CC ? 10 : 12
}

/**
 * Seuil applicable à une sélection multi-TP : dès qu'un TP autre que CC est
 * visé, le seuil le plus exigeant (12) s'applique.
 */
export function gateThresholdForTps(tps: TitleProfessionalType[] | undefined | null): number {
  return tps?.some((tp) => tp !== TitleProfessionalType.CC) ? 12 : 10
}

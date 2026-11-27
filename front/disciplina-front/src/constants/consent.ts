/**
 * Consentements candidat — source unique de la version du corpus légal et des
 * libellés affichés par `CandidateFormModal` et `CandidateQuickCreateModal`.
 *
 * `CONSENT_VERSION` doit rester cohérent avec `[[VERSION_DOC]]` dans
 * `src/content/legal/_placeholders.md`. Toute modification de fond d'un libellé
 * impose d'incrémenter cette version.
 *
 * Le backend refuse une version inconnue (GDPR_INF_08.2) : ajouter d'abord la
 * nouvelle version à `ACCEPTED_CONSENT_VERSIONS` (`back/src/services/consentGuard.ts`)
 * et déployer le backend AVANT le front qui l'envoie.
 *
 * Historique :
 * - `2026-08-v1` : libellé `ai_processing` limité au « résumé IA local ».
 * - `2026-11-v2` : `ai_processing` couvre aussi l'assistant IA tiers (MCP),
 *   traitement possible hors UE (GDPR_INF_05.5). Les consentements donnés en
 *   `2026-08-v1` sont conservés tels quels.
 */
export const CONSENT_VERSION = '2026-11-v2'

export const AI_PROCESSING_CONSENT_LABEL =
  "Le candidat accepte que ses données soient traitées par intelligence artificielle : génération d'un résumé de profil par un modèle hébergé localement, et utilisation par l'équipe d'un assistant IA tiers (traitement possible hors Union européenne) pour l'aide au suivi de son dossier et de son parcours en alternance. Ce consentement peut être retiré à tout moment."

/**
 * Destinations légales, partagées par le `Footer` (page de connexion, pages
 * légales) et par `LegalLinks` (bas de sidebar des espaces authentifiés).
 *
 * `label` est volontairement court : `LegalLinks` est rendu dans une sidebar
 * de 256px. `title` porte l'intitulé complet, utilisé tel quel par `Footer`.
 */
export const LEGAL_LINKS = [
  { to: '/legal/mentions', label: 'Mentions', title: 'Mentions légales' },
  { to: '/legal/confidentialite', label: 'Confidentialité', title: 'Politique de confidentialité' },
  { to: '/legal/cgu', label: 'CGU', title: "Conditions d'utilisation" },
  { to: '/legal/cookies', label: 'Cookies', title: 'Politique de cookies' },
] as const

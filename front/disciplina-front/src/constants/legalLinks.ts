/**
 * Destinations légales, partagées par le `Footer` (page de connexion, pages
 * légales) et par `AppFooter` (pied de page des espaces authentifiés).
 *
 * `title` porte l'intitulé complet, affiché par les deux pieds de page ;
 * `label` reste une forme courte, pour les contextes étroits.
 */
export const LEGAL_LINKS = [
  { to: '/legal/mentions', label: 'Mentions', title: 'Mentions légales' },
  { to: '/legal/confidentialite', label: 'Confidentialité', title: 'Politique de confidentialité' },
  { to: '/legal/cgu', label: 'CGU', title: "Conditions d'utilisation" },
  { to: '/legal/cookies', label: 'Cookies', title: 'Politique de cookies' },
] as const

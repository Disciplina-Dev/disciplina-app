/**
 * Pied de page légal des portails accessibles par lien signé (`/public/*`,
 * `/booking/*`). Ces portails sont hors du layout applicatif : ils n'héritent
 * donc pas du `Footer` habituel.
 *
 * Les liens sont volontairement en `<a target="_blank">` et non en `<Link>` :
 * l'utilisateur ne doit pas perdre l'état de son portail (créneau sélectionné,
 * formulaire en cours) en consultant un document légal.
 */
export default function PublicLegalFooter() {
  return (
    <footer className="mt-auto w-full border-t border-gray-100 px-4 py-5 text-center">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-gray-500">
        <a
          href="/legal/mentions"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors hover:text-gray-900"
        >
          Mentions légales
        </a>
        <span aria-hidden="true">·</span>
        <a
          href="/legal/confidentialite"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors hover:text-gray-900"
        >
          Politique de confidentialité
        </a>
        <span aria-hidden="true">·</span>
        <a
          href="/legal/cgu"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors hover:text-gray-900"
        >
          Conditions d'utilisation
        </a>
        <span aria-hidden="true">·</span>
        <a
          href="/legal/cookies"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors hover:text-gray-900"
        >
          Cookies
        </a>
      </div>
      <p className="mx-auto mt-2 max-w-xl text-xs text-gray-300">
        Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et de
        suppression de vos données.
      </p>
    </footer>
  )
}

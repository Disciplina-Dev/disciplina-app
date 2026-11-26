import { Link } from 'react-router-dom'
import { LEGAL_LINKS } from '@/constants/legalLinks'

/**
 * Pied de page des espaces authentifiés.
 *
 * Les espaces sont en `h-screen overflow-hidden` : un pied en flux normal ne
 * serait jamais atteint. Il est donc posé hors de la zone qui défile, en
 * dernier enfant de la colonne de contenu, et garde une hauteur fixe.
 *
 * Il porte le verre dépoli du reste du chrome, pour rester dans la continuité
 * de l'en-tête et de la barre latérale.
 */
export default function AppFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="ds-glass-flush relative z-20 shrink-0 border-t border-[var(--ds-glass-border)] px-6 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <p className="text-[11px] text-[var(--ds-text-subtle)]">
          © {year} Disciplina · Tous droits réservés
        </p>

        <nav aria-label="Informations légales" className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {LEGAL_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              // `title` porte l'intitulé complet, `label` reste court pour
              // tenir sur une seule ligne même en fenêtre étroite.
              title={link.title}
              className="text-[11px] text-[var(--ds-text-subtle)] no-underline transition-colors hover:text-[var(--ds-text)]"
            >
              {link.title}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  )
}

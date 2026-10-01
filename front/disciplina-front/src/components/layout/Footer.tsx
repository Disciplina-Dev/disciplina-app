import { Link } from 'react-router-dom'
import { LEGAL_LINKS } from '@/constants/legalLinks'
import Logo from '@/components/ui/Logo'

const LINK_CLASS =
  'text-xs text-[var(--ds-text-subtle)] transition-colors hover:text-[var(--ds-text)]'

export default function Footer() {
  return (
    <footer className="bg-transparent py-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <Logo className="h-6 opacity-60 dark:opacity-100" />
        <p className="text-xs text-[var(--ds-text-subtle)]">
          © {new Date().getFullYear()} Disciplina. Tous droits réservés.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          {LEGAL_LINKS.map((link) => (
            <Link key={link.to} to={link.to} className={LINK_CLASS}>
              {link.title}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  )
}

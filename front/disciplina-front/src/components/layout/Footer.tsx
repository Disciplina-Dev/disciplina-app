import { Link } from 'react-router-dom'
import { LEGAL_LINKS } from '@/constants/legalLinks'

const LINK_CLASS = 'text-xs text-gray-500 hover:text-gray-900 transition-colors'

export default function Footer() {
  return (
    <footer className="bg-transparent py-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <img src="/logo-disciplina.svg" alt="Disciplina" className="h-6 opacity-60" />
        <p className="text-xs text-gray-300">
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

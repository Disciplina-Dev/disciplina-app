import { Link } from 'react-router-dom'
import { LEGAL_LINKS } from '@/constants/legalLinks'

type Props = {
  /** `dark` pour les sidebars sur fond sombre (EntrepriseLayout). */
  tone?: 'light' | 'dark'
}

const TONE_CLASS = {
  light: 'text-gray-400',
  dark: 'text-gray-500',
}

const LINK_CLASS = {
  light: 'transition-colors hover:text-gray-900',
  dark: 'transition-colors hover:text-gray-200',
}

/**
 * Ligne d'accès aux pages légales pour les espaces authentifiés. Ceux-ci sont
 * en `h-screen overflow-hidden` : un pied de page en flux ne serait jamais
 * visible, d'où ce montage dans le bloc fixe du bas de sidebar.
 */
export default function LegalLinks({ tone = 'light' }: Props) {
  return (
    <nav
      aria-label="Informations légales"
      className={`flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] ${TONE_CLASS[tone]}`}
    >
      {LEGAL_LINKS.map((link, index) => (
        <span key={link.to} className="flex items-center gap-2">
          {index > 0 && <span aria-hidden="true">·</span>}
          <Link to={link.to} title={link.title} className={LINK_CLASS[tone]}>
            {link.label}
          </Link>
        </span>
      ))}
    </nav>
  )
}

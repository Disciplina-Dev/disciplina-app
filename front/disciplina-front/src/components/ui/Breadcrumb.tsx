import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight } from 'lucide-react'

export interface Crumb {
  label: string
  /** Lien de navigation. Absent = segment courant (non cliquable). */
  to?: string
}

interface Props {
  items: Crumb[]
  /**
   * Cible de la flèche retour. Par défaut : navigation historique (-1).
   * Fournir un chemin explicite pour un retour déterministe.
   */
  backTo?: string
  className?: string
}

/**
 * Fil d'Ariane + flèche de retour, réutilisable sur toutes les interfaces.
 * Respecte la charte : accent `blue`, texte gris, coins arrondis.
 */
export default function Breadcrumb({ items, backTo, className }: Props) {
  const navigate = useNavigate()

  const goBack = () => {
    if (backTo) navigate(backTo)
    else navigate(-1)
  }

  return (
    <div className={`flex items-center gap-3 ${className ?? ''}`}>
      <button
        type="button"
        onClick={goBack}
        aria-label="Retour"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-gray-100 bg-white text-gray-500 transition-colors hover:border-blue hover:text-blue"
      >
        <ArrowLeft size={16} />
      </button>

      <nav aria-label="Fil d'Ariane" className="min-w-0">
        <ol className="flex items-center gap-1.5 text-sm">
          {items.map((crumb, i) => {
            const last = i === items.length - 1
            return (
              <li key={`${crumb.label}-${i}`} className="flex items-center gap-1.5 min-w-0">
                {crumb.to && !last ? (
                  <Link
                    to={crumb.to}
                    className="truncate text-gray-500 no-underline transition-colors hover:text-blue"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    className={`truncate ${last ? 'font-semibold text-gray-900' : 'text-gray-500'}`}
                    aria-current={last ? 'page' : undefined}
                  >
                    {crumb.label}
                  </span>
                )}
                {!last && <ChevronRight size={14} className="shrink-0 text-gray-300" />}
              </li>
            )
          })}
        </ol>
      </nav>
    </div>
  )
}

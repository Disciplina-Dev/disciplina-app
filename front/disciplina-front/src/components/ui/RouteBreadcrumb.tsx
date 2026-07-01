import { useMatches, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight } from 'lucide-react'

/** Signature d'un libellé dynamique (ex: dépend d'un :param). */
export type CrumbResolver = (match: {
  params: Record<string, string | undefined>
  pathname: string
}) => string

export interface RouteHandle {
  /** Libellé du fil d'Ariane pour cette route. */
  crumb?: string | CrumbResolver
}

/**
 * Fil d'Ariane + flèche retour, alimenté par les `handle.crumb` des routes
 * (React Router `useMatches`). Aucun code par page : il suffit de déclarer
 * `handle: { crumb: '…' }` sur chaque route.
 */
export default function RouteBreadcrumb({ accent }: { accent?: string }) {
  const matches = useMatches()
  const navigate = useNavigate()

  const crumbs = matches
    .filter((m) => (m.handle as RouteHandle | undefined)?.crumb)
    .map((m) => {
      const crumb = (m.handle as RouteHandle).crumb!
      const label =
        typeof crumb === 'function'
          ? crumb({ params: m.params, pathname: m.pathname })
          : crumb
      return { label, to: m.pathname }
    })

  if (crumbs.length === 0) return null

  // Retour → avant-dernier crumb, sinon historique.
  const parent = crumbs.length > 1 ? crumbs[crumbs.length - 2].to : null
  const goBack = () => (parent ? navigate(parent) : navigate(-1))

  const accentStyle = accent ? { color: accent } : undefined

  return (
    <div className="flex items-center gap-3 min-w-0">
      <button
        type="button"
        onClick={goBack}
        aria-label="Retour"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-gray-100 bg-white text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-900"
      >
        <ArrowLeft size={16} />
      </button>

      <nav aria-label="Fil d'Ariane" className="min-w-0">
        <ol className="flex items-center gap-1.5 text-sm">
          {crumbs.map((crumb, i) => {
            const last = i === crumbs.length - 1
            return (
              <li key={`${crumb.to}-${i}`} className="flex items-center gap-1.5 min-w-0">
                {last ? (
                  <span
                    className="truncate font-semibold"
                    style={accentStyle}
                    aria-current="page"
                  >
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    to={crumb.to}
                    className="truncate text-gray-500 no-underline transition-colors hover:text-gray-900"
                  >
                    {crumb.label}
                  </Link>
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

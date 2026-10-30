import type { ReactNode } from 'react'

/**
 * Cadre commun des pages publiques de l'émargement (lien formateur, QR
 * alternant). Même gabarit que les autres portails publics : fond neutre,
 * carte centrale, mentions légales en pied via `PublicPortalLayout`.
 */
export default function PublicShell({
  children,
  width = 'wide',
}: {
  children: ReactNode
  width?: 'narrow' | 'wide'
}) {
  const max = width === 'narrow' ? 'max-w-lg' : 'max-w-5xl'
  return (
    <div className="flex-1 bg-[var(--ds-surface-sunken)] pb-16">
      <div className={`mx-auto min-h-screen ${max} bg-[var(--ds-surface)] sm:border-x sm:border-[var(--ds-border)]`}>
        {children}
      </div>
    </div>
  )
}

import type { ReactNode } from 'react'
import Logo from '@/components/ui/Logo'

/**
 * Cadre commun des pages publiques de l'émargement (lien formateur, QR
 * alternant). Même gabarit que les autres portails publics : fond neutre,
 * carte centrale, mentions légales en pied via `PublicPortalLayout`.
 *
 * L'en-tête porte l'identité de l'organisme (logo + nom) : c'est une exigence
 * de la feuille d'émargement (nom de l'organisme avec le logo Disciplina), et
 * c'est ce même bloc qui sera repris en tête des exports PDF.
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
        <header className="flex items-center gap-3 border-b border-[var(--ds-border)] px-5 py-4 sm:px-8">
          <Logo className="h-8 w-8" variant="mark" />
          <div className="min-w-0">
            <p className="text-[15px] font-extrabold leading-none tracking-tight text-[var(--ds-text)]">Disciplina</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ds-text-subtle)]">
              Organisme de formation
            </p>
          </div>
        </header>
        {children}
      </div>
    </div>
  )
}

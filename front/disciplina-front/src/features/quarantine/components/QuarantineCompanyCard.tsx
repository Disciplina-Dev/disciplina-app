import { IconHash, IconMail, IconMapPin, IconMessage, IconPhone, IconTools, IconTrash, IconWarning } from '@/components/ui/icons'
import { useState } from 'react'
import type { EntrepriseConflit } from '@/types/entreprise'
import { Permission, type AppUser } from '@/store/authStore'
import { useDeleteCompanyConflict } from '@/graphql/hooks'
import { conflictLabel } from '../conflictTypes'
import ConflictResolverModal from './ConflictResolverModal'

interface Props {
  entreprise: EntrepriseConflit
  currentUser: AppUser
}

export default function QuarantineCompanyCard({ entreprise, currentUser }: Props) {
  const { deleteCompanyConflict, result: deleteResult } = useDeleteCompanyConflict()
  const [isResolving, setIsResolving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canResolve =
    currentUser.permission === Permission.RESPONSABLE || currentUser.permission === Permission.ADMIN

  const displayName = entreprise.nom_commercial || entreprise.representant_legal || entreprise.siret || 'Entreprise sans nom'

  const handleDelete = async () => {
    if (!window.confirm(`Supprimer définitivement « ${displayName} » de la quarantaine ?`)) return
    setError(null)
    const response = await deleteCompanyConflict(Number(entreprise.id))
    if (response.error) {
      setError(response.error.message)
    }
  }

  return (
    <article className="group relative flex flex-col rounded-xl bg-[var(--ds-surface)] border border-[var(--ds-border)] transition-all duration-200">
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <h4 className="text-[15px] font-semibold leading-snug text-[var(--ds-text)] line-clamp-2">
              {displayName}
            </h4>
            {entreprise.secteur && (
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-blue-light px-2 py-0.5 text-[11px] font-medium text-blue">
                <IconMapPin className="h-3 w-3" />
                {entreprise.secteur}
              </span>
            )}
          </div>
          <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium bg-[var(--ds-warning-bg)] text-[var(--ds-warning)] ring-1 ring-warning/20">
            <IconWarning className="h-3 w-3" />
            {conflictLabel(entreprise.conclusion)}
          </span>
        </div>

        <div className="space-y-2">
          {entreprise.telephone && (
            <div className="flex items-center gap-2">
              <IconPhone className="h-3.5 w-3.5 shrink-0 text-[var(--ds-text-subtle)]" />
              <span className="text-[13px] text-[var(--ds-text-muted)] truncate">{entreprise.telephone}</span>
            </div>
          )}
          {entreprise.email && (
            <div className="flex items-center gap-2">
              <IconMail className="h-3.5 w-3.5 shrink-0 text-[var(--ds-text-subtle)]" />
              <span className="text-[13px] text-[var(--ds-text-muted)] truncate">{entreprise.email}</span>
            </div>
          )}
        </div>
      </div>

      {entreprise.note?.trim() && (
        <div className="mx-3 mb-3 rounded-lg bg-[var(--ds-surface-sunken)] border border-[var(--ds-border)] px-3.5 py-3">
          <div className="flex gap-2.5">
            <IconMessage className="h-3.5 w-3.5 shrink-0 text-[var(--ds-text-subtle)] mt-[1px]" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ds-text-subtle)] mb-0.5">
                Détail du conflit
              </p>
              <p className="text-[13px] leading-relaxed text-[var(--ds-text-muted)] line-clamp-3">{entreprise.note}</p>
            </div>
          </div>
        </div>
      )}

      <div className="px-5 pb-4 mt-auto flex flex-col gap-2">
        {entreprise.siret && (
          <div className="flex items-center gap-1.5 pt-1 border-t border-[var(--ds-border)]">
            <IconHash className="h-3 w-3 text-[var(--ds-text-subtle)]" />
            <span className="text-[11px] font-mono text-[var(--ds-text-subtle)] tracking-wide">{entreprise.siret}</span>
          </div>
        )}

        {canResolve && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setIsResolving(true)}
              className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 rounded-lg border border-blue/20 bg-blue-light px-3 py-2 text-[12px] font-semibold text-blue hover:bg-blue hover:text-white transition-all"
            >
              <IconTools className="h-3.5 w-3.5" />
              Résoudre
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteResult.fetching}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-danger/20 px-3 py-2 text-[12px] font-semibold text-[var(--ds-danger)] hover:bg-[var(--ds-danger-bg)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <IconTrash className="h-3.5 w-3.5" />
              Supprimer
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-danger/20 bg-[var(--ds-danger-bg)] px-3 py-2 text-xs text-[var(--ds-danger)]">{error}</div>
        )}
      </div>

      {isResolving && (
        <ConflictResolverModal entreprise={entreprise} onClose={() => setIsResolving(false)} />
      )}
    </article>
  )
}

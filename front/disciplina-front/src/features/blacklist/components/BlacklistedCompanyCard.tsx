import { IconHash, IconMail, IconMapPin, IconMessage, IconPhone, IconShieldOff, IconUndo } from '@/components/ui/icons'
import { useState } from 'react'
import type { EntrepriseBlacklistee } from '@/types/entreprise'
import { Permission, type AppUser } from '@/store/authStore'
import { useUnblacklistCompany } from '@/graphql/hooks'

interface Props {
  entreprise: EntrepriseBlacklistee
  currentUser: AppUser
}

export default function BlacklistedCompanyCard({ entreprise, currentUser }: Props) {
  const { unblacklistCompany, result } = useUnblacklistCompany()
  const [error, setError] = useState<string | null>(null)

  const canUnblacklist =
    currentUser.permission === Permission.RESPONSABLE || currentUser.permission === Permission.ADMIN

  const handleUnblacklist = async () => {
    setError(null)
    const response = await unblacklistCompany(Number(entreprise.id))
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
              {entreprise.nom_commercial ?? '—'}
            </h4>
            {entreprise.secteur && (
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-blue-light px-2 py-0.5 text-[11px] font-medium text-blue">
                <IconMapPin className="h-3 w-3" />
                {entreprise.secteur}
              </span>
            )}
          </div>
          <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium bg-[var(--ds-danger-bg)] text-[var(--ds-danger)] ring-1 ring-danger/20">
            <IconShieldOff className="h-3 w-3" />
            Blacklistée
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

      {entreprise.all_blacklist && (
        <div className="mx-3 mb-2">
          <span className="inline-flex items-center text-[11px] font-semibold py-1 px-2 rounded-full bg-[var(--ds-danger-bg)] text-[var(--ds-danger)]">
            Toute l'unité légale bannie
          </span>
        </div>
      )}

      {entreprise.conclusion?.trim() && (
        <div className="mx-3 mb-3 rounded-lg bg-[var(--ds-surface-sunken)] border border-[var(--ds-border)] px-3.5 py-3">
          <div className="flex gap-2.5">
            <IconMessage className="h-3.5 w-3.5 shrink-0 text-[var(--ds-text-subtle)] mt-[1px]" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ds-text-subtle)] mb-0.5">
                Motif du bannissement
              </p>
              <p className="text-[13px] leading-relaxed text-[var(--ds-text-muted)] line-clamp-3">{entreprise.conclusion}</p>
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

        {canUnblacklist && (
          <button
            onClick={handleUnblacklist}
            disabled={result.fetching}
            className={[
              'w-full flex items-center justify-center gap-1.5 rounded-lg',
              'border border-blue/20 bg-blue-light py-2',
              'text-[12px] font-semibold text-blue',
              'transition-all duration-150 hover:bg-blue hover:text-white hover:border-blue',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            ].join(' ')}
          >
            <IconUndo className="h-3.5 w-3.5" />
            Débannir
          </button>
        )}

        {error && (
          <div className="rounded-xl border border-danger/20 bg-[var(--ds-danger-bg)] px-3 py-2 text-xs text-[var(--ds-danger)]">{error}</div>
        )}
      </div>
    </article>
  )
}

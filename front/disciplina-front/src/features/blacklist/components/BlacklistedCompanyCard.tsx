import { Phone, Mail, MapPin, MessageSquare, Hash, ShieldOff, Undo2 } from 'lucide-react'
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
    <article className="group relative flex flex-col rounded-xl bg-white border border-gray-100 transition-all duration-200">
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <h4 className="text-[15px] font-semibold leading-snug text-gray-900 line-clamp-2">
              {entreprise.nom_commercial ?? '—'}
            </h4>
            {entreprise.secteur && (
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-blue-light px-2 py-0.5 text-[11px] font-medium text-blue">
                <MapPin className="h-3 w-3" />
                {entreprise.secteur}
              </span>
            )}
          </div>
          <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium bg-danger-bg text-danger ring-1 ring-danger/20">
            <ShieldOff className="h-3 w-3" />
            Blacklistée
          </span>
        </div>

        <div className="space-y-2">
          {entreprise.telephone && (
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 shrink-0 text-gray-300" />
              <span className="text-[13px] text-gray-600 truncate">{entreprise.telephone}</span>
            </div>
          )}
          {entreprise.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 shrink-0 text-gray-300" />
              <span className="text-[13px] text-gray-600 truncate">{entreprise.email}</span>
            </div>
          )}
        </div>
      </div>

      {entreprise.all_blacklist && (
        <div className="mx-3 mb-2">
          <span className="inline-flex items-center text-[11px] font-semibold py-1 px-2 rounded-full bg-danger-bg text-danger">
            Toute l'unité légale bannie
          </span>
        </div>
      )}

      {entreprise.conclusion?.trim() && (
        <div className="mx-3 mb-3 rounded-lg bg-gray-50 border border-gray-100 px-3.5 py-3">
          <div className="flex gap-2.5">
            <MessageSquare className="h-3.5 w-3.5 shrink-0 text-gray-300 mt-[1px]" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                Motif du bannissement
              </p>
              <p className="text-[13px] leading-relaxed text-gray-600 line-clamp-3">{entreprise.conclusion}</p>
            </div>
          </div>
        </div>
      )}

      <div className="px-5 pb-4 mt-auto flex flex-col gap-2">
        {entreprise.siret && (
          <div className="flex items-center gap-1.5 pt-1 border-t border-gray-100">
            <Hash className="h-3 w-3 text-gray-200" />
            <span className="text-[11px] font-mono text-gray-300 tracking-wide">{entreprise.siret}</span>
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
            <Undo2 className="h-3.5 w-3.5" />
            Débannir
          </button>
        )}

        {error && (
          <div className="rounded-xl border border-danger/20 bg-danger-bg px-3 py-2 text-xs text-danger">{error}</div>
        )}
      </div>
    </article>
  )
}

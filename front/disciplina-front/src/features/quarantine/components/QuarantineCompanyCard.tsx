import { Phone, Mail, MapPin, MessageSquare, Hash, AlertTriangle, Wrench, Trash2 } from 'lucide-react'
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
    <article className="group relative flex flex-col rounded-xl bg-white border border-gray-100 transition-all duration-200">
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <h4 className="text-[15px] font-semibold leading-snug text-gray-900 line-clamp-2">
              {displayName}
            </h4>
            {entreprise.secteur && (
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-blue-light px-2 py-0.5 text-[11px] font-medium text-blue">
                <MapPin className="h-3 w-3" />
                {entreprise.secteur}
              </span>
            )}
          </div>
          <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium bg-warning-bg text-warning ring-1 ring-warning/20">
            <AlertTriangle className="h-3 w-3" />
            {conflictLabel(entreprise.conclusion)}
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

      {entreprise.note?.trim() && (
        <div className="mx-3 mb-3 rounded-lg bg-gray-50 border border-gray-100 px-3.5 py-3">
          <div className="flex gap-2.5">
            <MessageSquare className="h-3.5 w-3.5 shrink-0 text-gray-300 mt-[1px]" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                Détail du conflit
              </p>
              <p className="text-[13px] leading-relaxed text-gray-600 line-clamp-3">{entreprise.note}</p>
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

        {canResolve && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setIsResolving(true)}
              className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 rounded-lg border border-blue/20 bg-blue-light px-3 py-2 text-[12px] font-semibold text-blue hover:bg-blue hover:text-white transition-all"
            >
              <Wrench className="h-3.5 w-3.5" />
              Résoudre
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteResult.fetching}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-danger/20 px-3 py-2 text-[12px] font-semibold text-danger hover:bg-danger-bg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Supprimer
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-danger/20 bg-danger-bg px-3 py-2 text-xs text-danger">{error}</div>
        )}
      </div>

      {isResolving && (
        <ConflictResolverModal entreprise={entreprise} onClose={() => setIsResolving(false)} />
      )}
    </article>
  )
}

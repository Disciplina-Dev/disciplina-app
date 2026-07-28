import { Building2, ChevronRight, UserPlus } from 'lucide-react'
import type { Entreprise, SirenGroup } from '@/types/entreprise'
import type { AppUser } from '@/store/authStore'
import { formatSiren } from '@/types/sourcing'
import { STATUS_CONFIG } from './statusConfig'

interface Props {
  group: SirenGroup
  currentUser: AppUser
  onOpen: (entreprise: Entreprise) => void
  onClaim: (entreprise: Entreprise) => void
}

interface RowProps {
  entreprise: Entreprise
  currentUser: AppUser
  onOpen: (entreprise: Entreprise) => void
  onClaim: (entreprise: Entreprise) => void
}

function canClaimEntreprise(entreprise: Entreprise, currentUser: AppUser): boolean {
  if (entreprise.proprietaire_id) return false
  const role = currentUser.role?.toUpperCase()
  return role === 'COMMERCIAL' || role === 'RESPONSABLE' || role === 'ADMIN'
}

function EstablishmentRow({ entreprise, currentUser, onOpen, onClaim }: RowProps) {
  const status = STATUS_CONFIG[entreprise.status] ?? STATUS_CONFIG['Non']
  const showClaim = canClaimEntreprise(entreprise, currentUser)

  const handleClaim = (e: React.MouseEvent) => {
    e.stopPropagation()
    onClaim(entreprise)
  }

  return (
    <div
      onClick={() => onOpen(entreprise)}
      className="group/row flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors hover:bg-blue-light/40"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-gray-900 truncate group-hover/row:text-blue">
          {entreprise.nom_commercial ?? '—'}
        </p>
        {entreprise.adresse && (
          <p className="text-[11px] text-gray-400 truncate">{entreprise.adresse}</p>
        )}
      </div>

      <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${status.pill}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
        {status.label}
      </span>

      <span className="shrink-0 w-24 text-right text-[12px] truncate">
        {entreprise.commercial ? (
          <span className="text-gray-600">{entreprise.commercial}</span>
        ) : (
          <span className="italic text-gray-300">Non attribué</span>
        )}
      </span>

      {showClaim ? (
        <button
          onClick={handleClaim}
          title="Récupérer le dossier"
          className="shrink-0 flex h-6 w-6 items-center justify-center rounded-md text-blue transition-colors hover:bg-blue hover:text-white"
        >
          <UserPlus className="h-3.5 w-3.5" />
        </button>
      ) : (
        <ChevronRight className="shrink-0 h-4 w-4 text-gray-300 group-hover/row:text-blue" />
      )}
    </div>
  )
}

export function SirenGroupCard({ group, currentUser, onOpen, onClaim }: Props) {
  const raisonSociale = group.entreprises[0]?.nom_commercial ?? '—'

  return (
    <article className="flex flex-col rounded-xl bg-white border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-gray-100">
        <h4 className="text-[15px] font-semibold text-gray-900 truncate">{raisonSociale}</h4>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-400">
          <span className="font-mono tracking-wide">SIREN {formatSiren(group.siren)}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-500">
            <Building2 className="h-3 w-3" />
            {group.count} établissement{group.count > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {group.entreprises.map((entreprise) => (
          <EstablishmentRow
            key={entreprise.id}
            entreprise={entreprise}
            currentUser={currentUser}
            onOpen={onOpen}
            onClaim={onClaim}
          />
        ))}
      </div>
    </article>
  )
}

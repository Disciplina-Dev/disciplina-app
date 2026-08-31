import { CalendarDays, KeyRound, User } from 'lucide-react'
import type { ExternalAccessRowData } from '@/api/externalAccess'
import {
  EXTERNAL_ACCESS_STATUS_BADGE,
  EXTERNAL_ACCESS_STATUS_LABELS,
  EXTERNAL_ACCESS_TYPE_BADGE,
  EXTERNAL_ACCESS_TYPE_LABELS,
  EXTERNAL_REFERENCE_LABELS,
} from '@/constants/externalAccess'
import ExternalReferenceButton from './ExternalReferenceButton'
import ExternalRegenerateButton from './ExternalRegenerateButton'
import ExternalRevokeButton from './ExternalRevokeButton'

interface ExternalAccessRowProps {
  access: ExternalAccessRowData
  onChanged: () => void
}

// Une ligne représentant un accès externe : signature (6 premiers chiffres),
// nom (entreprise/candidat), type, statut, référence et date de création.
export default function ExternalAccessRow({ access, onChanged }: ExternalAccessRowProps) {
  const signatureShort = access.signature.slice(0, 6)
  const canRegenerate = access.status === 'LOCKED' || access.status === 'EXPIRED'
  const canRevoke = access.status !== 'COMPLETED'

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-700">
              <KeyRound size={12} />
              {signatureShort}…
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider ${EXTERNAL_ACCESS_STATUS_BADGE[access.status]}`}>
              {EXTERNAL_ACCESS_STATUS_LABELS[access.status]}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-900">
              <User size={14} className="text-gray-400" />
              {access.external_first_name || '—'}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${EXTERNAL_ACCESS_TYPE_BADGE[access.external_type]}`}>
              {EXTERNAL_ACCESS_TYPE_LABELS[access.external_type]}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ExternalReferenceButton referenceId={access.reference_id} referenceKey={access.reference_key} />
          <ExternalRegenerateButton signature={access.signature} allowed={canRegenerate} onRegenerated={onChanged} />
          <ExternalRevokeButton signature={access.signature} allowed={canRevoke} onRevoked={onChanged} />
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1">
          <CalendarDays size={13} className="text-gray-400" />
          Créé le {access.created_at ? new Date(access.created_at).toLocaleDateString('fr-FR') : '—'}
        </span>
        <span>Référence : {EXTERNAL_REFERENCE_LABELS[access.reference_id] ?? access.reference_id}</span>
      </div>
    </div>
  )
}

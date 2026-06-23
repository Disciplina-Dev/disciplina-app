import { useState } from 'react'
import { X, PhoneCall } from 'lucide-react'
import Button from '@/components/ui/Button'
import { useCreateContactLog, useUpdateCompany } from '@/graphql/hooks'
import type { Entreprise, EntrepriseStatus } from '@/types/entreprise'
import { STATUS_VALUES } from '@/types/entreprise'
import { RELANCE_TYPES, computeRelanceDate } from '@/types/relance'

interface Props {
  entreprise: Entreprise
  onClose: () => void
  onSuccess: () => void
}

const MAX_LENGTH = 2000

const FIELD = 'w-full rounded-[10px] border border-gray-100 bg-white py-2.5 px-4 text-sm text-gray-900 outline-none transition-colors focus:border-blue'

export default function ContactLogModal({ entreprise, onClose, onSuccess }: Props) {
  const { createContactLog, result } = useCreateContactLog()
  const { update } = useUpdateCompany()

  const [comment, setComment] = useState('')
  const [status, setStatus] = useState<EntrepriseStatus>(entreprise.status)
  const [typeRelance, setTypeRelance] = useState<number | null>(entreprise.type_relance ?? null)
  const [dateRelance, setDateRelance] = useState<string>(entreprise.date_relance ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const canConfirm = comment.trim().length > 0

  const handleConfirm = async () => {
    if (!canConfirm) return
    setError(null)
    setSaving(true)

    // 1) Enregistre la prise de contact (commentaire obligatoire).
    const logRes = await createContactLog(Number(entreprise.id), comment.trim())
    if (logRes.error) {
      setError(logRes.error.message)
      setSaving(false)
      return
    }

    // 2) Applique uniquement les champs réellement modifiés sur la fiche.
    const patch: Record<string, unknown> = {}
    if (status !== entreprise.status) patch.status = status
    if ((typeRelance ?? null) !== (entreprise.type_relance ?? null)) patch.relanceType = typeRelance
    if ((dateRelance || null) !== (entreprise.date_relance ?? null)) patch.relanceDate = dateRelance || null

    if (Object.keys(patch).length > 0) {
      const updRes = await update(Number(entreprise.id), patch)
      if (updRes.error) {
        setError(updRes.error.message)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-light">
              <PhoneCall className="h-5 w-5 text-blue" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Prise de contact</h2>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            Enregistrer un appel avec <strong>{entreprise.nom_commercial ?? 'cette entreprise'}</strong>.
            Le commentaire est obligatoire ; le statut et la relance sont optionnels.
          </p>

          {/* Commentaire (= prise de contact) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="contact-comment">Commentaire *</label>
            <textarea
              id="contact-comment"
              rows={4}
              maxLength={MAX_LENGTH}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Résumé de l'échange, suite à donner…"
              className={`${FIELD} resize-none`}
            />
            <span className="text-xs text-gray-400 self-end">{comment.length}/{MAX_LENGTH}</span>
          </div>

          {/* Statut (optionnel) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="contact-status">Statut</label>
            <select
              id="contact-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as EntrepriseStatus)}
              className={`${FIELD} cursor-pointer`}
            >
              {STATUS_VALUES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Relance (optionnel) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700" htmlFor="contact-relance-type">Type de relance</label>
              <select
                id="contact-relance-type"
                value={typeRelance ?? ''}
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : null
                  setTypeRelance(id)
                  if (id) setDateRelance(computeRelanceDate(id))
                }}
                className={`${FIELD} cursor-pointer`}
              >
                <option value="">— Aucun —</option>
                {RELANCE_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700" htmlFor="contact-relance-date">Date de relance</label>
              <input
                id="contact-relance-date"
                type="date"
                value={dateRelance}
                onChange={(e) => setDateRelance(e.target.value)}
                className={FIELD}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-danger/20 bg-danger-bg px-4 py-2.5 text-sm text-danger">{error}</div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-6 pt-4 border-t border-gray-100">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button variant="primary" disabled={!canConfirm} isLoading={saving || result.fetching} onClick={handleConfirm}>
            Enregistrer l'appel
          </Button>
        </div>
      </div>
    </div>
  )
}

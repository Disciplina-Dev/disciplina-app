import { useState } from 'react'
import { X, PhoneCall } from 'lucide-react'
import Button from '@/components/ui/Button'
import { useCreateContactLog } from '@/graphql/hooks'

interface Props {
  companyID: number
  companyName?: string | null
  onClose: () => void
  onSuccess: () => void
}

const MAX_LENGTH = 2000

export default function ContactLogModal({ companyID, companyName, onClose, onSuccess }: Props) {
  const { createContactLog, result } = useCreateContactLog()
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)

  const canConfirm = comment.trim().length > 0

  const handleConfirm = async () => {
    if (!canConfirm) return
    setError(null)
    const response = await createContactLog(companyID, comment.trim())
    if (response.error) {
      setError(response.error.message)
      return
    }
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
            Enregistrer un appel avec <strong>{companyName ?? 'cette entreprise'}</strong>. Le commentaire est obligatoire.
          </p>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="contact-comment">
              Commentaire *
            </label>
            <textarea
              id="contact-comment"
              rows={4}
              maxLength={MAX_LENGTH}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Résumé de l'échange, suite à donner…"
              className="w-full rounded-[10px] border border-gray-100 bg-white py-2.5 px-4 text-sm text-gray-900 outline-none transition-colors focus:border-blue resize-none"
            />
            <span className="text-xs text-gray-400 self-end">{comment.length}/{MAX_LENGTH}</span>
          </div>

          {error && (
            <div className="rounded-xl border border-danger/20 bg-danger-bg px-4 py-2.5 text-sm text-danger">{error}</div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-6 pt-4 border-t border-gray-100">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button variant="primary" disabled={!canConfirm} isLoading={result.fetching} onClick={handleConfirm}>
            Enregistrer l'appel
          </Button>
        </div>
      </div>
    </div>
  )
}

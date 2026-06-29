import { useState } from 'react'
import { Phone, X } from 'lucide-react'
import Button from '@/components/ui/Button'

// Relance téléphonique : le commercial saisit un résumé de l'appel. À la validation,
// la relance est historisée et l'entreprise sort de la liste.
interface Props {
  companyName: string
  onConfirm: (note: string) => Promise<void>
  onClose: () => void
}

export default function PhoneRelanceModal({ companyName, onConfirm, onClose }: Props) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    if (!note.trim()) {
      setError("Saisissez un résumé de l'appel.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onConfirm(note.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <Phone size={16} className="text-blue" /> Relance téléphonique
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <div className="flex flex-col gap-3 px-6 py-5">
          <p className="text-sm text-gray-500">{companyName}</p>
          <label className="text-sm font-medium text-gray-700">Résumé de l'appel</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={5}
            placeholder="Ce qui a été dit, prochaine étape…"
            className="w-full rounded-[10px] border border-gray-100 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={onClose}>Annuler</Button>
            <Button size="sm" isLoading={saving} onClick={handleConfirm}>Enregistrer la relance</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

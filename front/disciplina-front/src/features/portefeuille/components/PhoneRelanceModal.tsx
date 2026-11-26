import { useState } from 'react'
import { IconClose, IconPhone } from '@/components/ui/icons'
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
      <div className="w-full max-w-md rounded-2xl bg-[var(--ds-surface)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--ds-border)] px-6 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--ds-text)]">
            <IconPhone width={16} height={16} className="text-blue" /> Relance téléphonique
          </h2>
          <button onClick={onClose} className="text-[var(--ds-text-subtle)] hover:text-[var(--ds-text-muted)]">
            <IconClose width={20} height={20} />
          </button>
        </div>
        <div className="flex flex-col gap-3 px-6 py-5">
          <p className="text-sm text-[var(--ds-text-subtle)]">{companyName}</p>
          <label className="text-sm font-medium text-[var(--ds-text-muted)]">Résumé de l'appel</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={5}
            placeholder="Ce qui a été dit, prochaine étape…"
            className="w-full rounded-[10px] border border-[var(--ds-border)] bg-[var(--ds-surface)] px-4 py-2.5 text-sm text-[var(--ds-text)] outline-none focus:border-blue"
          />
          {error && <p className="text-xs text-[var(--ds-danger)]">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={onClose}>Annuler</Button>
            <Button size="sm" isLoading={saving} onClick={handleConfirm}>Enregistrer la relance</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

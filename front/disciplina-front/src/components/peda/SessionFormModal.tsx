import { useState } from 'react'
import { IconClose, IconTraining } from '@/components/ui/icons'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
import { createSession, updateSession } from '@/api/sessions'
import { JOURS_COURS, type Session } from '@/types/session'

interface SessionFormModalProps {
  /** Mode édition : pré-remplit le formulaire. */
  initial?: Session
  onClose: () => void
  onSaved?: (session: Session) => void
}

export default function SessionFormModal({ initial, onClose, onSaved }: SessionFormModalProps) {
  const isEdit = Boolean(initial)
  const [nom, setNom] = useState(initial?.nom ?? '')
  const [filiere, setFiliere] = useState(initial?.filiere ?? '')
  const [jourCours, setJourCours] = useState(initial?.jourCours ?? '')
  const [dateDebut, setDateDebut] = useState(initial?.dateDebut ? initial.dateDebut.slice(0, 10) : '')
  const [dateFin, setDateFin] = useState(initial?.dateFin ? initial.dateFin.slice(0, 10) : '')

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e?: { preventDefault: () => void }) {
    e?.preventDefault()
    setError(null)
    if (!nom.trim()) {
      setError('Le nom de la session est obligatoire.')
      return
    }
    if (!dateDebut) {
      setError('La date de début est obligatoire.')
      return
    }
    if (!dateFin) {
      setError('La date de fin est obligatoire.')
      return
    }
    if (dateFin < dateDebut) {
      setError('La date de fin doit être postérieure à la date de début.')
      return
    }

    setLoading(true)
    try {
      const payload = {
        nom: nom.trim(),
        filiere: filiere.trim() || null,
        jourCours: jourCours || null,
        dateDebut,
        dateFin,
      }
      const saved = isEdit && initial
        ? await updateSession(initial.id, payload)
        : await createSession(payload)
      if (!saved) throw new Error('Enregistrement échoué')
      onSaved?.(saved)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l’enregistrement')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[var(--ds-text)] backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-[var(--ds-surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--ds-border)] px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ds-text)]">
            <IconTraining width={20} height={20} className="text-teal-700" />
            {isEdit ? 'Modifier la session' : 'Nouvelle session'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-full p-1.5 text-[var(--ds-text-subtle)] hover:bg-[var(--ds-surface-sunken)]"
          >
            <IconClose width={18} height={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <InputField
            id="session-nom"
            label="Nom de la session"
            required
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Ex : BTS MCO 2025 Groupe A"
          />
          <InputField
            id="session-filiere"
            label="Filière"
            value={filiere}
            onChange={(e) => setFiliere(e.target.value)}
            placeholder="Ex : Management Commercial"
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="session-jour" className="text-[13px] font-semibold text-[var(--ds-text-muted)]">
              Jour de cours
            </label>
            <select
              id="session-jour"
              value={jourCours}
              onChange={(e) => setJourCours(e.target.value)}
              className="w-full rounded-[var(--radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface)] py-2.5 pl-4 pr-4 text-sm text-[var(--ds-text)] outline-none transition-[border-color,box-shadow] duration-150 focus:border-[var(--ds-accent)] focus:ring-2 focus:ring-[var(--ds-accent)]/15"
            >
              <option value="">— Choisir un jour —</option>
              {JOURS_COURS.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InputField
              id="session-debut"
              label="Date de début"
              type="date"
              required
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
            />
            <InputField
              id="session-fin"
              label="Date de fin"
              type="date"
              required
              value={dateFin}
              min={dateDebut || undefined}
              onChange={(e) => setDateFin(e.target.value)}
            />
          </div>

          {error && (
            <p className="rounded-xl border border-[var(--ds-danger)]/30 bg-[var(--ds-danger-bg)] px-4 py-3 text-sm text-[var(--ds-danger)]">
              {error}
            </p>
          )}
        </form>

        <div className="flex justify-end gap-2 border-t border-[var(--ds-border)] px-6 py-4">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={loading} loadingLabel="Enregistrement">
            {isEdit ? 'Enregistrer' : 'Créer la session'}
          </Button>
        </div>
      </div>
    </div>
  )
}

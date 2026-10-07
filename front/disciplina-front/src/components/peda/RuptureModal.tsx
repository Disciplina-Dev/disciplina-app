import { useState } from 'react'
import { IconAlert, IconClose } from '@/components/ui/icons'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
import { RUPTURE_MOTIFS, type Rupture } from '@/types/rupture'
import type { Alternant } from '@/types/alternant'

interface RuptureModalProps {
  alternant: Alternant
  /** Rupture existante pour une modification ; absent pour une déclaration. */
  initial?: Rupture | null
  onClose: () => void
  onSubmit: (input: {
    dateRupture: string
    entreprise: string | null
    motif: string
    detail: string | null
    poursuitFormation: boolean
  }) => Promise<void>
}

const inputClasses =
  'w-full rounded-[var(--radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface)] py-2.5 pl-4 pr-4 text-sm text-[var(--ds-text)] placeholder:text-[var(--ds-text-subtle)] outline-none transition-colors focus:border-[var(--ds-accent)]'

export default function RuptureModal({ alternant, initial, onClose, onSubmit }: RuptureModalProps) {
  const [dateRupture, setDateRupture] = useState(initial?.dateRupture ? initial.dateRupture.slice(0, 10) : '')
  const [entreprise, setEntreprise] = useState(
    initial?.entreprise ?? alternant.company?.name ?? '',
  )
  const [motif, setMotif] = useState(initial?.motif ?? '')
  const [detail, setDetail] = useState(initial?.detail ?? '')
  const [poursuit, setPoursuit] = useState<boolean | null>(initial ? initial.poursuitFormation : null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setError(null)
    if (!dateRupture) {
      setError('La date de la rupture est obligatoire.')
      return
    }
    if (!motif) {
      setError('Le motif de la rupture est obligatoire.')
      return
    }
    if (poursuit === null) {
      setError('Indiquez si l’apprenti poursuit la formation.')
      return
    }
    setLoading(true)
    try {
      await onSubmit({
        dateRupture,
        entreprise: entreprise.trim() || null,
        motif,
        detail: detail.trim() || null,
        poursuitFormation: poursuit,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[var(--ds-text)] backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-[var(--ds-surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--ds-border)] px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ds-text)]">
            <IconAlert width={20} height={20} className="text-[var(--ds-danger)]" />
            {initial ? 'Modifier la rupture' : `Déclarer une rupture — ${alternant.fullName}`}
          </h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-full p-1.5 text-[var(--ds-text-subtle)] hover:bg-[var(--ds-surface-sunken)]"
          >
            <IconClose width={18} height={18} />
          </button>
        </div>

        <div className="ds-scroll space-y-5 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InputField
              id="rupt-date"
              label="Date de la rupture"
              type="date"
              required
              value={dateRupture}
              onChange={(e) => setDateRupture(e.target.value)}
            />
            <InputField
              id="rupt-entreprise"
              label="Entreprise"
              value={entreprise}
              hint="Pré-remplie depuis la fiche — modifiable."
              onChange={(e) => setEntreprise(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="rupt-motif" className="text-[13px] font-semibold text-[var(--ds-text-muted)]">
              Motif de la rupture
              <span className="ml-1 text-[var(--ds-danger)]" aria-hidden="true">
                *
              </span>
            </label>
            <select
              id="rupt-motif"
              required
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              className="w-full rounded-[var(--radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface)] py-2.5 pl-4 pr-4 text-sm text-[var(--ds-text)] outline-none transition-[border-color,box-shadow] duration-150 focus:border-[var(--ds-accent)] focus:ring-2 focus:ring-[var(--ds-accent)]/15"
            >
              <option value="">Sélectionner un motif…</option>
              {RUPTURE_MOTIFS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="rupt-detail" className="text-[13px] font-semibold text-[var(--ds-text-muted)]">
              Détail / cause de la rupture
            </label>
            <textarea
              id="rupt-detail"
              value={detail}
              rows={3}
              placeholder="Contexte, faits, échanges avec l’entreprise…"
              onChange={(e) => setDetail(e.target.value)}
              className={inputClasses}
            />
          </div>

          <fieldset>
            <legend className="mb-2 text-[13px] font-semibold text-[var(--ds-text-muted)]">
              L’apprenti poursuit la formation ?{' '}
              <span className="ml-1 text-[var(--ds-danger)]" aria-hidden="true">*</span>
            </legend>
            <div className="flex gap-2">
              {[
                { value: true, label: 'Oui — poursuit la formation' },
                { value: false, label: 'Non — quitte la formation' },
              ].map((opt) => (
                <label
                  key={opt.label}
                  className={[
                    'flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-colors',
                    poursuit === opt.value
                      ? 'border-teal-700/50 bg-teal-700/5 text-[var(--ds-text)]'
                      : 'border-[var(--ds-border)] text-[var(--ds-text-muted)] hover:border-teal-700/30',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="rupt-poursuit"
                    checked={poursuit === opt.value}
                    onChange={() => setPoursuit(opt.value)}
                    className="h-4 w-4 accent-teal-700"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </fieldset>

          {error && <p className="text-sm text-[var(--ds-danger)]">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--ds-border)] px-6 py-4">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={loading}>
            {initial ? 'Enregistrer' : 'Déclarer la rupture'}
          </Button>
        </div>
      </div>
    </div>
  )
}

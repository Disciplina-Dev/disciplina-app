import { useState } from 'react'
import { IconClose, IconFile } from '@/components/ui/icons'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
import { formatDay } from '@/utils/emargement'

interface AttestationModalProps {
  alternantName: string
  /** Bornes des feuilles d'émargement disponibles : préremplissent la période. */
  availableFrom: string | null
  availableTo: string | null
  onClose: () => void
  /** `range` vide = toute la période (toutes les données de l'alternant). */
  onDownload: (range: { from?: string; to?: string }) => Promise<void>
}

/**
 * Choix de la période de l'attestation d'assiduité : soit deux bornes (les
 * données de la période sont seules retenues), soit « toute la période » qui
 * reprend l'intégralité des feuilles d'émargement de l'alternant.
 */
export default function AttestationModal({
  alternantName,
  availableFrom,
  availableTo,
  onClose,
  onDownload,
}: AttestationModalProps) {
  const [from, setFrom] = useState(availableFrom?.slice(0, 10) ?? '')
  const [to, setTo] = useState(availableTo?.slice(0, 10) ?? '')
  const [running, setRunning] = useState<'range' | 'all' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const hasAvailableRange = Boolean(availableFrom && availableTo)

  async function download(range: { from?: string; to?: string }, mode: 'range' | 'all') {
    setError(null)
    if (mode === 'range') {
      if (!from || !to) {
        setError('Indiquez les deux dates de la période, ou choisissez « Toute la période ».')
        return
      }
      if (from > to) {
        setError('La date de début doit précéder la date de fin.')
        return
      }
    }
    setRunning(mode)
    try {
      await onDownload(range)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Attestation indisponible')
      setRunning(null)
      return
    }
    setRunning(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[var(--ds-text)] backdrop-blur-sm"
        onClick={() => {
          if (running === null) onClose()
        }}
      />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-[var(--ds-surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--ds-border)] px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ds-text)]">
            <IconFile width={20} height={20} className="text-[var(--ds-accent)]" />
            Attestation d’assiduité — {alternantName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-full p-1.5 text-[var(--ds-text-subtle)] hover:bg-[var(--ds-surface-sunken)]"
          >
            <IconClose width={18} height={18} />
          </button>
        </div>

        <div className="ds-scroll space-y-5 overflow-y-auto px-6 py-5">
          <p className="text-[13px] text-[var(--ds-text-muted)]">
            Choisissez la période à attester : seules les séances émargées entre ces deux dates figureront dans le
            document.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InputField
              id="attestation-from"
              label="Du"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
            />
            <InputField
              id="attestation-to"
              label="Au"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          <p className="text-[12px] text-[var(--ds-text-subtle)]">
            {hasAvailableRange
              ? `Données disponibles : du ${formatDay(availableFrom)} au ${formatDay(availableTo)}.`
              : 'Aucune feuille d’émargement sur la période : « Toute la période » produira une attestation vide.'}
          </p>

          {error && <p className="text-sm text-[var(--ds-danger)]">{error}</p>}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--ds-border)] px-6 py-4">
          <Button variant="ghost" onClick={onClose} disabled={running !== null}>
            Annuler
          </Button>
          <Button
            variant="secondary"
            isLoading={running === 'all'}
            disabled={running !== null && running !== 'all'}
            onClick={() => download({}, 'all')}
          >
            Toute la période
          </Button>
          <Button
            variant="primary"
            isLoading={running === 'range'}
            disabled={running !== null && running !== 'range'}
            onClick={() => download({ from, to }, 'range')}
          >
            Générer le PDF
          </Button>
        </div>
      </div>
    </div>
  )
}

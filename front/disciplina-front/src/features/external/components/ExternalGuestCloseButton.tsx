import { useState } from 'react'
import { IconClose, IconLoader } from '@/components/ui/icons'
import { closeExternalLink } from '@/api/external'

interface ExternalGuestCloseButtonProps {
  signature: string
  onClosed: () => void
}

/**
 * Bouton « Clôturer le lien » affiché sur les pages accessibles par lien
 * magique (entreprise / candidat). La clôture marque la session COMPLETED :
 * le lien reste traçable côté RH mais n'ouvre plus aucun contenu.
 */
export default function ExternalGuestCloseButton({ signature, onClosed }: ExternalGuestCloseButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setLoading(true)
    setError(null)
    try {
      await closeExternalLink(signature)
      setOpen(false)
      onClosed()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de la clôture du lien')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ds-danger)] bg-[var(--ds-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--ds-danger)] shadow-sm transition-colors hover:bg-danger/10"
      >
        Clôturer le lien
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-[var(--ds-text)] backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="relative w-full max-w-md rounded-2xl bg-[var(--ds-surface)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--ds-border)] px-6 py-4">
              <h2 className="text-lg font-bold text-[var(--ds-text)]">Clôturer le lien</h2>
              <button onClick={() => setOpen(false)} className="rounded-full p-2 text-[var(--ds-text-subtle)] transition-colors hover:bg-[var(--ds-surface-sunken)] hover:text-[var(--ds-text-muted)]" aria-label="Fermer">
                <IconClose width={20} height={20} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-[var(--ds-text-muted)]">
                Êtes-vous sûr de vouloir clôturer ce lien ? Vous ne pourrez plus accéder à cette page et
                votre conseiller en sera notifié. Cette action est définitive.
              </p>
              {error && <p className="mt-3 text-sm text-[var(--ds-danger)]">{error}</p>}
            </div>
            <div className="flex justify-end gap-3 border-t border-[var(--ds-border)] px-6 py-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="rounded-full bg-[var(--ds-surface)] px-5 py-2.5 text-sm font-semibold text-[var(--ds-text)] ring-1 ring-[var(--ds-border)] hover:bg-[var(--ds-surface-sunken)] disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--ds-danger)] px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
              >
                {loading && <IconLoader width={15} height={15} className="animate-spin" />}
                Clôturer le lien
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

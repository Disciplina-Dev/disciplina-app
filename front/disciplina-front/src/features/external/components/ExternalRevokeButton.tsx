import { useState } from 'react'
import { IconClose, IconShieldOff } from '@/components/ui/icons'
import { revokeExternalAccess } from '@/api/externalAccess'
import Button from '@/components/ui/Button'

interface ExternalRevokeButtonProps {
  signature: string
  allowed: boolean
  onRevoked: () => void
}

// Révoque (bloque) un accès externe après confirmation. Toujours visible sauf
// pour un accès COMPLETED (le backend refuse la révocation d'un accès terminé).
export default function ExternalRevokeButton({ signature, allowed, onRevoked }: ExternalRevokeButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setLoading(true)
    setError(null)
    try {
      await revokeExternalAccess(signature)
      setOpen(false)
      onRevoked()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de la révocation de l'accès")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!allowed}
        title={allowed ? "Révoquer l'accès" : "Un accès complété ne peut pas être révoqué"}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--ds-danger)] hover:bg-danger/10 transition-colors disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed"
      >
        <IconShieldOff width={14} height={14} />
        Révoquer
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-[var(--ds-text)] backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="relative w-full max-w-md bg-[var(--ds-surface)] rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--ds-border)]">
              <h2 className="text-lg font-bold text-[var(--ds-text)]">Révoquer l'accès externe</h2>
              <button onClick={() => setOpen(false)} className="p-2 text-[var(--ds-text-subtle)] hover:text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-sunken)] rounded-full transition-colors" aria-label="Fermer">
                <IconClose width={20} height={20} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-[var(--ds-text-muted)]">
                Êtes-vous sûr de vouloir révoquer cet accès externe ? Le lien sera bloqué et l'utilisateur ne
                pourra plus y accéder.
              </p>
              {error && <p className="mt-3 text-sm text-[var(--ds-danger)]">{error}</p>}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-[var(--ds-border)]">
              <Button variant="secondary" onClick={() => setOpen(false)} disabled={loading}>
                Annuler
              </Button>
              <Button variant="danger" onClick={handleConfirm} isLoading={loading} disabled={loading}>
                Révoquer
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

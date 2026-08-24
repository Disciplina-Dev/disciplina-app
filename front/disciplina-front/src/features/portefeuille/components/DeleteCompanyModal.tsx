import { AlertTriangle, X } from 'lucide-react'
import type { Entreprise } from '@/types/entreprise'
import Button from '@/components/ui/Button'

interface Props {
  entreprise: Entreprise
  onClose: () => void
  onConfirm: () => Promise<void>
  loading?: boolean
  error?: string | null
}

export default function DeleteCompanyModal({ entreprise, onClose, onConfirm, loading = false, error }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-company-title"
      >
        <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger-bg">
              <AlertTriangle className="h-5 w-5 text-danger" />
            </div>
            <h2 id="delete-company-title" className="text-lg font-bold text-gray-900">
              Supprimer l'entreprise
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-50"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            Vous êtes sur le point de supprimer <strong>{entreprise.nom_commercial ?? 'cette entreprise'}</strong>
            {entreprise.siret ? <span className="font-mono"> (SIRET {entreprise.siret})</span> : null}.
          </p>
          <div className="rounded-xl border border-danger/20 bg-danger-bg px-4 py-3 flex gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-danger mt-0.5" />
            <p className="text-sm font-semibold text-danger leading-snug">
              Cette action est irréversible. L'entreprise sera définitivement supprimée du portefeuille et ne pourra pas être
              restaurée.
            </p>
          </div>
          {error && (
            <div className="rounded-xl border border-danger/20 bg-danger-bg px-4 py-2.5 text-sm text-danger">{error}</div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-6 pt-4 border-t border-gray-100">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Annuler
          </Button>
          <Button variant="danger" onClick={onConfirm} isLoading={loading}>
            Supprimer définitivement
          </Button>
        </div>
      </div>
    </div>
  )
}

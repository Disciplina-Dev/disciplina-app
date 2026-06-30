import { X, Trash2 } from 'lucide-react'
import Button from '@/components/ui/Button'

interface ConfirmDeleteModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  candidateName: string
  isDeleting: boolean
}

export default function ConfirmDeleteModal({ open, onClose, onConfirm, candidateName, isDeleting }: ConfirmDeleteModalProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-modal-title"
    >
      <div
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--color-danger-bg)' }}
            >
              <Trash2 size={18} style={{ color: 'var(--color-danger)' }} />
            </div>
            <h2 id="confirm-delete-modal-title" className="text-lg font-bold text-gray-900">
              Supprimer le candidat
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-gray-700">
            Êtes-vous sûr de vouloir supprimer le candidat{' '}
            <span className="font-semibold text-gray-900">{candidateName}</span> ?
            Cette action est irréversible.
          </p>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <Button variant="secondary" onClick={onClose} disabled={isDeleting}>
            Annuler
          </Button>
          <Button
            onClick={onConfirm}
            isLoading={isDeleting}
            disabled={isDeleting}
            style={{ backgroundColor: 'var(--color-danger)', color: 'white' }}
          >
            Supprimer
          </Button>
        </div>
      </div>
    </div>
  )
}

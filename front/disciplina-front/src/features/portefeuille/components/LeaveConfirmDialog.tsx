import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, Loader2, Save } from 'lucide-react'

interface Props {
  open: boolean
  saving: boolean
  /** Reste sur la page. */
  onCancel: () => void
  /** Quitte sans enregistrer. */
  onDiscard: () => void
  /** Enregistre puis quitte. */
  onSave: () => void
}

/**
 * Modale de confirmation (Radix Dialog, focus-trap + a11y) affichée
 * lorsqu'on tente de quitter la page avec des modifications non enregistrées.
 */
export default function LeaveConfirmDialog({ open, saving, onCancel, onDiscard, onSave }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onCancel() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content
          onEscapeKeyDown={onCancel}
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-2xl focus:outline-none"
        >
          <div className="flex items-start gap-3 p-6 pb-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-bg">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-bold text-gray-900">
                Modifications non enregistrées
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-gray-600">
                Vous avez des changements non enregistrés. Que souhaitez-vous faire avant de quitter la page ?
              </Dialog.Description>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-gray-100 p-4 sm:flex-row sm:justify-end">
            <button
              onClick={onCancel}
              disabled={saving}
              className="rounded-xl px-4 py-2 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-60"
            >
              Annuler
            </button>
            <button
              onClick={onDiscard}
              disabled={saving}
              className="rounded-xl border border-danger/30 px-4 py-2 text-[13px] font-semibold text-danger transition-colors hover:bg-danger-bg disabled:opacity-60"
            >
              Quitter sans enregistrer
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-blue px-4 py-2 text-[13px] font-semibold text-white shadow-[0_2px_8px_-2px_rgba(17,48,167,0.35)] transition-all hover:bg-blue/90 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Enregistrer
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

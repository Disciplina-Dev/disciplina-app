import { IconLoader, IconSave, IconUndo } from '@/components/ui/icons'

interface Props {
  visible: boolean
  saving: boolean
  onSave: () => void
  onDiscard: () => void
}

/**
 * Barre flottante en bas d'écran (style macOS / Notion) qui apparaît
 * dès qu'il y a des modifications non enregistrées.
 */
export default function UnsavedChangesBar({ visible, saving, onSave, onDiscard }: Props) {
  return (
    <div
      className={[
        'fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-5 sm:pb-6',
        'transition-all duration-300 ease-out',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0',
      ].join(' ')}
    >
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] px-4 py-2.5 shadow-[0_8px_30px_-6px_rgba(0,0,0,0.25)] backdrop-blur">
        <span className="flex items-center gap-2 text-[13px] font-medium text-[var(--ds-text-muted)]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-warning" />
          </span>
          Modifications non enregistrées
        </span>

        <div className="ml-1 flex items-center gap-1.5">
          <button
            onClick={onDiscard}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[13px] font-medium text-[var(--ds-text-subtle)] transition-colors hover:bg-[var(--ds-surface-sunken)] hover:text-[var(--ds-text-muted)] disabled:opacity-60"
          >
            <IconUndo className="h-3.5 w-3.5" />
            Annuler
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-xl bg-blue px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-[0_2px_8px_-2px_rgba(17,48,167,0.35)] transition-all hover:bg-blue/90 disabled:opacity-60"
          >
            {saving ? <IconLoader className="h-3.5 w-3.5 animate-spin" /> : <IconSave className="h-3.5 w-3.5" />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}

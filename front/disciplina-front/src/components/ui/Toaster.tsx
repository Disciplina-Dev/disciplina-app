import { useEffect } from 'react'
import { CheckCircle, InfoCircle, WarningTriangle, XmarkCircle, Xmark } from 'iconoir-react'
import { useToastStore, type Toast, type ToastVariant } from '@/store/toastStore'

const variantStyles: Record<ToastVariant, { ring: string; icon: string; Icon: typeof CheckCircle }> = {
  success: {
    ring: 'ring-[var(--ds-success)]/25',
    icon: 'text-[var(--ds-success)]',
    Icon: CheckCircle,
  },
  error: {
    ring: 'ring-[var(--ds-danger)]/25',
    icon: 'text-[var(--ds-danger)]',
    Icon: XmarkCircle,
  },
  warning: {
    ring: 'ring-[var(--ds-warning)]/25',
    icon: 'text-[var(--ds-warning)]',
    Icon: WarningTriangle,
  },
  info: {
    ring: 'ring-[var(--ds-accent)]/25',
    icon: 'text-[var(--ds-accent)]',
    Icon: InfoCircle,
  },
}

/** Libellés lus par les lecteurs d'écran avant le contenu du toast. */
const variantLabels: Record<ToastVariant, string> = {
  success: 'Succès',
  error: 'Erreur',
  warning: 'Avertissement',
  info: 'Information',
}

function ToastCard({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss)
  const { ring, icon, Icon } = variantStyles[toast.variant]

  useEffect(() => {
    if (toast.duration === null) return
    const timer = window.setTimeout(() => dismiss(toast.id), toast.duration)
    return () => window.clearTimeout(timer)
  }, [toast.id, toast.duration, dismiss])

  return (
    <div
      // Les erreurs interrompent la lecture en cours, le reste attend une pause.
      role={toast.variant === 'error' ? 'alert' : 'status'}
      className={[
        'ds-glass-strong pointer-events-auto flex w-full max-w-sm items-start gap-3',
        'rounded-[var(--radius-lg)] p-4 text-[var(--ds-text)] ring-1',
        'motion-safe:animate-[ds-toast-in_180ms_ease-out]',
        ring,
      ].join(' ')}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${icon}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">
          <span className="sr-only">{variantLabels[toast.variant]} : </span>
          {toast.title}
        </p>
        {toast.description && (
          <p className="mt-1 text-[13px] leading-snug text-[var(--ds-text-subtle)]">
            {toast.description}
          </p>
        )}
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick()
              dismiss(toast.id)
            }}
            className="mt-2 text-[13px] font-semibold text-[var(--ds-accent)] underline underline-offset-2 hover:opacity-80"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        aria-label="Fermer la notification"
        className="-m-1 shrink-0 rounded-[var(--radius-sm)] p-1 text-[var(--ds-text-subtle)] transition-colors hover:bg-[var(--ds-surface-sunken)] hover:text-[var(--ds-text)]"
      >
        <Xmark className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}

/**
 * Pile de notifications, ancrée en bas à droite.
 *
 * Monté une seule fois à la racine de l'application ; on y pousse des messages
 * depuis n'importe où via les helpers de `@/store/toastStore`.
 */
export default function Toaster() {
  const toasts = useToastStore((s) => s.toasts)

  return (
    <>
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed bottom-5 right-5 z-[200] flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} />
        ))}
      </div>
    </>
  )
}

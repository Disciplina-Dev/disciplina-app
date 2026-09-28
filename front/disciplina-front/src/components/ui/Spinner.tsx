type SpinnerProps = {
  size?: number
  className?: string
  /** Texte annoncé pendant le chargement. */
  label?: string
}

/** Indicateur de chargement. Le libellé est lu, le cercle est décoratif. */
export default function Spinner({ size = 24, className = '', label = 'Chargement en cours' }: SpinnerProps) {
  return (
    <span role="status" className={`inline-flex items-center ${className}`}>
      <span
        aria-hidden="true"
        style={{ width: size, height: size, borderWidth: Math.max(2, Math.round(size / 8)) }}
        className="inline-block animate-spin rounded-full border-[var(--ds-accent)] border-r-transparent"
      />
      <span className="sr-only">{label}</span>
    </span>
  )
}

type LoadingPanelProps = {
  message?: string
  /** Hauteur minimale, pour éviter que la page ne saute au chargement. */
  minHeight?: number | string
  className?: string
}

/** Zone de chargement occupant un bloc (section, tableau, graphique). */
export function LoadingPanel({
  message = 'Chargement…',
  minHeight = 240,
  className = '',
}: LoadingPanelProps) {
  return (
    <div
      style={{ minHeight }}
      className={[
        'flex flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)]',
        'border border-[var(--ds-border)] bg-[var(--ds-surface)]',
        className,
      ].join(' ')}
    >
      <Spinner size={26} label={message} />
      <p className="text-sm text-[var(--ds-text-subtle)]">{message}</p>
    </div>
  )
}

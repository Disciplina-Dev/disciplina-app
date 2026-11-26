import type { ReactNode } from 'react'

type EmptyStateProps = {
  icon?: ReactNode
  title: string
  /** Ce que l'utilisateur peut faire pour sortir de cet état. */
  description?: string
  action?: ReactNode
  className?: string
}

/** État vide : on dit toujours quoi faire ensuite, jamais juste « aucun résultat ». */
export default function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div
      className={[
        'flex flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] px-6 py-12 text-center',
        'border border-dashed border-[var(--ds-border-strong)] bg-[var(--ds-surface)]',
        className,
      ].join(' ')}
    >
      {icon && (
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--ds-surface-sunken)] text-[var(--ds-text-subtle)]">
          {icon}
        </span>
      )}
      <div>
        <p className="text-[15px] font-semibold text-[var(--ds-text)]">{title}</p>
        {description && (
          <p className="mt-1 max-w-sm text-[13px] text-[var(--ds-text-subtle)]">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}

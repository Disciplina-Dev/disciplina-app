import type { ReactNode } from 'react'

type PageHeaderProps = {
  /** Sur-titre : situe la page dans son espace (« Suivi commercial »). */
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}

/** En-tête de page : même gabarit dans tous les espaces du CRM. */
export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <header className={`mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${className}`}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ds-text-subtle)]">
            {eyebrow}
          </p>
        )}
        <h1 className="text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em] text-[var(--ds-text)]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-[13px] text-[var(--ds-text-subtle)]">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

type SectionHeaderProps = {
  title: ReactNode
  icon?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}

/** En-tête de section à l'intérieur d'une page. */
export function SectionHeader({ title, icon, description, actions, className = '' }: SectionHeaderProps) {
  return (
    <div className={`mb-4 flex flex-wrap items-center justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-[17px] font-bold tracking-[-0.01em] text-[var(--ds-text)]">
          {icon && <span className="text-[var(--ds-text-subtle)]">{icon}</span>}
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-[13px] text-[var(--ds-text-subtle)]">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

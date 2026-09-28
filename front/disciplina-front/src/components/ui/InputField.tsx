import { useId, type InputHTMLAttributes, type ReactNode } from 'react'

type InputFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  id: string
  icon?: ReactNode
  rightElement?: ReactNode
  error?: string
  /** Consigne affichée sous le champ (format attendu, contrainte, …). */
  hint?: string
}

export default function InputField({
  label,
  id,
  icon,
  rightElement,
  error,
  hint,
  className = '',
  required,
  ...props
}: InputFieldProps) {
  // Les messages sont reliés au champ pour être annoncés par les lecteurs
  // d'écran au moment où l'utilisateur y entre.
  const messageId = useId()
  const errorId = `${messageId}-error`
  const hintId = `${messageId}-hint`

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-[var(--ds-text-muted)]">
        {label}
        {required && (
          <span className="ml-1 text-[var(--ds-danger)]" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[var(--ds-text-subtle)]">
            {icon}
          </span>
        )}
        <input
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={[error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined}
          className={[
            'w-full rounded-[var(--radius-md)] border py-2.5 text-sm',
            'bg-[var(--ds-surface)] text-[var(--ds-text)]',
            'placeholder:text-[var(--ds-text-subtle)] outline-none',
            'transition-[border-color,box-shadow] duration-150',
            error
              ? 'border-[var(--ds-danger)] focus:ring-2 focus:ring-[var(--ds-danger)]/20'
              : 'border-[var(--ds-border)] focus:border-[var(--ds-accent)] focus:ring-2 focus:ring-[var(--ds-accent)]/15',
            'disabled:cursor-not-allowed disabled:bg-[var(--ds-surface-sunken)] disabled:opacity-70',
            icon ? 'pl-11' : 'pl-4',
            rightElement ? 'pr-11' : 'pr-4',
            className,
          ].join(' ')}
          {...props}
        />
        {rightElement && (
          <span className="absolute inset-y-0 right-3 flex items-center">{rightElement}</span>
        )}
      </div>
      {hint && !error && (
        <p id={hintId} className="text-xs text-[var(--ds-text-subtle)]">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-[var(--ds-danger)]">
          {error}
        </p>
      )}
    </div>
  )
}

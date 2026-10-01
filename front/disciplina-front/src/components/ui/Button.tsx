import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  isLoading?: boolean
  /** Texte annoncé aux lecteurs d'écran pendant le chargement. */
  loadingLabel?: string
}

const variantClasses: Record<ButtonVariant, string> = {
  // Bouton bleu charte façon « pilule » : l'action principale, aligné sur
  // l'état actif de la sidebar.
  primary:
    'bg-[var(--ds-accent)] text-[var(--ds-text-inverse)] shadow-[var(--shadow-sm)] hover:opacity-90 active:opacity-80',
  secondary:
    'bg-[var(--ds-surface)] text-[var(--ds-text)] ring-1 ring-[var(--ds-border)] shadow-[var(--shadow-xs)] hover:bg-[var(--ds-surface-sunken)]',
  subtle:
    'bg-[var(--ds-accent-soft)] text-[var(--ds-accent)] hover:brightness-95',
  ghost:
    'bg-transparent text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-sunken)] hover:text-[var(--ds-text)]',
  danger:
    'bg-[var(--ds-danger)] text-white shadow-[var(--shadow-sm)] hover:opacity-90',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-[13px]',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-base',
  icon: 'h-10 w-10 p-0',
}

export default function Button({
  className = '',
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  isLoading = false,
  loadingLabel = 'Chargement en cours',
  disabled,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  const isDisabled = disabled || isLoading

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-full font-semibold',
        'transition-[background-color,opacity,box-shadow,transform] duration-150',
        'motion-safe:active:scale-[0.98]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-accent)]',
        'disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
      {...props}
    >
      {isLoading ? (
        <>
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
            aria-hidden="true"
          />
          <span className="sr-only">{loadingLabel}</span>
        </>
      ) : (
        leftIcon
      )}
      {size !== 'icon' && <span>{children}</span>}
      {size === 'icon' && !isLoading && children}
      {!isLoading && rightIcon}
    </button>
  )
}

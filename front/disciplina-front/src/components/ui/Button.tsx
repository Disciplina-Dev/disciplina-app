import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  isLoading?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-blue text-white shadow-sm hover:bg-blue-dark focus-visible:ring-blue/30',
  secondary:
    'bg-white text-gray-900 ring-1 ring-gray-300 hover:bg-gray-50 focus-visible:ring-blue/20',
  ghost:
    'bg-transparent text-gray-900 hover:bg-gray-100 focus-visible:ring-gray-300',
  danger:
    'bg-danger text-white hover:bg-pink-dark focus-visible:ring-danger/30',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
}

export default function Button({
  className = '',
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  isLoading = false,
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
      className={[
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-60',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
      {...props}
    >
      {isLoading ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
          aria-hidden="true"
        />
      ) : (
        leftIcon
      )}
      <span>{children}</span>
      {!isLoading && rightIcon}
    </button>
  )
}

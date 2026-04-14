import type { InputHTMLAttributes, ReactNode } from 'react'

type InputFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  id: string
  icon?: ReactNode
  rightElement?: ReactNode
  error?: string
}

export default function InputField({
  label,
  id,
  icon,
  rightElement,
  error,
  className = '',
  ...props
}: InputFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-300">
            {icon}
          </span>
        )}
        <input
          id={id}
          className={[
            'w-full rounded-[10px] border bg-white py-2.5 text-sm text-gray-900',
            'placeholder:text-gray-300 outline-none transition-colors',
            error ? 'border-danger' : 'border-gray-100',
            'focus:border-blue',
            icon ? 'pl-10' : 'pl-4',
            rightElement ? 'pr-10' : 'pr-4',
            className,
          ].join(' ')}
          {...props}
        />
        {rightElement && (
          <span className="absolute inset-y-0 right-3 flex items-center">
            {rightElement}
          </span>
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}

import { useState } from 'react'
import { IconEye, IconEyeOff, IconLock } from '@/components/ui/icons'
import type { InputHTMLAttributes } from 'react'
import InputField from './InputField'

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string
  id: string
  error?: string
}

export default function PasswordInput({ label, id, error, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  const toggle = (
    <button
      type="button"
      onClick={() => setVisible((v) => !v)}
      className="text-[var(--ds-text-subtle)] hover:text-[var(--ds-text-muted)] transition-colors"
      aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
    >
      {visible ? <IconEyeOff width={18} height={18} /> : <IconEye width={18} height={18} />}
    </button>
  )

  return (
    <InputField
      label={label}
      id={id}
      type={visible ? 'text' : 'password'}
      icon={<IconLock width={18} height={18} />}
      rightElement={toggle}
      error={error}
      {...props}
    />
  )
}

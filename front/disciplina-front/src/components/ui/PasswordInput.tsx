import { useState } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'
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
      className="text-gray-300 hover:text-gray-700 transition-colors"
      aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
    >
      {visible ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  )

  return (
    <InputField
      label={label}
      id={id}
      type={visible ? 'text' : 'password'}
      icon={<Lock size={18} />}
      rightElement={toggle}
      error={error}
      {...props}
    />
  )
}

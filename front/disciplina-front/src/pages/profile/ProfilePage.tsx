import { useState } from 'react'
import { useMutation, gql } from 'urql'
import { useCurrentUser, useAuthStore, UserRole } from '@/store/authStore'
import { KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle, User } from 'lucide-react'

const CHANGE_PASSWORD_MUTATION = gql`
  mutation ChangePassword($currentPassword: String!, $newPassword: String!) {
    changePassword(currentPassword: $currentPassword, newPassword: $newPassword)
  }
`

const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Administrateur',
  [UserRole.RESPONSABLE]: 'Responsable',
  [UserRole.COMMERCIAL]: 'Commercial',
  [UserRole.RH]: 'Ressources Humaines',
  [UserRole.ENTREPRISE]: 'Entreprise',
}

function useAccentColor() {
  const role = useAuthStore((s) => s.user?.role)
  return role === UserRole.RH || role === UserRole.RESPONSABLE ? '#60207E' : '#1130A7'
}

function PasswordInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="new-password"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-10 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent"
        />
        <button
          type="button"
          onClick={() => setShow((p) => !p)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          tabIndex={-1}
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const user = useCurrentUser()
  const accent = useAccentColor()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [success, setSuccess] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const [{ fetching, error }, changePassword] = useMutation(CHANGE_PASSWORD_MUTATION)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSuccess(false)
    setValidationError(null)

    if (newPassword.length < 8) {
      setValidationError('Le nouveau mot de passe doit contenir au moins 8 caractères')
      return
    }
    if (newPassword !== confirmPassword) {
      setValidationError('Les mots de passe ne correspondent pas')
      return
    }
    if (currentPassword === newPassword) {
      setValidationError('Le nouveau mot de passe doit être différent de l\'actuel')
      return
    }

    const result = await changePassword({ currentPassword, newPassword })
    if (!result.error) {
      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  const displayError = validationError ?? error?.graphQLErrors?.[0]?.message ?? error?.message

  if (!user) return null

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Mon profil</h1>
        <p className="text-sm text-gray-500 mt-0.5">Informations de compte</p>
      </div>

      {/* Identity card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-lg font-bold text-white shadow-md"
            style={{ backgroundColor: accent }}
          >
            {user.initials ?? <User size={24} />}
          </div>
          <div>
            <p className="text-base font-bold text-gray-900">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-sm text-gray-500">{user.email}</p>
            <span
              className="mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white"
              style={{ backgroundColor: accent }}
            >
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <KeyRound size={17} style={{ color: accent }} />
          <h2 className="text-base font-bold text-gray-800">Changer le mot de passe</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordInput
            label="Mot de passe actuel"
            value={currentPassword}
            onChange={setCurrentPassword}
            placeholder="••••••••"
          />
          <PasswordInput
            label="Nouveau mot de passe"
            value={newPassword}
            onChange={(v) => { setNewPassword(v); setValidationError(null) }}
            placeholder="8 caractères minimum"
          />
          <PasswordInput
            label="Confirmer le nouveau mot de passe"
            value={confirmPassword}
            onChange={(v) => { setConfirmPassword(v); setValidationError(null) }}
            placeholder="••••••••"
          />

          {/* Password strength hint */}
          {newPassword.length > 0 && newPassword.length < 8 && (
            <p className="text-xs text-amber-600">
              {8 - newPassword.length} caractère{8 - newPassword.length > 1 ? 's' : ''} manquant{8 - newPassword.length > 1 ? 's' : ''}
            </p>
          )}

          {displayError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
              {displayError}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2.5 text-sm text-green-700">
              <CheckCircle2 size={15} className="flex-shrink-0" />
              Mot de passe modifié avec succès
            </div>
          )}

          <div className="pt-1">
            <button
              type="submit"
              disabled={fetching || !currentPassword || !newPassword || !confirmPassword}
              className="w-full py-2.5 text-sm font-semibold text-white rounded-xl transition-opacity disabled:opacity-40 hover:opacity-90"
              style={{ backgroundColor: accent }}
            >
              {fetching ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

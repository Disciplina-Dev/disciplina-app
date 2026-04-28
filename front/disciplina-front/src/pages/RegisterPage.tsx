import { useState } from 'react'
import { User, Mail, ShieldCheck, Shield } from 'lucide-react'
import { useMutation } from 'urql'
import { REGISTER_USER } from '@/graphql/queries'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
import PasswordInput from '@/components/ui/PasswordInput'
import PasswordStrength from '@/components/ui/PasswordStrength'
import { UserRole } from '@/store/authStore'

export default function RegisterPage() {
  const [{ fetching, error }, executeMutation] = useMutation(REGISTER_USER)

  const [firstname, setFirstname] = useState('')
  const [lastname, setLastname] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>(UserRole.COMMERCIAL)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [success, setSuccess] = useState(false)

  const confirmError =
    confirmPassword.length > 0 && confirmPassword !== password
      ? 'Les mots de passe ne correspondent pas'
      : undefined

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) return
    setSuccess(false)

    const result = await executeMutation(
      {
        email,
        name: `${firstname} ${lastname}`.trim(),
        passwordPlain: password,
        role,
        sectors: [],
      },
      { url: 'http://localhost:4000/api/graphql/users' }
    )

    if (result.data?.register) {
      setSuccess(true)
      setFirstname('')
      setLastname('')
      setEmail('')
      setPassword('')
      setConfirmPassword('')
      setRole(UserRole.COMMERCIAL)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-[20px] p-8 shadow-sm">
      <div className="flex justify-center mb-6">
        <img src="/logo-disciplina.svg" alt="Disciplina" className="h-10" />
      </div>

      <div className="text-center mb-6">
        <h2>Créer un utilisateur</h2>
        <p className="mt-1 text-sm text-gray-500">
          Ajouter un nouveau membre à la plateforme
        </p>
      </div>

      {success && (
        <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-lg text-sm border border-green-200">
          L'utilisateur a été créé avec succès.
        </div>
      )}

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="role" className="text-sm font-medium text-gray-700">
            Rôle
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Shield size={18} />
            </div>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-[10px] text-sm text-gray-900 focus:ring-2 focus:ring-blue focus:border-blue transition-colors appearance-none"
              required
            >
              <option value={UserRole.ADMIN}>Administrateur</option>
              <option value={UserRole.RH}>Ressources Humaines</option>
              <option value={UserRole.COMMERCIAL}>Commercial</option>
              <option value={UserRole.ENTREPRISE}>Entreprise</option>
            </select>
          </div>
        </div>

        <InputField
          label="Prénom"
          id="firstname"
          type="text"
          placeholder="Jean"
          icon={<User size={18} />}
          value={firstname}
          onChange={(e) => setFirstname(e.target.value)}
          required
        />

        <InputField
          label="Nom"
          id="lastname"
          type="text"
          placeholder="Dupont"
          icon={<User size={18} />}
          value={lastname}
          onChange={(e) => setLastname(e.target.value)}
          required
        />

        <InputField
          label="Adresse email"
          id="email"
          type="email"
          placeholder="vous@exemple.fr"
          icon={<Mail size={18} />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <div className="flex flex-col gap-1.5">
          <PasswordInput
            label="Mot de passe"
            id="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <PasswordStrength password={password} />
        </div>

        <InputField
          label="Confirmer le mot de passe"
          id="confirm-password"
          type="password"
          placeholder="••••••••"
          icon={<ShieldCheck size={18} />}
          error={confirmError}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />

        {error && <p className="text-sm text-red-500">{error.message}</p>}

        <Button
          type="submit"
          size="lg"
          className="w-full rounded-[10px]"
          disabled={fetching}
        >
          {fetching ? 'Création...' : 'Créer l\'utilisateur'}
        </Button>
      </form>
    </div>
  )
}

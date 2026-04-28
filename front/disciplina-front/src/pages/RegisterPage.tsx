import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, User, ShieldCheck } from 'lucide-react'
import { useMutation } from 'urql'
import { REGISTER_USER } from '@/graphql/queries'
import { useAuthStore } from '@/store/authStore'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
import PasswordInput from '@/components/ui/PasswordInput'
import PasswordStrength from '@/components/ui/PasswordStrength'

export default function RegisterPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [{ fetching, error }, executeMutation] = useMutation(REGISTER_USER)

  const [firstname, setFirstname] = useState('')
  const [lastname, setLastname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [accepted, setAccepted] = useState(false)

  const confirmError =
    confirmPassword.length > 0 && confirmPassword !== password
      ? 'Les mots de passe ne correspondent pas'
      : undefined

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword || !accepted) return

    const result = await executeMutation(
      {
        email,
        name: `${firstname} ${lastname}`.trim(),
        passwordPlain: password,
        role: 'ENTREPRISE',
        sectors: [],
      },
      { url: 'http://localhost:4000/api/graphql/users' }
    )

    if (result.data?.register) {
      const { token, user } = result.data.register
      setAuth(token, user)
      
      if (user.role === 'RH') {
        navigate('/rh')
      } else if (user.role === 'COMMERCIAL') {
        navigate('/commercial')
      } else {
         // Fallback/entreprise mapping
        navigate('/')
      }
    }
  }

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-[20px] p-8 shadow-sm">
      <div className="flex justify-center mb-6">
        <img src="/logo-disciplina.svg" alt="Disciplina" className="h-10" />
      </div>

      <div className="text-center mb-6">
        <h2>Créer un compte</h2>
        <p className="mt-1 text-sm text-gray-500">
          Rejoignez Disciplina et prenez le contrôle
        </p>
      </div>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <InputField
          label="Prénom"
          id="firstname"
          type="text"
          placeholder="Jean"
          icon={<User size={18} />}
          autoComplete="given-name"
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
          autoComplete="family-name"
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
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <div className="flex flex-col gap-1.5">
          <PasswordInput
            label="Mot de passe"
            id="password"
            placeholder="••••••••"
            autoComplete="new-password"
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
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />

        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 cursor-pointer accent-blue"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            required
          />
          <span className="text-sm text-gray-700">
            J'accepte les{' '}
            <Link to="/conditions" className="font-medium text-blue">
              conditions d'utilisation
            </Link>{' '}
            et la{' '}
            <Link to="/confidentialite" className="font-medium text-blue">
              politique de confidentialité
            </Link>
          </span>
        </label>

        {error && <p className="text-sm text-red-500">{error.message}</p>}

        <Button
          type="submit"
          size="lg"
          className="w-full rounded-[10px]"
          disabled={!accepted || fetching}
        >
          {fetching ? 'Création...' : 'Créer mon compte'}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-gray-500">
        Déjà un compte ?{' '}
        <Link to="/login" className="font-medium text-blue">
          Se connecter
        </Link>
      </p>
    </div>
  )
}

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { useMutation } from 'urql'
import { LOGIN_USER } from '@/graphql/queries'
import { useAuthStore } from '@/store/authStore'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
import PasswordInput from '@/components/ui/PasswordInput'

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
)

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [{ fetching, error }, executeMutation] = useMutation(LOGIN_USER)
  
  const [email, setEmail] = useState('')
  const [passwordPlain, setPasswordPlain] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = await executeMutation(
      { email, passwordPlain },
      { url: 'http://localhost:4000/api/graphql/users' }
    )
    
    if (result.data?.login) {
      const { token, user } = result.data.login
      setAuth(token, user)
      
      if (user.role === 'RH') {
        navigate('/rh')
      } else if (user.role === 'COMMERCIAL') {
        navigate('/commercial')
      } else {
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
        <h2>Bon retour</h2>
        <p className="mt-1 text-sm text-gray-500">Connectez-vous à votre espace</p>
      </div>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
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

        <div className="flex flex-col gap-1">
          <PasswordInput
            label="Mot de passe"
            id="password"
            placeholder="••••••••"
            autoComplete="current-password"
            value={passwordPlain}
            onChange={(e) => setPasswordPlain(e.target.value)}
            required
          />
          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-sm text-blue">
              Mot de passe oublié ?
            </Link>
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error.message}</p>}

        <Button type="submit" size="lg" className="w-full rounded-[10px]" disabled={fetching}>
          {fetching ? 'Connexion...' : 'Se connecter'}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <div className="flex-1 border-t border-gray-100" />
        <span className="text-xs text-gray-300">ou continuer avec</span>
        <div className="flex-1 border-t border-gray-100" />
      </div>

      {/* Google button */}
      <button
        type="button"
        className="flex w-full items-center justify-center gap-3 rounded-[10px] border border-gray-100 bg-white py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
      >
        <GoogleIcon />
        Continuer avec Google
      </button>


    </div>
  )
}

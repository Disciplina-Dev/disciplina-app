import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
import PasswordInput from '@/components/ui/PasswordInput'

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [email, setEmail] = useState('')
  const [passwordPlain, setPasswordPlain] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFetching(true)
    setError(null)
    try {
      const res = await fetch('http://localhost:4000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, passwordPlain }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erreur de connexion')
        return
      }
      const { token, user } = data
      setAuth(token, user)
      
      if (user.role === 'RH') {
        navigate('/rh')
      } else if (user.role === 'COMMERCIAL') {
        navigate('/commercial')
      } else {
        navigate('/')
      }
    } catch {
      setError('Erreur réseau')
    } finally {
      setFetching(false)
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

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button type="submit" size="lg" className="w-full rounded-[10px]" disabled={fetching}>
          {fetching ? 'Connexion...' : 'Se connecter'}
        </Button>
      </form>
    </div>
  )
}

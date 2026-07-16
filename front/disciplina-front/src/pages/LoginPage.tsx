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

  // Étape 2FA : après identifiants valides, un code est envoyé par email.
  const [step, setStep] = useState<'credentials' | 'code'>('credentials')
  const [pendingToken, setPendingToken] = useState('')
  const [code, setCode] = useState('')
  const [resent, setResent] = useState(false)

  const parseError = (data: any): string => {
    const raw = data?.error
    return (typeof raw === 'string' ? raw : raw?.message) || 'Erreur de connexion'
  }

  const redirectByRole = (role: string) => {
    if (role === 'RH') navigate('/rh')
    else if (role === 'COMMERCIAL') navigate('/commercial')
    else if (role === 'ADMIN' || role === 'RESPONSABLE') navigate('/commercial')
    else if (role === 'PEDA') navigate('/peda')
    else if (role === 'ENTREPRISE') navigate('/entreprise')
    else navigate('/')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFetching(true)
    setError(null)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, passwordPlain }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(parseError(data))
        return
      }
      // Un code de vérification a été envoyé par email : passage à l'étape 2.
      setPendingToken(data.pendingToken)
      setStep('code')
    } catch {
      setError('Erreur réseau')
    } finally {
      setFetching(false)
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setFetching(true)
    setError(null)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/2fa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingToken, code }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(parseError(data))
        return
      }
      const { token, user } = data
      setAuth(token, user)
      redirectByRole(user.role)
    } catch {
      setError('Erreur réseau')
    } finally {
      setFetching(false)
    }
  }

  const handleResend = async () => {
    setError(null)
    setResent(false)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/2fa/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingToken }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(parseError(data))
        return
      }
      setResent(true)
    } catch {
      setError('Erreur réseau')
    }
  }

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-[20px] p-8 shadow-sm">
      <div className="flex justify-center mb-6">
        <img src="/logo-disciplina.svg" alt="Disciplina" className="h-10" />
      </div>

      {step === 'credentials' ? (
        <>
          <div className="text-center mb-6">
            <h2>Bon retour</h2>
            <p className="mt-1 text-sm text-gray-500">Connectez-vous à votre espace</p>
          </div>

          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <InputField
              label="Adresse email"
              id="email"
              name="email"
              type="email"
              placeholder="vous@exemple.fr"
              icon={<Mail size={18} />}
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <div className="flex flex-col gap-1">
              <PasswordInput
                label="Mot de passe"
                id="password"
                name="password"
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
        </>
      ) : (
        <>
          <div className="text-center mb-6">
            <h2>Vérification</h2>
            <p className="mt-1 text-sm text-gray-500">
              Un code à 6 chiffres a été envoyé à<br />
              <span className="font-medium text-gray-700">{email}</span>
            </p>
          </div>

          <form className="flex flex-col gap-4" onSubmit={handleVerify}>
            <InputField
              label="Code de vérification"
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              required
            />

            {error && <p className="text-sm text-red-500">{error}</p>}
            {resent && <p className="text-sm text-green-600">Un nouveau code a été envoyé.</p>}

            <Button type="submit" size="lg" className="w-full rounded-[10px]" disabled={fetching || code.length !== 6}>
              {fetching ? 'Vérification...' : 'Valider'}
            </Button>

            <div className="flex justify-between text-sm">
              <button type="button" className="text-gray-500" onClick={() => { setStep('credentials'); setCode(''); setError(null) }}>
                Retour
              </button>
              <button type="button" className="text-blue" onClick={handleResend}>
                Renvoyer le code
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  )
}

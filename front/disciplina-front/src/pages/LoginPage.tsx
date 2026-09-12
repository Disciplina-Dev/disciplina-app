import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, MapPin } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useRegionStore, type Region } from '@/store/regionStore'
import { login } from '@/api/auth'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
import PasswordInput from '@/components/ui/PasswordInput'

const REGIONS: { id: Region; label: string; accent: string }[] = [
  { id: 'reunion', label: 'La Réunion', accent: '#1130A7' },
  { id: 'annemasse', label: 'Annemasse', accent: '#60207E' },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuthReady = useAuthStore((state) => state.setAuthReady)
  // Région retenue du dernier passage (localStorage) : pré-sélectionnée pour que
  // le cas courant — toujours la même région — se connecte sans rien re-choisir.
  const storedRegion = useRegionStore((state) => state.region)
  const setStoredRegion = useRegionStore((state) => state.setRegion)
  const [region, setRegion] = useState<Region | null>(storedRegion)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [passwordPlain, setPasswordPlain] = useState('')

  const handlePickRegion = (picked: Region) => {
    setRegion(picked)
    // Mémorisé dès le clic, pas seulement après un login réussi : un mot de passe
    // raté ne doit pas faire reperdre le choix de région au rechargement.
    setStoredRegion(picked)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!region) {
      setError('Choisissez votre région pour continuer.')
      return
    }
    setFetching(true)
    setError(null)
    try {
      const user = await login(email, passwordPlain, region)
      setAuthReady(user)

      if (user.role === 'RH') {
        navigate('/rh/candidats')
      } else if (user.role === 'COMMERCIAL') {
        navigate('/commercial/portefeuille')
      } else if (user.role === 'PEDA') {
        navigate('/peda')
      } else if (user.role === 'AD' || user.role === 'GESTION') {
        navigate('/admin')
      } else if (user.role === 'ENTREPRISE') {
        navigate('/entreprise')
      } else {
        navigate('/')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau')
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
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-medium text-gray-700 mb-1.5">Région</legend>
          <div className="grid grid-cols-2 gap-2">
            {REGIONS.map(({ id, label, accent }) => {
              const selected = region === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handlePickRegion(id)}
                  aria-pressed={selected}
                  className={[
                    'flex items-center justify-center gap-2 rounded-[10px] border px-3 py-2.5',
                    'text-sm font-medium transition-colors outline-none',
                    selected ? 'text-white' : 'border-gray-100 bg-white text-gray-500 hover:border-gray-300',
                  ].join(' ')}
                  style={selected ? { background: accent, borderColor: accent } : undefined}
                >
                  <MapPin size={16} />
                  {label}
                </button>
              )
            })}
          </div>
        </fieldset>

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

        <Button
          type="submit"
          size="lg"
          className="w-full rounded-[10px]"
          disabled={fetching || !region}
        >
          {fetching ? 'Connexion...' : 'Se connecter'}
        </Button>
      </form>
    </div>
  )
}

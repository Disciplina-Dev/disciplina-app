import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { IconMail, IconMapPin } from '@/components/ui/icons'
import { useAuthStore } from '@/store/authStore'
import { useRegionStore, type Region } from '@/store/regionStore'
import { login } from '@/api/auth'
import { toFrenchError } from '@/lib/errorMessages'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
import PasswordInput from '@/components/ui/PasswordInput'
import Logo from '@/components/ui/Logo'

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
      // Traduit en français et reformulé : le message brut du back n'atteint
      // jamais l'écran de connexion.
      setError(toFrenchError(err))
    } finally {
      setFetching(false)
    }
  }

  return (
    <div className="ds-glass-strong mx-auto w-full max-w-md rounded-[var(--radius-2xl)] p-8">
      <div className="mb-6 flex justify-center">
        <Logo className="h-10" alt="Disciplina" />
      </div>

      <div className="mb-7 text-center">
        <h1 className="text-[26px] font-extrabold tracking-[-0.03em]">Bon retour</h1>
        <p className="mt-1 text-sm text-[var(--ds-text-subtle)]">Connectez-vous à votre espace</p>
      </div>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-[13px] font-semibold text-[var(--ds-text-muted)]">Région</legend>
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
                    'flex items-center justify-center gap-2 rounded-[var(--radius-md)] border px-3 py-2.5',
                    'text-sm font-semibold transition-colors',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-accent)]',
                    selected
                      ? 'text-white shadow-[var(--shadow-sm)]'
                      : 'border-[var(--ds-border)] bg-[var(--ds-surface)] text-[var(--ds-text-subtle)] hover:border-[var(--ds-border-strong)] hover:text-[var(--ds-text)]',
                  ].join(' ')}
                  style={selected ? { background: accent, borderColor: accent } : undefined}
                >
                  <IconMapPin width={16} height={16} />
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
          icon={<IconMail width={18} height={18} />}
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
            <Link to="/forgot-password" className="text-[13px] font-medium text-[var(--ds-accent)]">
              Mot de passe oublié ?
            </Link>
          </div>
        </div>

        {error && (
          // role="alert" : l'échec de connexion est annoncé immédiatement.
          <p
            role="alert"
            className="rounded-[var(--radius-md)] bg-[var(--ds-danger-bg)] px-3.5 py-2.5 text-[13px] font-medium text-[var(--ds-danger)]"
          >
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" isLoading={fetching} disabled={!region}>
          Se connecter
        </Button>
      </form>
    </div>
  )
}

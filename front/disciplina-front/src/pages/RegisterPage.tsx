import { useState } from 'react'
import { User, Mail, ShieldCheck, Shield, Globe, MapPin } from 'lucide-react'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
import PasswordInput from '@/components/ui/PasswordInput'
import PasswordStrength from '@/components/ui/PasswordStrength'
import { UserRole, useAuthStore } from '@/store/authStore'
import { useGoogleOAuthPopup } from '@/hooks/useGoogleOAuthPopup'
import { SECTEUR_VALUES } from '@/types/entreprise'

export default function RegisterPage() {
  const token = useAuthStore((s) => s.token)
  const { connectGoogle, isLoading: googleLoading } = useGoogleOAuthPopup()
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [firstname, setFirstname] = useState('')
  const [lastname, setLastname] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>(UserRole.COMMERCIAL)
  const [sectors, setSectors] = useState<string[]>([])
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [linkGoogle, setLinkGoogle] = useState(true)
  const [success, setSuccess] = useState(false)
  const [googleStatus, setGoogleStatus] = useState<'pending' | 'connected' | 'skipped' | 'failed' | null>(null)

  const confirmError =
    confirmPassword.length > 0 && confirmPassword !== password
      ? 'Les mots de passe ne correspondent pas'
      : undefined

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) return
    setSuccess(false)
    setGoogleStatus(null)
    setFetching(true)
    setError(null)

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          email,
          firstName: firstname,
          lastName: lastname,
          passwordPlain: password,
          role,
          sectors,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Erreur lors de l'inscription")
        return
      }

      setSuccess(true)
      setFirstname('')
      setLastname('')
      setEmail('')
      setPassword('')
      setConfirmPassword('')
      setRole(UserRole.COMMERCIAL)
      setSectors([])

      if (linkGoogle) {
        setGoogleStatus('pending')
        try {
          await connectGoogle(data.id)
          setGoogleStatus('connected')
        } catch {
          setGoogleStatus('failed')
        }
      } else {
        setGoogleStatus('skipped')
      }
    } catch {
      setError('Erreur réseau')
    } finally {
      setFetching(false)
    }
  }

  const isBusy = fetching || googleLoading

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-5">
      <div className="w-full bg-white rounded-[20px] p-8 shadow-sm">
      <div className="text-center mb-6">
        <h2>Créer un utilisateur</h2>
        <p className="mt-1 text-sm text-gray-500">
          Ajouter un nouveau membre à la plateforme
        </p>
      </div>

      {success && (
        <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-lg text-sm border border-green-200">
          <p className="font-medium">L'utilisateur a été créé avec succès.</p>
          {googleStatus === 'connected' && (
            <p className="mt-1">Compte Google connecté.</p>
          )}
          {googleStatus === 'skipped' && (
            <p className="mt-1 text-gray-600">Connexion Google ignorée.</p>
          )}
          {googleStatus === 'failed' && (
            <p className="mt-1 text-amber-600">Connexion Google annulée ou indisponible.</p>
          )}
          {googleStatus === 'pending' && (
            <p className="mt-1">Connexion Google en cours...</p>
          )}
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
              <option value={UserRole.RESPONSABLE}>Responsable</option>
              <option value={UserRole.RH}>Ressources Humaines</option>
              <option value={UserRole.COMMERCIAL}>Commercial</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Secteurs</label>
          <div className="flex flex-wrap gap-2">
            {SECTEUR_VALUES.map((secteur) => {
              const active = sectors.includes(secteur)
              return (
                <button
                  type="button"
                  key={secteur}
                  onClick={() =>
                    setSectors((prev) =>
                      prev.includes(secteur) ? prev.filter((s) => s !== secteur) : [...prev, secteur],
                    )
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    active
                      ? 'bg-blue text-white border-blue'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue'
                  }`}
                >
                  <MapPin size={14} />
                  {secteur}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-gray-400">
            Détermine le dossier Drive des candidats créés par cet utilisateur.
          </p>
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

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={linkGoogle}
            onChange={(e) => setLinkGoogle(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue focus:ring-blue"
          />
          <Globe size={16} className="text-gray-400" />
          <span className="text-sm text-gray-600">Connecter un compte Google</span>
        </label>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button
          type="submit"
          size="lg"
          className="w-full rounded-[10px]"
          disabled={isBusy}
        >
          {fetching ? 'Création...' : "Créer l'utilisateur"}
        </Button>
      </form>
      </div>
    </div>
  )
}

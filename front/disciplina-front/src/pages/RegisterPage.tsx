import { useState } from 'react'
import { IconGlobe, IconMail, IconMapPin, IconShield, IconShieldCheck, IconUser } from '@/components/ui/icons'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
import PasswordInput from '@/components/ui/PasswordInput'
import PasswordStrength from '@/components/ui/PasswordStrength'
import { UserRole, Permission } from '@/store/authStore'
import { useRegionStore } from '@/store/regionStore'
import { useGoogleOAuthPopup } from '@/hooks/useGoogleOAuthPopup'
import { userSecteursForRegion } from '@/constants/secteurs'
import { apiJson } from '@/api/httpClient'

export default function RegisterPage() {
  const { connectGoogle, isLoading: googleLoading } = useGoogleOAuthPopup()
  const region = useRegionStore((s) => s.region)
  // Secteurs assignables selon le tenant (Annemasse : 6 opérationnels).
  const secteurOptions = userSecteursForRegion(region)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [firstname, setFirstname] = useState('')
  const [lastname, setLastname] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>(UserRole.COMMERCIAL)
  const [permission, setPermission] = useState<Permission>(Permission.EMPLOYEE)
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
      const data = await apiJson<{ id: number }>('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          firstName: firstname,
          lastName: lastname,
          passwordPlain: password,
          role,
          permission,
          sectors,
        }),
      })

      setSuccess(true)
      setFirstname('')
      setLastname('')
      setEmail('')
      setPassword('')
      setConfirmPassword('')
      setRole(UserRole.COMMERCIAL)
      setPermission(Permission.EMPLOYEE)
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau')
    } finally {
      setFetching(false)
    }
  }

  const isBusy = fetching || googleLoading

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-5">
      <div className="w-full bg-[var(--ds-surface)] rounded-[20px] p-8 shadow-sm">
      <div className="text-center mb-6">
        <h2>Créer un utilisateur</h2>
        <p className="mt-1 text-sm text-[var(--ds-text-subtle)]">
          Ajouter un nouveau membre à la plateforme
        </p>
      </div>

      {success && (
        <div className="mb-6 p-4 bg-[var(--ds-success-bg)] text-[var(--ds-success)] rounded-lg text-sm border border-[var(--ds-success)]">
          <p className="font-medium">L'utilisateur a été créé avec succès.</p>
          {googleStatus === 'connected' && (
            <p className="mt-1">Compte Google connecté.</p>
          )}
          {googleStatus === 'skipped' && (
            <p className="mt-1 text-[var(--ds-text-muted)]">Connexion Google ignorée.</p>
          )}
          {googleStatus === 'failed' && (
            <p className="mt-1 text-[var(--ds-warning)]">Connexion Google annulée ou indisponible.</p>
          )}
          {googleStatus === 'pending' && (
            <p className="mt-1">Connexion Google en cours...</p>
          )}
        </div>
      )}

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="role" className="text-sm font-medium text-[var(--ds-text-muted)]">
            Rôle
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--ds-text-subtle)]">
              <IconShield width={18} height={18} />
            </div>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full pl-10 pr-4 py-2.5 bg-[var(--ds-surface-sunken)] border border-[var(--ds-border)] rounded-[10px] text-sm text-[var(--ds-text)] focus:ring-2 focus:ring-blue focus:border-blue transition-colors appearance-none"
              required
            >
              <option value={UserRole.AD}>Administrateur</option>
              <option value={UserRole.GESTION}>Gestion</option>
              <option value={UserRole.COMMERCIAL}>Commercial</option>
              <option value={UserRole.RH}>Ressources Humaines</option>
              <option value={UserRole.PEDA}>Pédagogique</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="permission" className="text-sm font-medium text-[var(--ds-text-muted)]">
            Niveau de permission
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--ds-text-subtle)]">
              <IconShield width={18} height={18} />
            </div>
            <select
              id="permission"
              value={permission}
              onChange={(e) => setPermission(e.target.value as Permission)}
              className="w-full pl-10 pr-4 py-2.5 bg-[var(--ds-surface-sunken)] border border-[var(--ds-border)] rounded-[10px] text-sm text-[var(--ds-text)] focus:ring-2 focus:ring-blue focus:border-blue transition-colors appearance-none"
              required
            >
              <option value={Permission.EMPLOYEE}>Employé</option>
              <option value={Permission.RESPONSABLE}>Responsable</option>
              <option value={Permission.ADMIN}>Administrateur</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[var(--ds-text-muted)]">Secteurs</label>
          <div className="flex flex-wrap gap-2">
            {secteurOptions.map((secteur) => {
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
                      : 'bg-[var(--ds-surface-sunken)] text-[var(--ds-text-muted)] border-[var(--ds-border)] hover:border-blue'
                  }`}
                >
                  <IconMapPin width={14} height={14} />
                  {secteur}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-[var(--ds-text-subtle)]">
            Détermine le dossier Drive des candidats créés par cet utilisateur.
          </p>
        </div>

        <InputField
          label="Prénom"
          id="firstname"
          type="text"
          placeholder="Jean"
          icon={<IconUser width={18} height={18} />}
          value={firstname}
          onChange={(e) => setFirstname(e.target.value)}
          required
        />

        <InputField
          label="Nom"
          id="lastname"
          type="text"
          placeholder="Dupont"
          icon={<IconUser width={18} height={18} />}
          value={lastname}
          onChange={(e) => setLastname(e.target.value)}
          required
        />

        <InputField
          label="Adresse email"
          id="email"
          type="email"
          placeholder="vous@exemple.fr"
          icon={<IconMail width={18} height={18} />}
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
          icon={<IconShieldCheck width={18} height={18} />}
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
            className="h-4 w-4 rounded border-[var(--ds-border-strong)] text-blue focus:ring-blue"
          />
          <IconGlobe width={16} height={16} className="text-[var(--ds-text-subtle)]" />
          <span className="text-sm text-[var(--ds-text-muted)]">Connecter un compte Google</span>
        </label>

        {error && <p className="text-sm text-[var(--ds-danger)]">{error}</p>}

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

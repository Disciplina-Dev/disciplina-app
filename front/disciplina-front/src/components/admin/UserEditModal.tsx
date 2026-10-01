import { useEffect, useState } from 'react'
import { IconClose, IconLoader, IconMail, IconMapPin, IconShield, IconUser } from '@/components/ui/icons'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
import PasswordInput from '@/components/ui/PasswordInput'
import { Permission } from '@/store/authStore'
import { useRegionStore } from '@/store/regionStore'
import { userSecteursForRegion } from '@/constants/secteurs'
import { apiJson } from '@/api/httpClient'

export interface ManagedUser {
  id: number
  email: string
  firstName: string
  lastName: string
  role: string
  permission: string
  sectors: string[] | null
}

const ROLES = [
  { value: 'AD', label: 'Administrateur' },
  { value: 'GESTION', label: 'Gestion' },
  { value: 'COMMERCIAL', label: 'Commercial' },
  { value: 'RH', label: 'Ressources Humaines' },
]

const PERMISSIONS = [
  { value: Permission.EMPLOYEE, label: 'Employé' },
  { value: Permission.RESPONSABLE, label: 'Responsable' },
  { value: Permission.ADMIN, label: 'Administrateur' },
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface Props {
  user: ManagedUser
  onClose: () => void
  onSaved: (updated: ManagedUser) => void
}

export default function UserEditModal({ user, onClose, onSaved }: Props) {
  const region = useRegionStore((s) => s.region)
  // Secteurs assignables selon le tenant (Annemasse : 6 opérationnels).
  // Les secteurs déjà assignés restent affichés même hors référentiel.
  const secteurOptions = [...new Set([...userSecteursForRegion(region), ...(user.sectors ?? [])])]
  const [firstName, setFirstName] = useState(user.firstName)
  const [lastName, setLastName] = useState(user.lastName)
  const [email, setEmail] = useState(user.email)
  const [role, setRole] = useState(user.role)
  const [permission, setPermission] = useState(user.permission)
  const [sectors, setSectors] = useState<string[]>(user.sectors ?? [])
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fermeture clavier (Échap) — réflexe d'accessibilité.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const emailError = email && !EMAIL_RE.test(email) ? 'Email invalide' : undefined
  const passwordError = password && password.length < 8 ? 'Minimum 8 caractères' : undefined

  const toggleSector = (secteur: string) =>
    setSectors((prev) =>
      prev.includes(secteur) ? prev.filter((s) => s !== secteur) : [...prev, secteur],
    )

  const handleSave = async () => {
    if (emailError || passwordError || !firstName.trim() || !lastName.trim()) {
      setError('Vérifiez les champs du formulaire.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const data = await apiJson<ManagedUser>(`/api/auth/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          role,
          permission,
          sectors,
          ...(password ? { passwordPlain: password } : {}),
        }),
      })
      onSaved({
        id: data.id,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        permission: data.permission,
        sectors: data.sectors ?? [],
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[var(--ds-surface)] rounded-[20px] p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-[var(--ds-text)]">Modifier l'utilisateur</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--ds-text-subtle)] hover:text-[var(--ds-text-muted)] transition-colors"
            aria-label="Fermer"
          >
            <IconClose width={20} height={20} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <InputField
              label="Prénom"
              id="edit-firstname"
              icon={<IconUser width={18} height={18} />}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <InputField
              label="Nom"
              id="edit-lastname"
              icon={<IconUser width={18} height={18} />}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>

          <InputField
            label="Email"
            id="edit-email"
            type="email"
            icon={<IconMail width={18} height={18} />}
            value={email}
            error={emailError}
            onChange={(e) => setEmail(e.target.value)}
          />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-role" className="text-sm font-medium text-[var(--ds-text-muted)]">
              Rôle
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--ds-text-subtle)]">
                <IconShield width={18} height={18} />
              </span>
              <select
                id="edit-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[var(--ds-surface)] border border-[var(--ds-border)] rounded-[10px] text-sm text-[var(--ds-text)] focus:border-blue outline-none transition-colors appearance-none"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-permission" className="text-sm font-medium text-[var(--ds-text-muted)]">
              Niveau de permission
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--ds-text-subtle)]">
                <IconShield width={18} height={18} />
              </span>
              <select
                id="edit-permission"
                value={permission}
                onChange={(e) => setPermission(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[var(--ds-surface)] border border-[var(--ds-border)] rounded-[10px] text-sm text-[var(--ds-text)] focus:border-blue outline-none transition-colors appearance-none"
              >
                {PERMISSIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
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
                    onClick={() => toggleSector(secteur)}
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
          </div>

          <PasswordInput
            label="Nouveau mot de passe (optionnel)"
            id="edit-password"
            placeholder="Laisser vide pour conserver"
            value={password}
            error={passwordError}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <p className="text-sm text-[var(--ds-danger)]">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
              Annuler
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? (
                <span className="inline-flex items-center gap-1.5">
                  <IconLoader width={14} height={14} className="animate-spin" /> Enregistrement…
                </span>
              ) : (
                'Enregistrer'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { X, Shield, User as UserIcon, Mail, MapPin, Loader2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
import PasswordInput from '@/components/ui/PasswordInput'
import { Permission, useAuthStore } from '@/store/authStore'
import { SECTEUR_VALUES } from '@/types/entreprise'

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
  const token = useAuthStore((s) => s.token)
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
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Échec de la mise à jour')
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
        className="w-full max-w-md bg-white rounded-[20px] p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900">Modifier l'utilisateur</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 transition-colors"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <InputField
              label="Prénom"
              id="edit-firstname"
              icon={<UserIcon size={18} />}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <InputField
              label="Nom"
              id="edit-lastname"
              icon={<UserIcon size={18} />}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>

          <InputField
            label="Email"
            id="edit-email"
            type="email"
            icon={<Mail size={18} />}
            value={email}
            error={emailError}
            onChange={(e) => setEmail(e.target.value)}
          />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-role" className="text-sm font-medium text-gray-700">
              Rôle
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                <Shield size={18} />
              </span>
              <select
                id="edit-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-100 rounded-[10px] text-sm text-gray-900 focus:border-blue outline-none transition-colors appearance-none"
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
            <label htmlFor="edit-permission" className="text-sm font-medium text-gray-700">
              Niveau de permission
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                <Shield size={18} />
              </span>
              <select
                id="edit-permission"
                value={permission}
                onChange={(e) => setPermission(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-100 rounded-[10px] text-sm text-gray-900 focus:border-blue outline-none transition-colors appearance-none"
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
            <label className="text-sm font-medium text-gray-700">Secteurs</label>
            <div className="flex flex-wrap gap-2">
              {SECTEUR_VALUES.map((secteur) => {
                const active = sectors.includes(secteur)
                return (
                  <button
                    type="button"
                    key={secteur}
                    onClick={() => toggleSector(secteur)}
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
          </div>

          <PasswordInput
            label="Nouveau mot de passe (optionnel)"
            id="edit-password"
            placeholder="Laisser vide pour conserver"
            value={password}
            error={passwordError}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
              Annuler
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 size={14} className="animate-spin" /> Enregistrement…
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

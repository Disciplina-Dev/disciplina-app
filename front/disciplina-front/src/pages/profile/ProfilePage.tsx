import { useState, useRef, useEffect } from 'react'
import { useMutation, gql } from 'urql'
import { useLocation } from 'react-router-dom'
import { useCurrentUser, useAuthStore, UserRole, Permission } from '@/store/authStore'
import { useMailTemplatesStore } from '@/store/mailTemplatesStore'
import type { MailTemplatesScope } from '@/store/mailTemplatesStore'
import {
  KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle, User,
  ImagePlus, Save, Trash2, Mail, MapPin,
} from 'lucide-react'

const CHANGE_PASSWORD_MUTATION = gql`
  mutation ChangePassword($currentPassword: String!, $newPassword: String!) {
    changePassword(currentPassword: $currentPassword, newPassword: $newPassword)
  }
`

const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.COMMERCIAL]: 'Commercial',
  [UserRole.RH]: 'Ressources Humaines',
  [UserRole.PEDA]: 'Pédagogique',
  [UserRole.AD]: 'Administrateur',
  [UserRole.GESTION]: 'Gestion',
  [UserRole.ENTREPRISE]: 'Entreprise',
}

const SECTOR_LABELS: Record<string, string> = {
  NORD: 'Nord-Est',
  OUEST: 'Ouest',
  SUD: 'Sud',
}

function useAccentColor() {
  const role = useAuthStore((s) => s.user?.role)
  if (role === UserRole.PEDA) return '#0F766E'
  return role === UserRole.RH ? '#60207E' : '#1130A7'
}

function useMailScope(): MailTemplatesScope {
  const { pathname } = useLocation()
  if (pathname.startsWith('/peda')) return 'peda'
  return pathname.startsWith('/rh') ? 'rh' : 'commercial'
}

// ── Password field ───────────────────────────────────────────────────────────

function PasswordInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="new-password"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-10 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent"
        />
        <button
          type="button"
          onClick={() => setShow((p) => !p)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          tabIndex={-1}
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  )
}

// ── Signature editor ─────────────────────────────────────────────────────────

function SignatureEditor({
  accent,
  scope,
}: {
  accent: string
  scope: MailTemplatesScope
}) {
  const { signatureImage, loading, loaded, load, setSignature, removeSignature } =
    useMailTemplatesStore(scope)
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState(signatureImage)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { if (!loaded) load() }, [loaded, load])
  useEffect(() => { setPreview(signatureImage); setFile(null) }, [signatureImage])

  function handleFile(f: File | undefined) {
    if (!f) return
    setFile(f)
    setSaved(false)
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result as string)
    reader.readAsDataURL(f)
  }

  async function handleSave() {
    if (!file) return
    setSaving(true)
    setError(null)
    try {
      await setSignature(file)
      setFile(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Échec de l\'enregistrement')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    setError(null)
    try {
      await removeSignature()
      setPreview('')
      setFile(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Échec de la suppression')
    }
  }

  if (loading && !loaded) {
    return <div className="text-sm text-gray-400 py-4 text-center">Chargement…</div>
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Drop zone / preview */}
      {preview ? (
        <div className="relative group rounded-xl border border-gray-100 bg-gray-50 p-4 flex items-center justify-center min-h-[100px]">
          <img
            src={preview}
            alt="Signature"
            className="max-w-full max-h-40 object-contain"
          />
          {/* overlay on hover */}
          <label className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-xl bg-black/0 group-hover:bg-black/40 transition-all cursor-pointer opacity-0 group-hover:opacity-100">
            <ImagePlus size={20} className="text-white" />
            <span className="text-xs font-semibold text-white">Remplacer</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </label>
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-200 py-10 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors">
          <ImagePlus size={24} />
          <div className="text-center">
            <p className="text-sm font-medium">Importer votre signature</p>
            <p className="text-xs mt-0.5">PNG, JPG, GIF, WebP</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
          <AlertCircle size={13} /> {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-3">
        {preview && (
          <button
            onClick={handleRemove}
            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 transition-colors"
          >
            <Trash2 size={13} /> Supprimer
          </button>
        )}
        <button
          disabled={!file || saving}
          onClick={handleSave}
          className="ml-auto flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-lg transition-opacity disabled:opacity-40 hover:opacity-90"
          style={{ backgroundColor: accent }}
        >
          <Save size={13} />
          {saving ? 'Enregistrement…' : saved ? 'Enregistré !' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const user = useCurrentUser()
  const accent = useAccentColor()
  const scope = useMailScope()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)

  const [{ fetching }, changePassword] = useMutation(CHANGE_PASSWORD_MUTATION)

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwSuccess(false)
    setPwError(null)

    if (newPassword.length < 8) {
      setPwError('Le nouveau mot de passe doit contenir au moins 8 caractères')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwError('Les mots de passe ne correspondent pas')
      return
    }
    if (currentPassword === newPassword) {
      setPwError('Le nouveau mot de passe doit être différent de l\'actuel')
      return
    }

    const result = await changePassword({ currentPassword, newPassword })
    if (result.error) {
      setPwError(result.error.graphQLErrors?.[0]?.message ?? result.error.message)
    } else {
      setPwSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  const showSectors =
    user?.role === UserRole.RH ||
    user?.permission === Permission.RESPONSABLE ||
    user?.role === UserRole.AD ||
    user?.role === UserRole.GESTION

  if (!user) return null

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Mon profil</h1>
        <p className="text-sm text-gray-500 mt-0.5">Informations et paramètres de compte</p>
      </div>

      {/* ── Identity ── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-lg font-bold text-white shadow-md"
            style={{ backgroundColor: accent }}
          >
            {user.initials ?? <User size={24} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-gray-900 truncate">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-sm text-gray-500 truncate">{user.email}</p>
            <span
              className="mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white"
              style={{ backgroundColor: accent }}
            >
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
          </div>
        </div>

        {/* Sectors (RH / RESPONSABLE / ADMIN) */}
        {showSectors && (
          <div className="mt-5 pt-5 border-t border-gray-50">
            <div className="flex items-center gap-1.5 mb-2.5">
              <MapPin size={14} style={{ color: accent }} />
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Secteurs assignés</span>
            </div>
            {user.sectors && user.sectors.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {user.sectors.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border"
                    style={{ color: accent, borderColor: accent + '30', backgroundColor: accent + '0d' }}
                  >
                    {SECTOR_LABELS[s] ?? s}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Aucun secteur assigné</p>
            )}
          </div>
        )}
      </section>

      {/* ── Signature mail ── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-1">
          <Mail size={16} style={{ color: accent }} />
          <h2 className="text-base font-bold text-gray-800">Signature mail</h2>
        </div>
        <p className="text-xs text-gray-400 mb-5">
          Ajoutée automatiquement à vos mails · stockée sur votre Drive Google
        </p>
        <SignatureEditor accent={accent} scope={scope} />
      </section>

      {/* ── Password ── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <KeyRound size={16} style={{ color: accent }} />
          <h2 className="text-base font-bold text-gray-800">Changer le mot de passe</h2>
        </div>

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <PasswordInput
            label="Mot de passe actuel"
            value={currentPassword}
            onChange={setCurrentPassword}
            placeholder="••••••••"
          />
          <PasswordInput
            label="Nouveau mot de passe"
            value={newPassword}
            onChange={(v) => { setNewPassword(v); setPwError(null) }}
            placeholder="8 caractères minimum"
          />
          {newPassword.length > 0 && newPassword.length < 8 && (
            <p className="text-xs text-amber-600">
              {8 - newPassword.length} caractère{8 - newPassword.length > 1 ? 's' : ''} manquant{8 - newPassword.length > 1 ? 's' : ''}
            </p>
          )}
          <PasswordInput
            label="Confirmer le nouveau mot de passe"
            value={confirmPassword}
            onChange={(v) => { setConfirmPassword(v); setPwError(null) }}
            placeholder="••••••••"
          />

          {pwError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
              {pwError}
            </div>
          )}
          {pwSuccess && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2.5 text-sm text-green-700">
              <CheckCircle2 size={15} className="flex-shrink-0" />
              Mot de passe modifié avec succès
            </div>
          )}

          <div className="pt-1">
            <button
              type="submit"
              disabled={fetching || !currentPassword || !newPassword || !confirmPassword}
              className="w-full py-2.5 text-sm font-semibold text-white rounded-xl transition-opacity disabled:opacity-40 hover:opacity-90"
              style={{ backgroundColor: accent }}
            >
              {fetching ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

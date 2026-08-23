import { useEffect, useState } from 'react'
import { X, AlertTriangle, Loader2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import type { ManagedUser } from '@/components/admin/UserEditModal'
import { apiJson } from '@/api/httpClient'

interface Props {
  user: ManagedUser
  /** Users actifs du même rôle que `user`, candidats au transfert des relations. */
  replacements: ManagedUser[]
  onClose: () => void
  onDeleted: (id: number) => void
}

export default function DeleteUserModal({ user, replacements, onClose, onDeleted }: Props) {
  const [replacementId, setReplacementId] = useState<string>('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)
    try {
      await apiJson(`/api/auth/users/${user.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(replacementId ? { replacementUserId: Number(replacementId) } : {}),
      })
      onDeleted(user.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau')
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-[20px] p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900">Supprimer l'utilisateur</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 transition-colors"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex items-start gap-3 rounded-[10px] bg-danger/5 border border-danger/20 p-3 mb-4">
          <AlertTriangle size={18} className="text-danger shrink-0 mt-0.5" />
          <p className="text-sm text-gray-700">
            <span className="font-semibold">
              {user.firstName} {user.lastName}
            </span>{' '}
            sera supprimé : ses sessions seront révoquées et il ne pourra plus se connecter.
          </p>
        </div>

        <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1 mb-4">
          <li>Ses entreprises et fiches liées sont transférées au remplaçant choisi ci-dessous.</li>
          <li>
            Sans remplaçant, elles sont détachées mais conservées (l'entreprise reste vivante sans commercial
            attitré).
          </li>
          <li>Ses todos, configurations personnelles et notifications sont définitivement supprimées.</li>
          <li>L'historique (journaux de contact, KPI) est conservé et reste consultable.</li>
        </ul>

        <div className="flex flex-col gap-1.5 mb-4">
          <label htmlFor="delete-replacement" className="text-sm font-medium text-gray-700">
            Remplaçant ({replacements.length > 0 ? 'même rôle' : 'aucun disponible'})
          </label>
          <select
            id="delete-replacement"
            value={replacementId}
            onChange={(e) => setReplacementId(e.target.value)}
            disabled={replacements.length === 0 || deleting}
            className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-[10px] text-sm text-gray-900 focus:border-blue outline-none transition-colors appearance-none disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="">Aucun — détacher les relations</option>
            {replacements.map((r) => (
              <option key={r.id} value={r.id}>
                {r.firstName} {r.lastName} ({r.email})
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={deleting}>
            Annuler
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete} disabled={deleting}>
            {deleting ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 size={14} className="animate-spin" /> Suppression…
              </span>
            ) : (
              'Supprimer'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

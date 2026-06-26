import { useState } from 'react'
import { X, FolderPlus, Loader2, AlertCircle } from 'lucide-react'
import Button from '@/components/ui/Button'
import { useFilizDegrees, useFilizClasses, useCreateFilizFolder } from '@/graphql/hooks'
import { useAuthStore } from '@/store/authStore'

interface FilizFolderModalProps {
  open: boolean
  onClose: () => void
  candidateId: string
  onSuccess: (filizFolderId: string) => void
}

export default function FilizFolderModal({ open, onClose, candidateId, onSuccess }: FilizFolderModalProps) {
  const user = useAuthStore(s => s.user)
  const [selectedDegreeId, setSelectedDegreeId] = useState<string | null>(null)
  const [selectedClassId, setSelectedClassId] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { degrees, fetching: loadingDegrees } = useFilizDegrees()
  const { classes, fetching: loadingClasses } = useFilizClasses(selectedDegreeId)
  const { createFilizFolder } = useCreateFilizFolder()

  const fileManagerFirstName = user?.firstName ?? ''
  const fileManagerLastName = user?.lastName ?? ''

  const handleDegreeChange = (degreeId: string) => {
    setSelectedDegreeId(degreeId || null)
    setSelectedClassId('')
  }

  const handleSubmit = async () => {
    if (!selectedClassId) {
      setError('Veuillez sélectionner une promotion.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const result = await createFilizFolder({
        candidateId,
        classId: selectedClassId,
        fileManagerFirstName,
        fileManagerLastName,
        fileManagerEmail: user?.email ?? '',
      })
      if (result?.folderId) {
        onSuccess(result.folderId)
        onClose()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création du dossier Filiz')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="filiz-modal-title"
    >
      <div
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--color-purple-light)' }}
            >
              <FolderPlus size={18} style={{ color: 'var(--color-purple)' }} />
            </div>
            <h2 id="filiz-modal-title" className="text-lg font-bold text-gray-900">
              Créer dossier Filiz
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          {error && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-danger-bg text-danger text-sm">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Formation</label>
            {loadingDegrees ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 size={14} className="animate-spin" /> Chargement…
              </div>
            ) : (
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                value={selectedDegreeId ?? ''}
                onChange={e => handleDegreeChange(e.target.value)}
              >
                <option value="">Sélectionner une formation</option>
                {degrees.map(d => (
                  <option key={d.degreeId} value={d.degreeId}>
                    {d.exactDegreeTitle}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Promotion</label>
            {loadingClasses ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 size={14} className="animate-spin" /> Chargement…
              </div>
            ) : (
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:opacity-50"
                value={selectedClassId}
                onChange={e => setSelectedClassId(e.target.value)}
                disabled={!selectedDegreeId}
              >
                <option value="">Sélectionner une promotion</option>
                {classes.map(c => (
                  <option key={c.classId} value={c.classId}>
                    {c.className}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Responsable du dossier</label>
            <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
              {`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()} — {user?.email}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={submitting}
            disabled={!selectedClassId || submitting}
          >
            Créer le dossier
          </Button>
        </div>
      </div>
    </div>
  )
}

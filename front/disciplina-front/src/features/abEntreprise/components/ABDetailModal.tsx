import { useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useNeedsAnalysis, useDeleteNeedsAnalysis } from '@/graphql/hooks'
import { ABDetailContent, AB_STATUS_BADGE } from './ABDetailContent'

interface Props {
  id: string
  onClose: () => void
  onDelete?: () => void
}

export default function ABDetailModal({ id, onClose, onDelete }: Props) {
  const result = useNeedsAnalysis(id)
  const { deleteNeedsAnalysis, result: deleteResult } = useDeleteNeedsAnalysis()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const ab = result.data?.needsAnalysis
  const badge = ab ? (AB_STATUS_BADGE[ab.status] ?? AB_STATUS_BADGE['BROUILLON']) : null

  const handleDelete = async () => {
    await deleteNeedsAnalysis(id)
    onDelete?.()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 p-6 pb-4 border-b border-gray-100">
          <div className="min-w-0">
            {result.fetching && <p className="text-sm text-gray-400">Chargement...</p>}
            {ab && (
              <>
                <h2 className="text-lg font-bold text-gray-900 truncate">{ab.jobTitle}</h2>
                <div className="flex items-center gap-2 mt-1">
                  {badge && (
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>
                      {badge.label}
                    </span>
                  )}
                  {ab.createdAt && (
                    <span className="text-xs text-gray-400">
                      Créé le {format(new Date(ab.createdAt), 'd MMM yyyy', { locale: fr })}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {ab && !confirmDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                title="Supprimer cette AB"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-50 shrink-0"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {confirmDelete && (
          <div className="flex items-center justify-between gap-3 bg-red-50 px-6 py-3 border-b border-red-100">
            <p className="text-sm text-red-700 font-medium">Supprimer cette analyse du besoin ?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteResult.fetching}
                className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deleteResult.fetching ? 'Suppression…' : 'Confirmer'}
              </button>
            </div>
          </div>
        )}

        {/* Body */}
        {ab && (
          <div className="overflow-y-auto flex-1 p-6">
            <ABDetailContent ab={ab} />
          </div>
        )}
      </div>
    </div>
  )
}

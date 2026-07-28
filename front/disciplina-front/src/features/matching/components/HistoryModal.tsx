import { useState } from 'react'
import { ChevronDown, History, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useOfferHistory, useAddOfferHistoryEntry, useDeleteOfferHistoryEntry } from '@/graphql/hooks'
import { useCurrentUser } from '@/store/authStore'
import Button from '@/components/ui/Button'

function formatDate(iso: string | null | undefined) {
  if (!iso) return null
  try { return format(new Date(iso), 'd MMM yyyy à HH:mm', { locale: fr }) } catch { return iso }
}

interface HistoryModalProps {
  offerId: string
}

export default function HistoryModal({ offerId }: HistoryModalProps) {
  const [expanded, setExpanded] = useState(false)
  const [text, setText] = useState('')
  const currentUser = useCurrentUser()
  const { history, loading, refetch } = useOfferHistory(expanded ? offerId : null)
  const { addEntry } = useAddOfferHistoryEntry()
  const { deleteEntry } = useDeleteOfferHistoryEntry()

  const handleToggle = () => setExpanded(!expanded)

  const handleAddNote = async () => {
    if (!text.trim()) return
    await addEntry(offerId, text.trim())
    setText('')
    refetch()
  }

  const handleDelete = async (id: string) => {
    await deleteEntry(id)
    refetch()
  }

  return (
    <div className="border-t border-gray-100 pt-4 mt-4">
      <div className="flex items-center gap-3 mb-3">
        <History className="w-5 h-5 text-blue" />
        <h3 className="text-base font-semibold text-gray-900">Historique du poste</h3>
      </div>

      {!expanded ? (
        <button
          type="button"
          onClick={handleToggle}
          className="flex items-center gap-2 text-blue font-semibold text-sm py-2 px-3 rounded-lg border border-blue-light bg-blue-light/50 hover:bg-blue-light cursor-pointer transition-colors"
        >
          <ChevronDown className="w-4 h-4" />
          Voir l'historique
        </button>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ajouter une note à l'historique..."
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue/20 resize-none"
            />
            <Button size="sm" onClick={handleAddNote} disabled={!text.trim()}>
              Ajouter
            </Button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-6">
              <div className="w-5 h-5 border-2 border-blue border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && history.length === 0 && (
            <div className="text-center py-6 px-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Aucun historique</p>
            </div>
          )}

          {!loading && history.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {history.map((entry: any) => {
                const isAuto = entry.firstName === null && entry.lastName === null
                const canDelete = entry.ownerEmail !== null && entry.ownerEmail === currentUser?.email
                return (
                  <div key={entry.id} className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{entry.text}</p>
                        <p className="text-xs text-gray-600 mt-1">
                          {formatDate(entry.createdAt)}
                          {' · '}
                          {isAuto
                            ? 'Système'
                            : entry.ownerEmail
                              ? `${entry.firstName} ${entry.lastName} (${entry.ownerEmail})`
                              : `${entry.firstName} ${entry.lastName}`}
                        </p>
                      </div>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDelete(entry.id)}
                          className="text-gray-400 hover:text-danger transition-colors cursor-pointer shrink-0"
                          aria-label="Supprimer cette entrée"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <button
            type="button"
            onClick={handleToggle}
            className="text-blue font-semibold text-sm py-2 px-3 hover:text-blue/80 transition-colors"
          >
            Réduire
          </button>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { IconChevronDown, IconHistory, IconTrash } from '@/components/ui/icons'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useAddCandidateHistoryEntry, useCandidateHistory, useDeleteCandidateHistoryEntry } from '@/graphql/hooks'
import { useCurrentUser } from '@/store/authStore'
import { CandidateHistoryType } from '@/types/candidate'
import Button from '@/components/ui/Button'

function formatDate(iso: string | null | undefined) {
  if (!iso) return null
  try { return format(new Date(iso), 'd MMM yyyy à HH:mm', { locale: fr }) } catch { return iso }
}

const HISTORY_TYPE_LABEL: Record<CandidateHistoryType, string> = {
  [CandidateHistoryType.RH]: 'RH',
  [CandidateHistoryType.CANDIDATE]: 'Candidat',
  [CandidateHistoryType.COMPANY]: 'Entreprise',
}

const HISTORY_TYPE_BADGE_CLASS: Record<CandidateHistoryType, string> = {
  [CandidateHistoryType.RH]: 'bg-blue-light text-blue',
  [CandidateHistoryType.CANDIDATE]: 'bg-purple/10 text-purple',
  [CandidateHistoryType.COMPANY]: 'bg-success/10 text-[var(--ds-success)]',
}

interface CandidateHistoryProps {
  candidateId: string
}

export default function CandidateHistory({ candidateId }: CandidateHistoryProps) {
  const [expanded, setExpanded] = useState(false)
  const [note, setNote] = useState('')
  const currentUser = useCurrentUser()
  const { history, loading, refetch } = useCandidateHistory(expanded ? candidateId : null)
  const { addHistoryEntry } = useAddCandidateHistoryEntry()
  const { deleteHistoryEntry } = useDeleteCandidateHistoryEntry()

  const handleToggle = () => setExpanded(!expanded)

  const handleAddNote = async () => {
    if (!note.trim()) return
    await addHistoryEntry(candidateId, note.trim())
    setNote('')
    refetch()
  }

  const handleDelete = async (id: string) => {
    await deleteHistoryEntry(id)
    refetch()
  }

  return (
    <div className="border-t border-[var(--ds-border)] pt-6 mt-6">
      <div className="flex items-center gap-3 mb-4">
        <IconHistory className="w-5 h-5 text-blue" />
        <h3 className="text-lg font-semibold text-[var(--ds-text)]">Historique du candidat</h3>
      </div>

      {!expanded ? (
        <button
          type="button"
          onClick={handleToggle}
          className="flex items-center gap-2 text-blue font-semibold text-sm py-2 px-3 rounded-lg border border-blue-light bg-blue-light/50 hover:bg-blue-light cursor-pointer transition-colors"
        >
          <IconChevronDown className="w-4 h-4" />
          Voir l'historique
        </button>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ajouter une note à l'historique..."
              className="flex-1 rounded-lg border border-[var(--ds-border-strong)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue/20"
            />
            <Button size="sm" onClick={handleAddNote} disabled={!note.trim()}>
              Ajouter
            </Button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-blue border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && history.length === 0 && (
            <div className="text-center py-6 px-4 bg-[var(--ds-surface-sunken)] rounded-lg">
              <p className="text-sm text-[var(--ds-text-muted)]">Aucun historique</p>
            </div>
          )}

          {!loading && history.length > 0 && (
            <div className="space-y-2">
              {history.map((entry) => {
                const canDelete = entry.ownerEmail !== null && entry.ownerEmail === currentUser?.email
                return (
                  <div key={entry.id} className="bg-[var(--ds-surface-sunken)] border border-[var(--ds-border)] rounded-lg px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--ds-text)]">{entry.description}</p>
                        <p className="text-xs text-[var(--ds-text-muted)] mt-1">
                          {formatDate(entry.createdAt)}
                          {' · '}
                          {entry.ownerEmail ? `par ${entry.ownerEmail}` : 'Auto'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${HISTORY_TYPE_BADGE_CLASS[entry.type]}`}
                        >
                          {HISTORY_TYPE_LABEL[entry.type]}
                        </span>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDelete(entry.id)}
                            className="text-[var(--ds-text-subtle)] hover:text-[var(--ds-danger)] transition-colors cursor-pointer"
                            aria-label="Supprimer cette entrée"
                          >
                            <IconTrash className="w-4 h-4" />
                          </button>
                        )}
                      </div>
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

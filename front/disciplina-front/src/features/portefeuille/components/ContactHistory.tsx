import { useState, useEffect } from 'react'
import { ChevronDown, PhoneCall } from 'lucide-react'
import { useContactLogs } from '@/graphql/hooks'
import { USERS } from '@/store/authStore'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

function formatDate(iso: string | null | undefined) {
  if (!iso) return null
  try { return format(new Date(iso), "d MMM yyyy 'à' HH:mm", { locale: fr }) } catch { return iso }
}

function authorName(userID: number) {
  return USERS[String(userID)]?.name ?? `Utilisateur #${userID}`
}

interface ContactHistoryProps {
  companyID: number
  /** Incrémenté par le parent après un nouvel appel pour forcer le refetch. */
  refreshKey?: number
}

interface ContactLogEntry {
  id: number
  userID: number
  comment: string
  createdAt: string
}

export default function ContactHistory({ companyID, refreshKey = 0 }: ContactHistoryProps) {
  const [expanded, setExpanded] = useState(false)
  const { data, fetching, refetch } = useContactLogs(expanded ? companyID : null)

  // Un nouvel appel logué déplie et rafraîchit la liste.
  useEffect(() => {
    if (refreshKey > 0) {
      setExpanded(true)
      refetch()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  const logs: ContactLogEntry[] = data?.contactLogs ?? []

  return (
    <div className="border-t border-gray-100 pt-6 mt-6">
      <div className="flex items-center gap-3 mb-4">
        <PhoneCall className="w-5 h-5 text-blue" />
        <h3 className="text-lg font-semibold text-gray-900">Historique des prises de contact</h3>
        {expanded && logs.length > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-light text-blue">
            {logs.length}
          </span>
        )}
      </div>

      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex items-center gap-2 text-blue font-semibold text-sm py-2 px-3 rounded-lg border border-blue-light bg-blue-light/50 hover:bg-blue-light cursor-pointer transition-colors"
        >
          <ChevronDown className="w-4 h-4" />
          Voir les prises de contact
        </button>
      ) : (
        <div className="space-y-4">
          {fetching && (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-blue border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!fetching && logs.length === 0 && (
            <div className="text-center py-6 px-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Aucune prise de contact</p>
            </div>
          )}

          {!fetching && logs.length > 0 && (
            <div className="space-y-2">
              {logs.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span className="text-sm font-medium text-gray-900">{authorName(entry.userID)}</span>
                    <span className="text-xs text-gray-500 whitespace-nowrap">{formatDate(entry.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{entry.comment}</p>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="text-blue font-semibold text-sm py-2 px-3 hover:text-blue/80 transition-colors"
          >
            Réduire
          </button>
        </div>
      )}
    </div>
  )
}

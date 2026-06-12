import { useState } from 'react'
import { ChevronDown, History } from 'lucide-react'
import { useCompanyHistory } from '@/graphql/hooks'
import { format } from 'date-fns'

function formatDate(iso: string | null | undefined) {
  if (!iso) return null
  try { return format(new Date(iso), 'd MMM yyyy', { locale: fr }) } catch { return iso }
}

interface CompanyHistoryProps {
  companyID: number
}

interface HistoryEntry {
  id: number
  updatedAt: string
  updatedColumn: string
  status: string
}

export default function CompanyHistory({ companyID }: CompanyHistoryProps) {
  const [expanded, setExpanded] = useState(false)
  const { data, fetching } = useCompanyHistory(expanded ? companyID : null)

  const history: HistoryEntry[] = data?.companyHistory ?? []

  const handleToggle = () => {
    setExpanded(!expanded)
  }

  return (
    <div className="border-t border-gray-100 pt-6 mt-6">
      <div className="flex items-center gap-3 mb-4">
        <History className="w-5 h-5 text-blue" />
        <h3 className="text-lg font-semibold text-gray-900">Historique des modifications</h3>
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
          {fetching && (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-blue border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!fetching && history.length === 0 && (
            <div className="text-center py-6 px-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Aucune modification</p>
            </div>
          )}

          {!fetching && history.length > 0 && (
            <div className="space-y-2">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {entry.updatedColumn}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {formatDate(entry.updatedAt)}
                      </p>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-light text-blue whitespace-nowrap">
                      {entry.status}
                    </span>
                  </div>
                </div>
              ))}
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

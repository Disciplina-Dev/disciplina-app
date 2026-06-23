import { useState } from 'react'
import { ChevronDown, History, ArrowRight } from 'lucide-react'
import { useCompanyHistory } from '@/graphql/hooks'
import { USERS } from '@/store/authStore'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'


function formatDate(iso: string | null | undefined) {
  if (!iso) return null
  try { return format(new Date(iso), "d MMM yyyy 'à' HH:mm", { locale: fr }) } catch { return iso }
}

function authorName(modifiedBy: number | null) {
  if (modifiedBy == null) return 'Inconnu'
  return USERS[String(modifiedBy)]?.name ?? `Utilisateur #${modifiedBy}`
}

// Noms bruts des colonnes DB stockés dans updated_column → libellés lisibles.
const COLUMN_LABELS: Record<string, string> = {
  user_id: 'Propriétaire',
  legal_referent: 'Représentant légal',
  name: 'Nom',
  phone: 'Téléphone',
  email: 'E-mail',
  address: 'Adresse',
  sector: 'Secteur',
  main_activity: 'Métier / Description',
  siret: 'SIRET',
  idcc: 'IDCC',
  ape: 'APE',
  notes: 'Note',
  conclusion: 'Conclusion',
  status: 'Statut',
  relance_date: 'Date de relance',
  relance_type: 'Type de relance',
  relance_template_id: 'Modèle de relance',
}

function formatColumns(raw: string) {
  return raw
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => COLUMN_LABELS[c] ?? c)
    .join(', ')
}

interface CompanyHistoryProps {
  companyID: number
}

interface HistoryEntry {
  id: number
  updatedAt: string
  updatedColumn: string
  status: string
  previousStatus: string | null
  modifiedBy: number | null
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
              {history.map((entry) => {
                const statusChanged = entry.previousStatus != null && entry.previousStatus !== entry.status
                const fields = formatColumns(entry.updatedColumn)
                return (
                  <div
                    key={entry.id}
                    className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3"
                  >
                    {/* Phrase lisible : qui a modifié quoi */}
                    <p className="text-sm text-gray-900">
                      <span className="font-semibold">{authorName(entry.modifiedBy)}</span>
                      {fields ? <> a modifié <span className="font-medium text-gray-700">{fields}</span></> : ' a modifié la fiche'}
                    </p>

                    {/* Transition de statut, si le statut a changé */}
                    {statusChanged && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <span className="text-xs text-gray-500">Statut :</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                          {entry.previousStatus}
                        </span>
                        <ArrowRight className="w-3 h-3 text-gray-400" />
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-light text-blue">
                          {entry.status}
                        </span>
                      </div>
                    )}

                    <p className="text-xs text-gray-400 mt-1.5">{formatDate(entry.updatedAt)}</p>
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

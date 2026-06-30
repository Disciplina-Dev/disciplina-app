import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Mail, Phone, History } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { getCompanyRelanceHistory, type RelanceHistoryEntry } from '@/api/relance'
import { getRelanceType } from '@/types/relance'

// Historique des relances d'une entreprise (mail : objet ; téléphone : résumé).
export default function RelanceHistorySection({ companyId }: { companyId: number }) {
  const token = useAuthStore((s) => s.token) ?? ''
  const [entries, setEntries] = useState<RelanceHistoryEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getCompanyRelanceHistory(token, companyId)
      .then((rows) => { if (!cancelled) setEntries(rows) })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Erreur') })
    return () => { cancelled = true }
  }, [token, companyId])

  return (
    <div className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
        <History className="h-4 w-4 text-gray-400" /> Historique des relances
      </h3>
      {error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : entries === null ? (
        <p className="text-sm text-gray-400">Chargement…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Aucune relance enregistrée.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((e) => {
            const type = getRelanceType(e.typeRelance ?? undefined)
            return (
              <li key={e.id} className="flex gap-3 rounded-lg border border-gray-100 bg-white px-4 py-2.5">
                <div className="mt-0.5 shrink-0 text-gray-400">
                  {e.channel === 'MAIL' ? <Mail className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-gray-700">
                      {e.channel === 'MAIL' ? 'Mail' : 'Téléphone'}
                    </span>
                    {type && <span className="text-xs text-gray-400">· {type.label}</span>}
                    <span className="ml-auto text-xs text-gray-400">
                      {format(new Date(e.createdAt), 'd MMM yyyy', { locale: fr })}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-gray-600 break-words">
                    {e.channel === 'MAIL' ? (e.subject || '—') : (e.note || '—')}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

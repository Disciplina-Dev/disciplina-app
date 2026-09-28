import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { IconHistory, IconMail, IconPhone } from '@/components/ui/icons'
import { getCompanyRelanceHistory, type RelanceHistoryEntry } from '@/api/relance'
import { getRelanceType } from '@/types/relance'

// Historique des relances d'une entreprise (mail : objet ; téléphone : résumé).
export default function RelanceHistorySection({ companyId }: { companyId: number }) {
  const [entries, setEntries] = useState<RelanceHistoryEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getCompanyRelanceHistory(companyId)
      .then((rows) => { if (!cancelled) setEntries(rows) })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Erreur') })
    return () => { cancelled = true }
  }, [companyId])

  return (
    <div className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--ds-text-muted)]">
        <IconHistory className="h-4 w-4 text-[var(--ds-text-subtle)]" /> Historique des relances
      </h3>
      {error ? (
        <p className="text-sm text-[var(--ds-danger)]">{error}</p>
      ) : entries === null ? (
        <p className="text-sm text-[var(--ds-text-subtle)]">Chargement…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-[var(--ds-text-subtle)] italic">Aucune relance enregistrée.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((e) => {
            const type = getRelanceType(e.typeRelance ?? undefined)
            return (
              <li key={e.id} className="flex gap-3 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface)] px-4 py-2.5">
                <div className="mt-0.5 shrink-0 text-[var(--ds-text-subtle)]">
                  {e.channel === 'MAIL' ? <IconMail className="h-4 w-4" /> : <IconPhone className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-[var(--ds-text-muted)]">
                      {e.channel === 'MAIL' ? 'Mail' : 'Téléphone'}
                    </span>
                    {type && <span className="text-xs text-[var(--ds-text-subtle)]">· {type.label}</span>}
                    <span className="ml-auto text-xs text-[var(--ds-text-subtle)]">
                      {format(new Date(e.createdAt), 'd MMM yyyy', { locale: fr })}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-[var(--ds-text-muted)] break-words">
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

import { useEffect, useState } from 'react'
import { IconClose, IconJob, IconSearch } from '@/components/ui/icons'
import { offerGraphqlClient } from '@/graphql/client'
import { GET_OFFERS } from '@/graphql/queries'
import { LOCALISATION_LABELS } from '@/data/reunionCommunes'
import { TP_TYPE_LABELS } from '@/data/candidateTemplates'
import type { MatchedOffer, TitleProfessionalType } from '@/types/candidate'
import { formatScheduleSlots } from '@/utils/schedule'

interface JobSearchModalProps {
  excludedJobIds: Set<string>
  candidateTpTypes?: TitleProfessionalType[]
  singleSelect?: boolean
  allowAnyTpOnSearch?: boolean
  footerAction?: { label: string; onClick: () => void }
  onNonRenseigne?: () => void
  onConfirm: (jobs: MatchedOffer[]) => void
  onClose: () => void
}

function formatSector(raw?: string): string {
  if (!raw) return '—'
  return raw.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

export default function JobSearchModal({
  excludedJobIds,
  candidateTpTypes,
  singleSelect,
  allowAnyTpOnSearch,
  footerAction,
  onNonRenseigne,
  onConfirm,
  onClose,
}: JobSearchModalProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [jobs, setJobs] = useState<MatchedOffer[]>([])
  const [search, setSearch] = useState('')
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const fetchJobs = async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await offerGraphqlClient.query(GET_OFFERS, {}).toPromise()
        if (result.error) {
          setError(result.error.message)
          return
        }
        setJobs(result.data?.offers ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      } finally {
        setLoading(false)
      }
    }
    fetchJobs()
  }, [])

  const visibleJobs = jobs.filter((job) => {
    if (excludedJobIds.has(job.id)) return false
    if (
      !(allowAnyTpOnSearch && search.trim()) &&
      candidateTpTypes?.length &&
      !(job.desiredTp ?? []).some((tp) => tp.tpType && candidateTpTypes.includes(tp.tpType))
    )
      return false
    if (!search.trim()) return true
    return (job.companyName ?? '').toLowerCase().includes(search.trim().toLowerCase())
  })

  const toggleJob = (offerId: string) => {
    if (singleSelect) {
      setSelectedJobIds((prev) => (prev.has(offerId) ? new Set() : new Set([offerId])))
      return
    }
    setSelectedJobIds((prev) => {
      const next = new Set(prev)
      if (next.has(offerId)) next.delete(offerId)
      else next.add(offerId)
      return next
    })
  }

  const handleConfirm = () => {
    onConfirm(jobs.filter((job) => selectedJobIds.has(job.id)))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-[var(--ds-surface)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--ds-border)] p-5">
          <h2 className="text-base font-bold text-[var(--ds-text)]">Rechercher une offre</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-[var(--ds-text-subtle)] hover:bg-[var(--ds-surface-sunken)]">
            <IconClose width={18} height={18} />
          </button>
        </div>

        <div className="border-b border-[var(--ds-border)] p-5">
          <div className="flex items-center gap-2 rounded-lg border border-[var(--ds-border)] px-3 py-2">
            <IconSearch width={16} height={16} className="text-[var(--ds-text-subtle)]" />
            <input
              type="text"
              placeholder="Rechercher par nom d'entreprise..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-blue border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && error && (
            <div className="text-center py-6 px-4 bg-[var(--ds-danger-bg)] rounded-lg">
              <p className="text-sm text-[var(--ds-danger)]">{error}</p>
            </div>
          )}

          {!loading && !error && visibleJobs.length === 0 && (
            <div className="text-center py-6 px-4 bg-[var(--ds-surface-sunken)] rounded-lg">
              <p className="text-sm text-[var(--ds-text-muted)]">Aucune offre ne correspond à cette recherche.</p>
            </div>
          )}

          {!loading && !error && visibleJobs.length > 0 && (
            <div className="flex flex-col gap-2">
              {visibleJobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => toggleJob(job.id)}
                  className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                    selectedJobIds.has(job.id) ? 'border-blue bg-blue-light' : 'border-[var(--ds-border)] hover:bg-[var(--ds-surface-sunken)]'
                  }`}
                >
                  <input
                    type={singleSelect ? 'radio' : 'checkbox'}
                    checked={selectedJobIds.has(job.id)}
                    onChange={() => toggleJob(job.id)}
                    className="h-4 w-4 shrink-0 accent-blue"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="w-8 h-8 flex-shrink-0 rounded-md bg-blue-light text-blue flex items-center justify-center">
                    <IconJob className="w-4 h-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--ds-text)] truncate">{job.companyName || 'Entreprise'}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {(job.desiredTp ?? []).map(
                        (tp) =>
                          tp.tpType && (
                            <span
                              key={tp.tpType}
                              className="inline-flex items-center text-xs font-medium py-0.5 px-2 rounded-full bg-[var(--ds-surface-sunken)] text-[var(--ds-text-muted)]"
                            >
                              {TP_TYPE_LABELS[tp.tpType]}
                            </span>
                          ),
                      )}
                      {job.sector && (
                        <span className="inline-flex items-center text-xs font-medium py-0.5 px-2 rounded-full bg-[var(--ds-surface-sunken)] text-[var(--ds-text-muted)]">
                          {formatSector(job.sector)}
                        </span>
                      )}
                      {job.localisation?.map((loc) => (
                        <span
                          key={loc}
                          className="inline-flex items-center text-xs font-medium py-0.5 px-2 rounded-full bg-blue-light text-blue"
                        >
                          {LOCALISATION_LABELS[loc]}
                        </span>
                      ))}
                      {formatScheduleSlots(job.schedule).map((s) => (
                        <span
                          key={s}
                          className="inline-flex items-center text-xs font-medium py-0.5 px-2 rounded-full bg-[var(--ds-surface-sunken)] text-[var(--ds-text-muted)]"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--ds-border)] p-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--ds-border)] px-4 py-2 text-sm font-semibold text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-sunken)]"
          >
            Annuler
          </button>
          <div className="flex items-center gap-2">
            {onNonRenseigne && (
              <button
                onClick={onNonRenseigne}
                className="rounded-lg border border-[var(--ds-border)] px-4 py-2 text-sm font-semibold text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-sunken)]"
              >
                Non renseigné
              </button>
            )}
            {footerAction && (
              <button
                onClick={footerAction.onClick}
                className="text-sm font-semibold text-blue hover:text-[var(--ds-accent)]"
              >
                {footerAction.label}
              </button>
            )}
          </div>
          <button
            onClick={handleConfirm}
            disabled={selectedJobIds.size === 0}
            className="rounded-lg bg-blue px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirmer ({selectedJobIds.size})
          </button>
        </div>
      </div>
    </div>
  )
}

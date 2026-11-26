import { useCallback, useEffect, useState } from 'react'
import { IconCheck, IconChevronDown, IconEye, IconInfo, IconJob, IconPlus, IconRefresh, IconSearch, IconUserCheck, IconWarning } from '@/components/ui/icons'
import { candidateGraphqlClient } from '@/graphql/client'
import { MATCH_CANDIDATE } from '@/graphql/queries'
import { LOCALISATION_LABELS } from '@/data/reunionCommunes'
import { TP_TYPE_LABELS } from '@/data/candidateTemplates'
import type { MatchedOffer, TitleProfessionalType } from '@/types/candidate'
import { useCurrentUser, Permission } from '@/store/authStore'
import { MATCHED_CANDIDATE_STATUS_LABELS, MATCHED_CANDIDATE_STATUS_BADGE_CLASS, MatchedCandidateStatus } from '@/constants/matchedCandidateStatus'
import AddCandidateToJobModal from './AddCandidateToJobModal'
import JobSearchModal from './JobSearchModal'
import CompanyInfoModal from '@/features/matching/components/CompanyInfoModal'
import ABDetailModal from '@/features/abEntreprise/components/ABDetailModal'

interface MatchedJobsListProps {
  candidateId: string
  confirmedJobIds?: Set<string>
  candidateTpTypes?: TitleProfessionalType[]
}

function formatSector(raw?: string): string {
  if (!raw) return '—'
  return raw.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

export default function MatchedJobsList({ candidateId, confirmedJobIds, candidateTpTypes }: MatchedJobsListProps) {
  const currentUser = useCurrentUser()
  const canProposeOffers = currentUser?.permission === Permission.RESPONSABLE || currentUser?.permission === Permission.ADMIN;

  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [jobs, setJobs] = useState<MatchedOffer[]>([])
  const [addedJobIds, setAddedJobIds] = useState<Set<string>>(confirmedJobIds ?? new Set())
  const [modalJobId, setModalJobId] = useState<string | null>(null)

  const [showJobSearch, setShowJobSearch] = useState(false)
  const [queuedJobs, setQueuedJobs] = useState<MatchedOffer[]>([])
  const [queueIndex, setQueueIndex] = useState(0)
  const [companyInfoOfferId, setCompanyInfoOfferId] = useState<string | null>(null)
  const [abDetailId, setAbDetailId] = useState<string | null>(null)

  const fetchMatches = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await candidateGraphqlClient.query(MATCH_CANDIDATE, { id: candidateId }).toPromise()
      if (result.error) {
        setError(result.error.message)
        return
      }
      setJobs(result.data?.matchCandidate?.matchedOffers ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [candidateId])

  useEffect(() => {
    if (expanded) fetchMatches()
  }, [expanded, fetchMatches])

  const modalJob = jobs.find((job) => job.id === modalJobId)
  const queuedJob = queuedJobs[queueIndex]
  const advanceQueue = () => {
    setQueueIndex((i) => {
      const next = i + 1
      if (next >= queuedJobs.length) setQueuedJobs([])
      return next
    })
  }

  return (
    <section className="rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-6 shadow-sm">
      <div className={`flex items-center justify-between gap-3 ${expanded ? 'mb-4' : ''}`}>
        <div className="flex items-center gap-3">
          <IconJob className="w-5 h-5 text-blue" />
          <h2 className="text-base font-semibold text-[var(--ds-text)]">Offres correspondantes</h2>
          {expanded && !loading && !error && (
            <span className="inline-flex items-center text-xs font-semibold py-1 px-2.5 rounded-full bg-blue-light text-blue">
              {jobs.length} offre{jobs.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {expanded && canProposeOffers && (
            <button
              type="button"
              onClick={() => setShowJobSearch(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-blue hover:text-blue/80 transition-colors cursor-pointer"
            >
              <IconSearch className="w-4 h-4" />
              Proposer des offres
            </button>
          )}
          {expanded && (
            <button
              type="button"
              onClick={fetchMatches}
              disabled={loading}
              className="flex items-center gap-1.5 text-sm text-[var(--ds-text-subtle)] hover:text-[var(--ds-text)] transition-colors disabled:opacity-50 cursor-pointer"
            >
              <IconRefresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Rafraîchir
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className={`flex items-center gap-2 text-blue font-semibold text-sm transition-colors cursor-pointer ${
              expanded
                ? 'py-2 px-3 hover:text-blue/80'
                : 'py-2 px-3 rounded-lg border border-blue-light bg-blue-light/50 hover:bg-blue-light'
            }`}
          >
            {!expanded && <IconChevronDown className="w-4 h-4" />}
            {expanded ? 'Réduire' : 'Voir les offres'}
          </button>
        </div>
      </div>

      {expanded && loading && (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-blue border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {expanded && !loading && error && (
        <div className="text-center py-6 px-4 bg-[var(--ds-danger-bg)] rounded-lg">
          <p className="text-sm text-[var(--ds-danger)]">{error}</p>
        </div>
      )}

      {expanded && !loading && !error && jobs.length === 0 && (
        <div className="text-center py-6 px-4 bg-[var(--ds-surface-sunken)] rounded-lg">
          <IconWarning className="w-6 h-6 text-[var(--ds-text-subtle)] mx-auto mb-2" />
          <p className="text-sm text-[var(--ds-text-muted)]">Aucune offre ne correspond à ce profil pour le moment.</p>
        </div>
      )}

      {expanded && !loading && !error && jobs.length > 0 && (
        <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1">
          {jobs.map(job => (
            <div
              key={job.id}
              className="bg-[var(--ds-surface)] border border-[var(--ds-border)] rounded-lg px-4 py-3 flex items-center gap-3"
            >
              <span className="w-8 h-8 flex-shrink-0 rounded-md bg-blue-light text-blue flex items-center justify-center">
                <IconJob className="w-4 h-4" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--ds-text)] truncate">{job.companyName || 'Entreprise'}</p>
                {(job.title || job.jobRole) && (
                  <p className="text-xs text-[var(--ds-text-subtle)] truncate mt-0.5">
                    {[job.title, job.jobRole].filter(Boolean).join(' · ')}
                  </p>
                )}
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
                  {job.localisation?.map(loc => (
                    <span
                      key={loc}
                      className="inline-flex items-center text-xs font-medium py-0.5 px-2 rounded-full bg-blue-light text-blue"
                    >
                      {LOCALISATION_LABELS[loc]}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {job.needsAnalysisId && (
                  <button
                    type="button"
                    onClick={() => setAbDetailId(job.needsAnalysisId!)}
                    className="flex items-center gap-1 text-xs font-medium text-[var(--ds-text-subtle)] hover:text-blue transition-colors"
                    title="Voir l'AB"
                  >
                    <IconEye className="w-3.5 h-3.5" />
                    Voir l'AB
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCompanyInfoOfferId(job.id)}
                  className="flex items-center gap-1 text-xs font-medium text-[var(--ds-text-subtle)] hover:text-blue transition-colors"
                  title="Voir toutes les infos de l'offre"
                >
                  <IconInfo className="w-3.5 h-3.5" />
                </button>
                {confirmedJobIds?.has(job.id) ? (
                  <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${(job.status && MATCHED_CANDIDATE_STATUS_BADGE_CLASS[job.status as MatchedCandidateStatus]) ?? 'bg-[var(--ds-success-bg)] text-[var(--ds-success)]'}`}>
                    <IconUserCheck className="w-3.5 h-3.5" /> {(job.status && MATCHED_CANDIDATE_STATUS_LABELS[job.status as MatchedCandidateStatus]) ?? 'Matché'}
                  </span>
                ) : addedJobIds.has(job.id) ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-[var(--ds-success)]">
                    <IconCheck className="w-3.5 h-3.5" /> Ajouté
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setModalJobId(job.id)}
                    className="flex items-center gap-1 text-xs font-medium text-blue hover:text-blue/80 transition-colors disabled:opacity-50"
                  >
                    <IconPlus className="w-3.5 h-3.5" />
                    Ajouter
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalJob && (
        <AddCandidateToJobModal
          job={modalJob}
          candidateId={candidateId}
          onSubmit={() => setAddedJobIds((p) => new Set(p).add(modalJob.id))}
          onClose={() => setModalJobId(null)}
        />
      )}

      {showJobSearch && (
        <JobSearchModal
          excludedJobIds={new Set([...(confirmedJobIds ?? []), ...addedJobIds])}
          candidateTpTypes={candidateTpTypes}
          onConfirm={(selectedJobs) => {
            setQueuedJobs(selectedJobs)
            setQueueIndex(0)
            setShowJobSearch(false)
          }}
          onClose={() => setShowJobSearch(false)}
        />
      )}

      {queuedJob && (
        <AddCandidateToJobModal
          job={queuedJob}
          candidateId={candidateId}
          progressLabel={queuedJobs.length > 1 ? `Offre ${queueIndex + 1} / ${queuedJobs.length}` : undefined}
          onSubmit={() => {
            setAddedJobIds((p) => new Set(p).add(queuedJob.id))
            advanceQueue()
          }}
          onClose={advanceQueue}
        />
      )}

      {companyInfoOfferId && (
        <CompanyInfoModal
          offerId={companyInfoOfferId}
          needsAnalysisId={jobs.find(j => j.id === companyInfoOfferId)?.needsAnalysisId ?? null}
          onClose={() => setCompanyInfoOfferId(null)}
        />
      )}

      {abDetailId && (
        <ABDetailModal id={abDetailId} onClose={() => setAbDetailId(null)} />
      )}
    </section>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { Briefcase, RefreshCw, AlertTriangle, Plus, Check, UserCheck, Search } from 'lucide-react'
import { candidateGraphqlClient } from '@/graphql/client'
import { MATCH_CANDIDATE } from '@/graphql/queries'
import { LOCALISATION_LABELS } from '@/data/reunionCommunes'
import { TP_TYPE_LABELS } from '@/data/candidateTemplates'
import type { MatchedOffer, TitleProfessionalType } from '@/types/candidate'
import { useCurrentUser, Permission } from '@/store/authStore'
import AddCandidateToJobModal from './AddCandidateToJobModal'
import JobSearchModal from './JobSearchModal'

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

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [jobs, setJobs] = useState<MatchedOffer[]>([])
  const [addedJobIds, setAddedJobIds] = useState<Set<string>>(confirmedJobIds ?? new Set())
  const [modalJobId, setModalJobId] = useState<string | null>(null)

  const [showJobSearch, setShowJobSearch] = useState(false)
  const [queuedJobs, setQueuedJobs] = useState<MatchedOffer[]>([])
  const [queueIndex, setQueueIndex] = useState(0)

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
    fetchMatches()
  }, [fetchMatches])

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
    <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Briefcase className="w-5 h-5 text-blue" />
          <h2 className="text-base font-semibold text-gray-800">Offres correspondantes</h2>
          {!loading && !error && (
            <span className="inline-flex items-center text-xs font-semibold py-1 px-2.5 rounded-full bg-blue-light text-blue">
              {jobs.length} offre{jobs.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {canProposeOffers && (
            <button
              type="button"
              onClick={() => setShowJobSearch(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-blue hover:text-blue/80 transition-colors cursor-pointer"
            >
              <Search className="w-4 h-4" />
              Proposer des offres
            </button>
          )}
          <button
            type="button"
            onClick={fetchMatches}
            disabled={loading}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Rafraîchir
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-blue border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && error && (
        <div className="text-center py-6 px-4 bg-danger-bg rounded-lg">
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {!loading && !error && jobs.length === 0 && (
        <div className="text-center py-6 px-4 bg-gray-50 rounded-lg">
          <AlertTriangle className="w-6 h-6 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Aucune offre ne correspond à ce profil pour le moment.</p>
        </div>
      )}

      {!loading && !error && jobs.length > 0 && (
        <div className="flex flex-col gap-2">
          {jobs.map(job => (
            <div
              key={job.id}
              className="bg-white border border-gray-100 rounded-lg px-4 py-3 flex items-center gap-3"
            >
              <span className="w-8 h-8 flex-shrink-0 rounded-md bg-blue-light text-blue flex items-center justify-center">
                <Briefcase className="w-4 h-4" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{job.companyName || 'Entreprise'}</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {job.desiredTP && (
                    <span className="inline-flex items-center text-xs font-medium py-0.5 px-2 rounded-full bg-gray-100 text-gray-600">
                      {TP_TYPE_LABELS[job.desiredTP]}
                    </span>
                  )}
                  {job.sector && (
                    <span className="inline-flex items-center text-xs font-medium py-0.5 px-2 rounded-full bg-gray-100 text-gray-600">
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
              {confirmedJobIds?.has(job.id) ? (
                <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-success-bg text-success shrink-0">
                  <UserCheck className="w-3.5 h-3.5" /> Matché
                </span>
              ) : addedJobIds.has(job.id) ? (
                <span className="flex items-center gap-1 text-xs font-medium text-success shrink-0">
                  <Check className="w-3.5 h-3.5" /> Ajouté
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setModalJobId(job.id)}
                  className="flex items-center gap-1 text-xs font-medium text-blue hover:text-blue/80 transition-colors disabled:opacity-50 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Ajouter
                </button>
              )}
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
    </section>
  )
}

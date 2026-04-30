import { useState, useCallback } from 'react'
import { useQuery } from 'urql'
import {
  Building2,
  Users,
  Calendar,
  Sparkles,
  X,
  Check,
  Mail,
  Phone,
  MapPin,
  User,
  ChevronDown,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { GET_JOBS, MATCH_JOB } from '@/graphql/queries'
import { jobGraphqlClient } from '@/graphql/client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchedCandidate {
  id: string
  fullName: string
  age: number
  sex: string
  city: string
  email: string
  phone: string
}

interface Job {
  id: string
  companyName: string
  ageRange: string
}

interface MatchJobResult extends Job {
  matchedCandidate: MatchedCandidate[]
}

type CandidateDecision = 'accepted' | 'dismissed' | null

// ─── Candidate card ───────────────────────────────────────────────────────────

function CandidateCard({
  candidate,
  decision,
  onAccept,
  onDismiss,
  onRemove,
}: {
  candidate: MatchedCandidate
  decision: CandidateDecision
  onAccept: () => void
  onDismiss: () => void
  onRemove: () => void
}) {
  const isDismissing = decision === 'dismissed'

  return (
    <div
      className={[
        'relative rounded-xl border bg-white p-4 transition-all duration-500 ease-in-out',
        isDismissing
          ? 'scale-95 opacity-0 max-h-0 !py-0 !my-0 overflow-hidden border-transparent'
          : 'scale-100 opacity-100 max-h-96',
        decision === 'accepted'
          ? 'border-success/40 shadow-[0_0_0_1px_var(--color-success-bg)]'
          : 'border-gray-100 shadow-sm hover:shadow-md',
      ].join(' ')}
      onTransitionEnd={() => {
        if (isDismissing) onRemove()
      }}
    >
      {/* Accepted indicator */}
      {decision === 'accepted' && (
        <div className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-success-bg">
          <Check size={13} className="text-success" />
        </div>
      )}

      {/* Candidate info */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-light text-purple">
          <User size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 truncate">{candidate.fullName}</p>
          <p className="text-xs text-gray-500">
            {candidate.sex === 'GARCON' ? 'Homme' : candidate.sex === 'FILLE' ? 'Femme' : 'Mixte'}
            {candidate.age ? ` · ${candidate.age} ans` : ''}
          </p>
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 gap-1.5 mb-4">
        {candidate.email && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Mail size={13} className="text-gray-300 shrink-0" />
            <span className="truncate">{candidate.email}</span>
          </div>
        )}
        {candidate.phone && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Phone size={13} className="text-gray-300 shrink-0" />
            <span>{candidate.phone}</span>
          </div>
        )}
        {candidate.city && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <MapPin size={13} className="text-gray-300 shrink-0" />
            <span>{candidate.city.replace(/_/g, ' ')}</span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {decision !== 'accepted' && (
        <div className="flex items-center gap-2">
          <button
            onClick={onDismiss}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-100 bg-white px-3 py-2 text-xs font-medium text-danger transition-all hover:bg-danger-bg hover:border-danger/20 active:scale-[0.97]"
          >
            <X size={14} />
            Non
          </button>
          <button
            onClick={onAccept}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-100 bg-white px-3 py-2 text-xs font-medium text-success transition-all hover:bg-success-bg hover:border-success/20 active:scale-[0.97]"
          >
            <Check size={14} />
            Oui
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Job card ─────────────────────────────────────────────────────────────────

function JobCard({
  job,
  isExpanded,
  onToggle,
}: {
  job: Job
  isExpanded: boolean
  onToggle: () => void
}) {
  const [matchResult, setMatchResult] = useState<MatchJobResult | null>(null)
  const [candidates, setCandidates] = useState<MatchedCandidate[]>([])
  const [decisions, setDecisions] = useState<Record<string, CandidateDecision>>({})
  const [isMatching, setIsMatching] = useState(false)
  const [matchError, setMatchError] = useState<string | null>(null)
  const [hasMatched, setHasMatched] = useState(false)

  const handleMatch = useCallback(async () => {
    setIsMatching(true)
    setMatchError(null)

    try {
      const result = await jobGraphqlClient.query(MATCH_JOB, { id: job.id }).toPromise()

      if (result.error) {
        setMatchError(result.error.message)
        return
      }

      if (result.data?.matchJob) {
        const data = result.data.matchJob as MatchJobResult
        setMatchResult(data)
        setCandidates(data.matchedCandidate ?? [])
        setDecisions({})
        setHasMatched(true)
      }
    } catch (err: any) {
      setMatchError(err.message ?? 'Erreur inconnue')
    } finally {
      setIsMatching(false)
    }
  }, [job.id])

  const handleAccept = (candidateId: string) => {
    setDecisions((prev) => ({ ...prev, [candidateId]: 'accepted' }))
  }

  const handleDismiss = (candidateId: string) => {
    setDecisions((prev) => ({ ...prev, [candidateId]: 'dismissed' }))
  }

  const handleRemove = (candidateId: string) => {
    setCandidates((prev) => prev.filter((c) => c.id !== candidateId))
    setDecisions((prev) => {
      const next = { ...prev }
      delete next[candidateId]
      return next
    })
  }

  const acceptedCount = Object.values(decisions).filter((d) => d === 'accepted').length

  return (
    <div
      className={[
        'rounded-xl border bg-white transition-all duration-300',
        isExpanded
          ? 'border-blue/20 shadow-md ring-1 ring-blue/5'
          : 'border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200',
      ].join(' ')}
    >
      {/* Header – clickable */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-4 p-5 text-left transition-colors rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue/30 focus-visible:ring-offset-2"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-light text-blue">
          <Building2 size={20} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 truncate">{job.companyName}</p>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {job.ageRange} ans
            </span>
            {hasMatched && (
              <span className="flex items-center gap-1 text-success">
                <Users size={12} />
                {acceptedCount} retenu{acceptedCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        <ChevronDown
          size={18}
          className={[
            'shrink-0 text-gray-300 transition-transform duration-300',
            isExpanded ? 'rotate-180' : '',
          ].join(' ')}
        />
      </button>

      {/* Expanded content */}
      <div
        className={[
          'overflow-hidden transition-all duration-300 ease-in-out',
          isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0',
        ].join(' ')}
      >
        <div className="border-t border-gray-100 px-5 pb-5 pt-4">
          {/* Match button */}
          <button
            onClick={handleMatch}
            disabled={isMatching}
            className={[
              'inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue/30 focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-60',
              'bg-blue text-white shadow-sm hover:bg-blue-dark active:scale-[0.98]',
            ].join(' ')}
          >
            {isMatching ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Matching en cours...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                {hasMatched ? 'Relancer le Matching' : 'Lancer le Matching'}
              </>
            )}
          </button>

          {/* Error state */}
          {matchError && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-danger-bg px-3 py-2.5 text-xs text-danger">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{matchError}</span>
            </div>
          )}

          {/* Candidate results */}
          {hasMatched && !matchError && (
            <div className="mt-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Candidats ({candidates.length})
                </h4>
                {acceptedCount > 0 && (
                  <span className="rounded-full bg-success-bg px-2.5 py-0.5 text-xs font-medium text-success">
                    {acceptedCount} retenu{acceptedCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {candidates.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-gray-200 py-8">
                  <Users size={24} className="text-gray-300" />
                  <p className="text-sm text-gray-400">Aucun candidat disponible</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {candidates.map((candidate) => (
                    <CandidateCard
                      key={candidate.id}
                      candidate={candidate}
                      decision={decisions[candidate.id] ?? null}
                      onAccept={() => handleAccept(candidate.id)}
                      onDismiss={() => handleDismiss(candidate.id)}
                      onRemove={() => handleRemove(candidate.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Matching() {
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)

  const [jobsResult] = useQuery({
    query: GET_JOBS,
    context: { url: 'http://localhost:4000/api/graphql/jobs' },
  })

  const toggleJob = (id: string) => {
    setExpandedJobId((prev) => (prev === id ? null : id))
  }

  // Loading state
  if (jobsResult.fetching) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <Loader2 size={28} className="animate-spin text-blue" />
        <p className="text-sm text-gray-400">Chargement des offres...</p>
      </div>
    )
  }

  // Error state
  if (jobsResult.error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-danger/20 bg-danger-bg px-6 py-8 text-center">
          <AlertCircle size={28} className="text-danger" />
          <p className="text-sm font-medium text-danger">Erreur de chargement</p>
          <p className="text-xs text-danger/70">{jobsResult.error.message}</p>
        </div>
      </div>
    )
  }

  const jobs: Job[] = jobsResult.data?.jobs ?? []

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Matching</h1>
        <p className="mt-1 text-sm text-gray-500">
          {jobs.length} offre{jobs.length > 1 ? 's' : ''} disponible{jobs.length > 1 ? 's' : ''}
        </p>
      </div>

      {/* Jobs grid */}
      {jobs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-200 py-16">
          <Building2 size={32} className="text-gray-300" />
          <p className="text-sm text-gray-400">Aucune offre disponible</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              isExpanded={expandedJobId === job.id}
              onToggle={() => toggleJob(job.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

import { useState, useCallback, useEffect } from 'react'
import { useQuery } from 'urql'
import {
  Building2,
  Users,
  Sparkles,
  X,
  Check,
  Mail,
  Phone,
  MapPin,
  User,
  Loader2,
  AlertCircle,
  Info,
  Briefcase,
  Car,
  ChevronRight,
  Badge,
  UserCheck,
  Plus,
} from 'lucide-react'
import { GET_JOBS, MATCH_JOB, ADD_CANDIDATE_TO_JOB, OFFER_RESPONSE_LINKS, UPDATE_JOB } from '@/graphql/queries'
import { jobGraphqlClient } from '@/graphql/client'
import { useAuthStore } from '@/store/authStore'
import { JobFilters } from '@/features/matching/components/JobFilters'
import type { JobFilters as JobFiltersType } from '@/features/matching/services/jobFilters'
import { EMPTY_JOB_FILTERS, applyJobFilters } from '@/features/matching/services/jobFilters'
import MailModal from '@/components/ui/MailModal'

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
  desiredTP: string | null
  desiredSex: string | null
  drivingLicencseB: boolean | null
  professionalExperience: boolean | null
  status: string | null
  localisation: string[] | null
  sector: string | null
}

interface MatchJobResult extends Job {
  matchedCandidate: MatchedCandidate[]
  suggestedCandidates: MatchedCandidate[]
}

type CandidateDecision = 'accepted' | 'dismissed' | null

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEnum(raw: string | null | undefined): string {
  if (!raw) return '—'
  return raw.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

function sexLabel(raw: string | null | undefined): string {
  if (!raw) return '—'
  const map: Record<string, string> = { FILLE: 'Fille', GARCON: 'Garçon', MIXTE: 'Mixte' }
  return map[raw] ?? formatEnum(raw)
}

function tpLabel(raw: string | null | undefined): string {
  if (!raw) return '—'
  const map: Record<string, string> = {
    AD: 'AD – Administrateur',
    CC: 'CC – Chef de projet',
    NTC: 'NTC – Négociation Technico-Commercial',
    REM: 'REM – Resp. Établissement Médico-Social',
    SA: 'SA – Secrétaire d\'Administration',
  }
  return map[raw] ?? raw
}

function statusChip(status: string | null): { label: string; cls: string } {
  const map: Record<string, { label: string; cls: string }> = {
    NOT_MATCHED: { label: 'Non matché', cls: 'bg-gray-100 text-gray-600' },
    MATCHED: { label: 'Matché', cls: 'bg-blue-light text-blue' },
    CV_SEND: { label: 'CV envoyé', cls: 'bg-purple-light text-purple' },
    IMMERSING: { label: 'En immersion', cls: 'bg-pink-light text-pink' },
    CONTRACT: { label: 'Sous contrat', cls: 'bg-success-bg text-success' },
  }
  return status ? (map[status] ?? { label: formatEnum(status), cls: 'bg-gray-100 text-gray-600' }) : { label: '—', cls: 'bg-gray-100 text-gray-600' }
}

// ─── Info Drawer ──────────────────────────────────────────────────────────────

interface DrawerSection {
  label: string
  value: string | number | boolean | null | undefined
}

interface InfoDrawerProps {
  title: string
  subtitle?: string
  sections: DrawerSection[]
  onClose: () => void
}

function InfoDrawer({ title, subtitle, sections, onClose }: InfoDrawerProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const renderValue = (val: DrawerSection['value']): string => {
    if (val === null || val === undefined || val === '') return '—'
    if (typeof val === 'boolean') return val ? 'Oui' : 'Non'
    if (Array.isArray(val)) return (val as string[]).map(formatEnum).join(', ') || '—'
    return String(val)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-sm overflow-y-auto bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-100 bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{title}</p>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Fields */}
        <div className="flex-1 px-5 py-4 space-y-0">
          {sections.map((s, i) => (
            <div key={i} className="flex items-start justify-between gap-3 border-b border-gray-50 py-3 last:border-b-0">
              <span className="text-xs text-gray-400 shrink-0 min-w-[110px]">{s.label}</span>
              <span className="text-xs font-medium text-gray-800 text-right break-words">{renderValue(s.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ─── Candidate Card ───────────────────────────────────────────────────────────

function CandidateCard({
  candidate,
  decision,
  onAccept,
  onDismiss,
  onRemove,
  onInfo,
}: {
  candidate: MatchedCandidate
  decision: CandidateDecision
  onAccept: () => void
  onDismiss: () => void
  onRemove: () => void
  onInfo: () => void
}) {
  const isDismissing = decision === 'dismissed'
  const isAccepted = decision === 'accepted'

  return (
    // Outer wrapper handles the collapse animation only
    <div
      className={[
        'transition-all duration-500 ease-in-out',
        isDismissing
          ? 'opacity-0 scale-95 max-h-0 overflow-hidden pointer-events-none'
          : 'opacity-100 scale-100 max-h-[600px]',
      ].join(' ')}
      onTransitionEnd={() => { if (isDismissing) onRemove() }}
    >
      {/* Inner card — no overflow-hidden so content is never clipped */}
      <div
        className={[
          'rounded-xl border bg-white',
          isAccepted
            ? 'border-success/30 ring-1 ring-success/10 shadow-sm'
            : 'border-gray-100 shadow-sm',
        ].join(' ')}
      >
      <div className="p-4">
        {/* Top row */}
        <div className="flex items-start gap-3 mb-3">
          <div className={[
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            isAccepted ? 'bg-success-bg text-success' : 'bg-purple-light text-purple',
          ].join(' ')}>
            {isAccepted ? <UserCheck size={16} /> : <User size={16} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate">{candidate.fullName}</p>
            <p className="text-xs text-gray-400">
              {sexLabel(candidate.sex)}{candidate.age ? ` · ${candidate.age} ans` : ''}
            </p>
          </div>
          {/* Info button */}
          <button
            onClick={onInfo}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-300 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <Info size={14} />
          </button>
        </div>

        {/* Details */}
        <div className="space-y-1.5 mb-3">
          {candidate.email && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Mail size={12} className="text-gray-300 shrink-0" />
              <span className="truncate">{candidate.email}</span>
            </div>
          )}
          {candidate.phone && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Phone size={12} className="text-gray-300 shrink-0" />
              <span>{candidate.phone}</span>
            </div>
          )}
          {candidate.city && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <MapPin size={12} className="text-gray-300 shrink-0" />
              <span>{formatEnum(candidate.city)}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        {!isAccepted && (
          <div className="flex gap-2">
            <button
              onClick={onDismiss}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-100 px-3 py-1.5 text-xs font-medium text-danger transition-all hover:bg-danger-bg hover:border-danger/20 active:scale-[0.97]"
            >
              <X size={13} /> Non
            </button>
            <button
              onClick={onAccept}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-100 px-3 py-1.5 text-xs font-medium text-success transition-all hover:bg-success-bg hover:border-success/20 active:scale-[0.97]"
            >
              <Check size={13} /> Oui
            </button>
          </div>
        )}
        {isAccepted && (
          <div className="flex items-center gap-1.5 text-xs text-success font-medium">
            <Check size={13} /> Retenu
          </div>
        )}
      </div>
      </div>
    </div>
  )
}

// ─── Job Card ─────────────────────────────────────────────────────────────────

function JobCard({
  job,
  isSelected,
  onSelect,
  onInfo,
}: {
  job: Job
  isSelected: boolean
  onSelect: () => void
  onInfo: (e: React.MouseEvent) => void
}) {
  const chip = statusChip(job.status)

  return (
    <button
      onClick={onSelect}
      className={[
        'w-full text-left rounded-xl border p-4 transition-all duration-200 group',
        isSelected
          ? 'border-blue/30 bg-blue-light/30 ring-1 ring-blue/10 shadow-md'
          : 'border-gray-100 bg-white shadow-sm hover:shadow-md hover:border-gray-200',
      ].join(' ')}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div className={[
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors',
          isSelected ? 'bg-blue text-white' : 'bg-blue-light text-blue',
        ].join(' ')}>
          <Building2 size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 truncate">{job.companyName}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {job.ageRange ? `${job.ageRange} ans` : '—'}
          </p>
        </div>
        {/* Info + chevron */}
        <div className="flex items-center gap-1 shrink-0">
          <span
            role="button"
            tabIndex={0}
            onClick={onInfo}
            onKeyDown={(e) => { if (e.key === 'Enter') onInfo(e as any) }}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-300 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <Info size={14} />
          </span>
          <ChevronRight
            size={16}
            className={[
              'text-gray-300 transition-transform duration-200',
              isSelected ? 'rotate-90 text-blue' : 'group-hover:text-gray-400',
            ].join(' ')}
          />
        </div>
      </div>

      {/* Fields grid */}
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
        {job.desiredTP && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Badge size={11} className="text-gray-300 shrink-0" />
            <span className="truncate font-medium">{job.desiredTP}</span>
          </div>
        )}
        {job.desiredSex && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <User size={11} className="text-gray-300 shrink-0" />
            <span>{sexLabel(job.desiredSex)}</span>
          </div>
        )}
        {job.drivingLicencseB === true && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Car size={11} className="text-gray-300 shrink-0" />
            <span>Permis B requis</span>
          </div>
        )}
        {job.professionalExperience === true && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Briefcase size={11} className="text-gray-300 shrink-0" />
            <span>Exp. requise</span>
          </div>
        )}
      </div>

      {/* Localisation tags */}
      {job.localisation && job.localisation.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {job.localisation.slice(0, 3).map((loc) => (
            <span key={loc} className="rounded-md bg-gray-50 px-2 py-0.5 text-[10px] text-gray-500 border border-gray-100">
              {formatEnum(loc)}
            </span>
          ))}
          {job.localisation.length > 3 && (
            <span className="rounded-md bg-gray-50 px-2 py-0.5 text-[10px] text-gray-400 border border-gray-100">
              +{job.localisation.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Status badge */}
      <div className="mt-3 flex items-center justify-between">
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${chip.cls}`}>
          {chip.label}
        </span>
        {isSelected && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-blue">
            <Sparkles size={10} /> Matching actif
          </span>
        )}
      </div>
    </button>
  )
}

// ─── Right panel (candidates) ─────────────────────────────────────────────────

function CandidatesPanel({
  selectedJob,
}: {
  selectedJob: Job | null
}) {
  const [_matchResult, setMatchResult] = useState<MatchJobResult | null>(null)
  const [candidates, setCandidates] = useState<MatchedCandidate[]>([])
  const [decisions, setDecisions] = useState<Record<string, CandidateDecision>>({})
  const [isMatching, setIsMatching] = useState(false)
  const [matchError, setMatchError] = useState<string | null>(null)
  const [hasMatched, setHasMatched] = useState(false)
  const [drawerCandidate, setDrawerCandidate] = useState<MatchedCandidate | null>(null)

  const runMatch = useCallback(async (job: Job) => {
    setIsMatching(true)
    setMatchError(null)
    setHasMatched(false)
    setCandidates([])
    setDecisions({})

    try {
      const token = useAuthStore.getState().token
      const result = await jobGraphqlClient
        .query(
          MATCH_JOB,
          { id: job.id },
          {
            fetchOptions: {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          }
        )
        .toPromise()
      if (result.error) {
        setMatchError(result.error.message)
        return
      }
      if (result.data?.matchJob) {
        const data = result.data.matchJob as MatchJobResult
        setMatchResult(data)
        setCandidates(data.matchedCandidate ?? [])
        setHasMatched(true)
      }
    } catch (err: any) {
      setMatchError(err.message ?? 'Erreur inconnue')
    } finally {
      setIsMatching(false)
    }
  }, [])

  // Auto-run matching when selectedJob changes
  useEffect(() => {
    if (selectedJob) runMatch(selectedJob)
  }, [selectedJob?.id])

  const handleAccept = (id: string) => setDecisions((p) => ({ ...p, [id]: 'accepted' }))
  const handleDismiss = (id: string) => setDecisions((p) => ({ ...p, [id]: 'dismissed' }))
  const handleRemove = (id: string) => {
    setCandidates((p) => p.filter((c) => c.id !== id))
    setDecisions((p) => { const n = { ...p }; delete n[id]; return n })
  }

  const acceptedCount = Object.values(decisions).filter((d) => d === 'accepted').length

  if (!selectedJob) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 py-24 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-light text-blue">
          <Sparkles size={24} />
        </div>
        <p className="text-sm font-medium text-gray-700">Sélectionnez une offre</p>
        <p className="text-xs text-gray-400 max-w-[200px]">
          Cliquez sur une carte entreprise pour lancer le matching automatiquement.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900 truncate">{selectedJob.companyName}</h2>
          <p className="text-xs text-gray-400 mt-0.5">Candidats matchés</p>
        </div>
        {hasMatched && !isMatching && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-gray-400">{candidates.length} résultat{candidates.length > 1 ? 's' : ''}</span>
            {acceptedCount > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-success-bg px-2.5 py-0.5 text-xs font-medium text-success">
                <Check size={11} /> {acceptedCount} retenu{acceptedCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Loading */}
      {isMatching && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-2 border-blue-light" />
            <Loader2 size={20} className="absolute inset-0 m-auto animate-spin text-blue" />
          </div>
          <p className="text-sm text-gray-400">Matching en cours...</p>
        </div>
      )}

      {/* Error */}
      {!isMatching && matchError && (
        <div className="flex items-start gap-2 rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{matchError}</span>
        </div>
      )}

      {/* Candidate list */}
      {!isMatching && hasMatched && !matchError && (
        <>
          {candidates.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
                <Users size={20} className="text-gray-300" />
              </div>
              <p className="text-sm text-gray-400">Aucun candidat disponible</p>
              <p className="text-xs text-gray-300">Aucun profil ne correspond aux critères de cette offre.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 overflow-y-auto pb-4">
              {candidates.map((c) => (
                <CandidateCard
                  key={c.id}
                  candidate={c}
                  decision={decisions[c.id] ?? null}
                  onAccept={() => handleAccept(c.id)}
                  onDismiss={() => handleDismiss(c.id)}
                  onRemove={() => handleRemove(c.id)}
                  onInfo={() => setDrawerCandidate(c)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Candidate info drawer */}
      {drawerCandidate && (
        <InfoDrawer
          title={drawerCandidate.fullName}
          subtitle="Fiche candidat"
          sections={[
            { label: 'Nom complet', value: drawerCandidate.fullName },
            { label: 'Email', value: drawerCandidate.email },
            { label: 'Téléphone', value: drawerCandidate.phone },
            { label: 'Sexe', value: sexLabel(drawerCandidate.sex) },
            { label: 'Âge', value: drawerCandidate.age ? `${drawerCandidate.age} ans` : null },
            { label: 'Ville', value: formatEnum(drawerCandidate.city) },
          ]}
          onClose={() => setDrawerCandidate(null)}
        />
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Matching() {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [drawerJob, setDrawerJob] = useState<Job | null>(null)
  const [filters, setFilters] = useState<JobFiltersType>(EMPTY_JOB_FILTERS)

  const token = useAuthStore((s) => s.token)
  const [jobsResult] = useQuery({
    query: GET_JOBS,
    context: {
      url: `${import.meta.env.VITE_API_URL}/api/graphql/jobs`,
      fetchOptions: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    },
  })

  const jobs: Job[] = jobsResult.data?.jobs ?? []
  const filteredJobs = applyJobFilters(jobs, filters)
  const selectedJob = filteredJobs.find((j) => j.id === selectedJobId) ?? null

  if (jobsResult.fetching) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <Loader2 size={28} className="animate-spin text-blue" />
        <p className="text-sm text-gray-400">Chargement des offres...</p>
      </div>
    )
  }

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

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      {/* Top bar */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-100 bg-white/80 backdrop-blur-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Matching</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {filteredJobs.length} offre{filteredJobs.length > 1 ? 's' : ''} ({jobs.length} total{jobs.length > 1 ? 's' : ''})
            </p>
          </div>
        </div>
        <JobFilters filters={filters} onChange={setFilters} jobs={jobs} />
      </div>

      {/* Two-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* ─ Left: Job list ─ */}
        <div className="w-[380px] shrink-0 flex flex-col border-r border-gray-100 bg-gray-50/50 overflow-y-auto">
          <div className="px-4 pt-4 pb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Offres entreprises
            </p>
          </div>
          {filteredJobs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center px-6">
              <Building2 size={28} className="text-gray-300" />
              <p className="text-sm text-gray-400">{jobs.length === 0 ? 'Aucune offre disponible' : 'Aucune offre ne correspond aux filtres'}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 px-4 pb-6">
              {filteredJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  isSelected={selectedJobId === job.id}
                  onSelect={() => setSelectedJobId(job.id)}
                  onInfo={(e) => { e.stopPropagation(); setDrawerJob(job) }}
                />
              ))}
            </div>
          )}
        </div>

        {/* ─ Right: Candidates panel ─ */}
        <div className="flex-1 overflow-y-auto px-5 pt-5">
          <CandidatesPanel selectedJob={selectedJob} />
        </div>
      </div>

      {/* Job info drawer */}
      {drawerJob && (
        <InfoDrawer
          title={drawerJob.companyName}
          subtitle="Détail de l'offre"
          sections={[
            { label: 'Entreprise', value: drawerJob.companyName },
            { label: 'Tranche d\'âge', value: drawerJob.ageRange },
            { label: 'Titre professionnel', value: tpLabel(drawerJob.desiredTP) },
            { label: 'Sexe souhaité', value: sexLabel(drawerJob.desiredSex) },
            { label: 'Permis B requis', value: drawerJob.drivingLicencseB },
            { label: 'Expérience pro requise', value: drawerJob.professionalExperience },
            { label: 'Statut', value: statusChip(drawerJob.status).label },
            { label: 'Localisation(s)', value: drawerJob.localisation?.map(formatEnum).join(', ') || '—' },
          ]}
          onClose={() => setDrawerJob(null)}
        />
      )}
    </div>
  )
}

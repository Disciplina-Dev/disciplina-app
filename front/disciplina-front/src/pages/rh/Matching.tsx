import { useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
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
  Briefcase,
  Car,
  ChevronRight,
  UserCheck,
  UserX,
  Plus,
  Info,
  PlayCircle,
  RefreshCw,
  Trash2,
  MailCheck,
  Send,
  Heart,
  CalendarClock,
} from 'lucide-react'
import { GET_JOBS, GET_COMPANIES, MATCH_JOB, ADD_CANDIDATE_TO_JOB, OFFER_RESPONSE_LINKS, UPDATE_JOB, UNMATCH_JOB, REMOVE_CANDIDATE_FROM_JOB, UPDATE_MATCHED_CANDIDATE_STATUS, GET_CANDIDATE_CV_STATUS, CREATE_MATCH_SESSION } from '@/graphql/queries'
import { MATCHED_CANDIDATE_STATUS_LABELS, MATCHED_CANDIDATE_STATUS_BADGE_CLASS, MatchedCandidateStatus } from '@/constants/matchedCandidateStatus'
import { PROPOSED_CANDIDATE_ANSWER_LABELS, PROPOSED_CANDIDATE_ANSWER_BADGE_CLASS, ProposedCandidateAnswer } from '@/constants/proposedCandidateAnswer'
import { JOB_STATUS_LABELS, JOB_STATUS_BADGE_CLASS, MANUAL_JOB_STATUSES } from '@/constants/jobStatus'
import { JobStatus, formatEnumLabel } from '@/features/matching/constants/jobEnums'
import { jobGraphqlClient, graphqlClient, candidateGraphqlClient } from '@/graphql/client'
import { useQuery } from 'urql'
import { useAuthStore } from '@/store/authStore'
import { JobFilters } from '@/features/matching/components/JobFilters'
import type { JobFilters as JobFiltersType } from '@/features/matching/services/jobFilters'
import { EMPTY_JOB_FILTERS, applyJobFilters } from '@/features/matching/services/jobFilters'
import MailModal from '@/components/ui/MailModal'
import { LOCALISATION_LABELS } from '@/data/reunionCommunes'
import { TP_TYPE_LABELS } from '@/data/candidateTemplates'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchedCandidate {
  id: string
  fullName: string
  age: number
  sex: string
  city: string
  email: string
  phone: string
  status?: string
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

interface ProposedCandidate {
  id: string
  fullName: string
  age: number
  sex: string
  city: string
  email: string
  phone: string
  description: string | null
  answer: ProposedCandidateAnswer | null
  interviewSlots: string[] | null
}

interface MatchJobResult extends Job {
  matchedCandidate: MatchedCandidate[]
  suggestedCandidates: MatchedCandidate[]
  proposedCandidate: ProposedCandidate[]
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
  if (!status) return { label: '—', cls: 'bg-gray-100 text-gray-600' }
  const jobStatus = status as JobStatus
  return JOB_STATUS_LABELS[jobStatus]
    ? { label: JOB_STATUS_LABELS[jobStatus], cls: JOB_STATUS_BADGE_CLASS[jobStatus] }
    : { label: formatEnum(status), cls: 'bg-gray-100 text-gray-600' }
}

function locLabel(raw: string): string {
  return (LOCALISATION_LABELS as Record<string, string>)[raw] ?? formatEnum(raw)
}

// ─── Candidate Info Drawer ────────────────────────────────────────────────────

interface InfoDrawerProps {
  candidate: MatchedCandidate
  onClose: () => void
}

function CandidateInfoDrawer({ candidate, onClose }: InfoDrawerProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-sm overflow-y-auto bg-white shadow-2xl flex flex-col">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-100 bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{candidate.fullName}</p>
            <p className="text-xs text-gray-400 mt-0.5">Fiche candidat</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 px-5 py-4 space-y-0">
          {[
            { label: 'Nom complet', value: candidate.fullName },
            { label: 'Email', value: candidate.email },
            { label: 'Téléphone', value: candidate.phone },
            { label: 'Sexe', value: sexLabel(candidate.sex) },
            { label: 'Âge', value: candidate.age ? `${candidate.age} ans` : null },
            { label: 'Ville', value: formatEnum(candidate.city) },
          ].map((row, i) => (
            <div key={i} className="flex items-start justify-between gap-3 border-b border-gray-50 py-3 last:border-b-0">
              <span className="text-xs text-gray-400 shrink-0 min-w-[110px]">{row.label}</span>
              <span className="text-xs font-medium text-gray-800 text-right break-words">
                {row.value || '—'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ─── Retained Candidate Row ───────────────────────────────────────────────────

function RetainedCandidateRow({
  candidate,
  hasMissingCv,
  onInfo,
  onSendMail,
  onRemove,
}: {
  candidate: MatchedCandidate
  hasMissingCv: boolean
  onInfo: () => void
  onSendMail: () => void
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-success/20 bg-success-bg/40 px-4 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success-bg text-success">
        <UserCheck size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-900 truncate">{candidate.fullName}</p>
          {candidate.status && (
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${MATCHED_CANDIDATE_STATUS_BADGE_CLASS[candidate.status as MatchedCandidateStatus] ?? 'bg-gray-100 text-gray-600'}`}>
              {MATCHED_CANDIDATE_STATUS_LABELS[candidate.status as MatchedCandidateStatus] ?? candidate.status}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-3 mt-0.5">
          {candidate.email && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Mail size={10} className="text-gray-300" /> {candidate.email}
            </span>
          )}
          {candidate.city && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <MapPin size={10} className="text-gray-300" /> {formatEnum(candidate.city)}
            </span>
          )}
        </div>
        {hasMissingCv && (
          <p className="flex items-center gap-1 mt-1 text-[11px] font-medium text-danger">
            <AlertCircle size={10} /> Aucun CV sur le Drive du candidat
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onSendMail}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-white hover:text-blue transition-colors"
          title="Envoyer un mail"
        >
          <Mail size={14} />
        </button>
        <button
          onClick={onInfo}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-white hover:text-gray-700 transition-colors"
          title="Voir la fiche"
        >
          <Info size={14} />
        </button>
        <button
          onClick={onRemove}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-danger-bg hover:text-danger transition-colors"
          title="Retirer ce candidat"
        >
          <UserX size={14} />
        </button>
      </div>
    </div>
  )
}

// ─── Candidate Card (suggested) ───────────────────────────────────────────────

function CandidateCard({
  candidate,
  decision,
  isSaved,
  isSaving,
  onAccept,
  onDismiss,
  onRemove,
  onInfo,
  onSaveMatch,
  onSendMail,
}: {
  candidate: MatchedCandidate
  decision: CandidateDecision
  isSaved: boolean
  isSaving: boolean
  onAccept: () => void
  onDismiss: () => void
  onRemove: () => void
  onInfo: () => void
  onSaveMatch: () => void
  onSendMail: () => void
}) {
  const isDismissing = decision === 'dismissed'
  const isAccepted = decision === 'accepted' || isSaved

  return (
    <div
      className={[
        'transition-all duration-500 ease-in-out',
        isDismissing
          ? 'opacity-0 scale-95 max-h-0 overflow-hidden pointer-events-none'
          : 'opacity-100 scale-100 max-h-[600px]',
      ].join(' ')}
      onTransitionEnd={() => { if (isDismissing) onRemove() }}
    >
      <div className={[
        'rounded-xl border bg-white',
        isAccepted ? 'border-success/30 ring-1 ring-success/10 shadow-sm' : 'border-gray-100 shadow-sm',
      ].join(' ')}>
        <div className="p-4">
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
            <button
              onClick={onInfo}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-300 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <Info size={14} />
            </button>
          </div>

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
            <div className="flex flex-col gap-2">
              {isSaved ? (
                <div className="flex items-center gap-1.5 text-xs text-success font-medium">
                  <Check size={13} /> Retenu
                </div>
              ) : (
                <button
                  onClick={onSaveMatch}
                  disabled={isSaving}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-success/30 bg-success-bg px-3 py-1.5 text-xs font-medium text-success transition-all hover:bg-success/10 active:scale-[0.97] disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  Enregistrer le match
                </button>
              )}
              <button
                onClick={onSendMail}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 transition-all hover:bg-gray-50 active:scale-[0.97]"
              >
                <Mail size={13} /> Envoyer un mail
              </button>
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
}: {
  job: Job
  isSelected: boolean
  onSelect: () => void
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
      <div className="flex items-start gap-3">
        <div className={[
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors',
          isSelected ? 'bg-blue text-white' : 'bg-blue-light text-blue',
        ].join(' ')}>
          <Building2 size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 truncate">{job.companyName}</p>
          <p className="text-xs text-gray-400 mt-0.5">{job.ageRange ? `${job.ageRange} ans` : '—'}</p>
        </div>
        <ChevronRight
          size={16}
          className={[
            'text-gray-300 transition-transform duration-200 shrink-0 mt-0.5',
            isSelected ? 'rotate-90 text-blue' : 'group-hover:text-gray-400',
          ].join(' ')}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
        {job.desiredTP && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 col-span-2">
            <Briefcase size={11} className="text-gray-300 shrink-0" />
            <span className="truncate font-medium">{tpLabel(job.desiredTP)}</span>
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
        {job.sector && job.sector !== 'NONE' && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Building2 size={11} className="text-gray-300 shrink-0" />
            <span className="truncate">{formatEnum(job.sector)}</span>
          </div>
        )}
      </div>

      {job.localisation && job.localisation.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {job.localisation.slice(0, 3).map((loc) => (
            <span key={loc} className="rounded-md bg-gray-50 px-2 py-0.5 text-[10px] text-gray-500 border border-gray-100">
              {locLabel(loc)}
            </span>
          ))}
          {job.localisation.length > 3 && (
            <span className="rounded-md bg-gray-50 px-2 py-0.5 text-[10px] text-gray-400 border border-gray-100">
              +{job.localisation.length - 3}
            </span>
          )}
        </div>
      )}

      <div className="mt-3">
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${chip.cls}`}>
          {chip.label}
        </span>
      </div>
    </button>
  )
}

// ─── Job Details Section ──────────────────────────────────────────────────────

function JobDetailsSection({
  job,
  onSetStatus,
  hasAcceptedCandidates,
  isCreatingSession,
  onProposeCandidates,
}: {
  job: MatchJobResult
  onSetStatus: (status: JobStatus) => void
  hasAcceptedCandidates: boolean
  isCreatingSession: boolean
  onProposeCandidates: () => void
}) {
  const chip = statusChip(job.status)

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-light text-blue">
            <Building2 size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-gray-900 truncate">{job.companyName}</h2>
            <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-medium ${chip.cls}`}>
              {chip.label}
            </span>
          </div>
        </div>
        {hasAcceptedCandidates && (
          <button
            onClick={onProposeCandidates}
            disabled={isCreatingSession}
            className="flex shrink-0 items-center gap-2 rounded-xl border border-blue/20 px-4 py-2 text-sm font-semibold text-blue hover:bg-blue-light transition-colors disabled:opacity-50"
            title="Proposer les candidats acceptés à l'entreprise via un lien sécurisé"
          >
            {isCreatingSession ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Proposer les candidats
          </button>
        )}
      </div>

      <div className="mb-4 pb-4 border-b border-gray-50">
        <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-400 mb-2">Étape manuelle</p>
        <div className="flex flex-wrap gap-1.5">
          {MANUAL_JOB_STATUSES.map((status) => (
            <button
              key={status}
              onClick={() => onSetStatus(status)}
              disabled={job.status === status}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                job.status === status ? JOB_STATUS_BADGE_CLASS[status] : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {JOB_STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {job.desiredTP && (
          <div className="col-span-2 flex items-start gap-2">
            <Briefcase size={13} className="text-gray-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-400">Titre professionnel</p>
              <p className="text-xs font-medium text-gray-800 mt-0.5">{tpLabel(job.desiredTP)}</p>
            </div>
          </div>
        )}
        {job.ageRange && (
          <div className="flex items-start gap-2">
            <User size={13} className="text-gray-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-400">Tranche d'âge</p>
              <p className="text-xs font-medium text-gray-800 mt-0.5">{job.ageRange} ans</p>
            </div>
          </div>
        )}
        {job.desiredSex && (
          <div className="flex items-start gap-2">
            <User size={13} className="text-gray-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-400">Sexe</p>
              <p className="text-xs font-medium text-gray-800 mt-0.5">{sexLabel(job.desiredSex)}</p>
            </div>
          </div>
        )}
        {job.sector && job.sector !== 'NONE' && (
          <div className="flex items-start gap-2">
            <Building2 size={13} className="text-gray-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-400">Secteur</p>
              <p className="text-xs font-medium text-gray-800 mt-0.5">{formatEnum(job.sector)}</p>
            </div>
          </div>
        )}
        {job.drivingLicencseB === true && (
          <div className="flex items-start gap-2">
            <Car size={13} className="text-gray-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-400">Permis B</p>
              <p className="text-xs font-medium text-gray-800 mt-0.5">Requis</p>
            </div>
          </div>
        )}
        {job.professionalExperience === true && (
          <div className="flex items-start gap-2">
            <Briefcase size={13} className="text-gray-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-400">Expérience</p>
              <p className="text-xs font-medium text-gray-800 mt-0.5">Requise</p>
            </div>
          </div>
        )}
      </div>

      {job.localisation && job.localisation.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-50">
          <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-400 mb-2">
            <MapPin size={10} className="inline mr-1 text-gray-300" />
            Localisation{job.localisation.length > 1 ? 's' : ''}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {job.localisation.map((loc) => (
              <span key={loc} className="rounded-lg bg-blue-light/60 px-2.5 py-0.5 text-xs font-medium text-blue">
                {locLabel(loc)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Retained Candidates Section ──────────────────────────────────────────────

function RetainedCandidatesSection({
  candidates,
  isUnmatching,
  isMailingAll,
  mailAllProgress,
  missingCvCandidateIds,
  onInfo,
  onSendMail,
  onRemove,
  onUnmatchAll,
  onMailAll,
}: {
  candidates: MatchedCandidate[]
  isUnmatching: boolean
  isMailingAll: boolean
  mailAllProgress: { sent: number; total: number } | null
  missingCvCandidateIds: Set<string>
  onInfo: (c: MatchedCandidate) => void
  onSendMail: (c: MatchedCandidate) => void
  onRemove: (c: MatchedCandidate) => void
  onUnmatchAll: () => void
  onMailAll: () => void
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <UserCheck size={15} className="text-success" />
        <h3 className="text-sm font-semibold text-gray-800">Candidats retenus</h3>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-success-bg text-success">
          {candidates.length}
        </span>
        {candidates.length > 0 && (
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={onMailAll}
              disabled={isMailingAll}
              className="flex items-center gap-1 rounded-lg border border-blue/20 px-2.5 py-1 text-xs font-medium text-blue hover:bg-blue-light transition-colors disabled:opacity-50"
              title="Envoyer le mail d'offre à tous"
            >
              {isMailingAll ? (
                <><Loader2 size={11} className="animate-spin" /> {mailAllProgress ? `${mailAllProgress.sent}/${mailAllProgress.total}` : '…'}</>
              ) : (
                <><MailCheck size={11} /> Mail à tous</>
              )}
            </button>
            <button
              onClick={onUnmatchAll}
              disabled={isUnmatching}
              className="flex items-center gap-1 rounded-lg border border-danger/20 px-2.5 py-1 text-xs font-medium text-danger hover:bg-danger-bg transition-colors disabled:opacity-50"
              title="Retirer tous les candidats"
            >
              {isUnmatching ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
              Tout supprimer
            </button>
          </div>
        )}
      </div>

      {candidates.length === 0 ? (
        <div className="text-center py-4 px-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-400">Aucun candidat retenu pour l'instant.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {candidates.map((c) => (
            <RetainedCandidateRow
              key={c.id}
              candidate={c}
              hasMissingCv={missingCvCandidateIds.has(c.id)}
              onInfo={() => onInfo(c)}
              onSendMail={() => onSendMail(c)}
              onRemove={() => onRemove(c)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Matching Section ─────────────────────────────────────────────────────────

function formatOfferDetails(sector: string | null, localisation: string[] | null, desiredTP: string | null): string {
  const parts: string[] = []
  if (desiredTP && TP_TYPE_LABELS[desiredTP as keyof typeof TP_TYPE_LABELS]) {
    parts.push(TP_TYPE_LABELS[desiredTP as keyof typeof TP_TYPE_LABELS])
  }
  if (sector) {
    parts.push(formatEnumLabel(sector))
  }
  if (localisation && localisation.length > 0) {
    const locations = localisation
      .map((loc) => LOCALISATION_LABELS[loc as keyof typeof LOCALISATION_LABELS])
      .filter(Boolean)
      .join(', ')
    if (locations) parts.push(locations)
  }
  return parts.join(' • ')
}

function buildOfferMailBody(
  candidateName: string,
  sector: string | null,
  localisation: string[] | null,
  desiredTP: string | null,
  ouiUrl: string,
  nonUrl: string,
): string {
  const name = candidateName?.split(' ')[0] ?? 'Candidat'
  const offerDetails = formatOfferDetails(sector, localisation, desiredTP)
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 20px; color: #1f2937; }
  .logo { color: #60207E; font-weight: 800; font-size: 20px; margin-bottom: 28px; letter-spacing: -0.5px; }
  p { line-height: 1.6; margin: 0 0 16px; }
  .offer-details { background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0; font-weight: 500; color: #374151; }
  .question { font-size: 17px; font-weight: 700; margin: 28px 0 24px; }
  .buttons { display: flex; gap: 12px; margin: 28px 0; }
  .btn { display: inline-block; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px; }
  .btn-oui { background: #60207E; color: #ffffff; }
  .btn-non { background: #f3f4f6; color: #374151; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px; }
</style>
</head>
<body>
  <div class="logo">DISCIPLINA</div>
  <p>Bonjour ${name},</p>
  <p>Nous avons une offre en alternance qui pourrait vous correspondre.</p>
  <div class="offer-details">${offerDetails}</div>
  <p class="question">Êtes-vous intéressé(e) par cette opportunité ?</p>
  <div class="buttons">
    <a href="${ouiUrl}" class="btn btn-oui">✓ &nbsp;Oui, je suis intéressé(e)</a>
    <a href="${nonUrl}" class="btn btn-non">✗ &nbsp;Non, merci</a>
  </div>
  <p>Un simple clic suffit — nous prendrons contact avec vous rapidement.</p>
  <div class="footer">Cordialement,<br>L'équipe DISCIPLINA</div>
</body>
</html>`
}

async function resolveCompanyEmail(companyName: string): Promise<string> {
  const result = await graphqlClient.query(GET_COMPANIES, { search: companyName, first: 1 }).toPromise()
  return result.data?.companies?.edges?.[0]?.node?.company?.email ?? ''
}

async function hasCandidateCv(candidateId: string): Promise<boolean> {
  const result = await candidateGraphqlClient.query(GET_CANDIDATE_CV_STATUS, { id: candidateId }).toPromise()
  return Boolean(result.data?.candidate?.cvLink)
}

function buildInterviewDatesMailBody(companyName: string, candidateName: string, slots: string[]): string {
  const name = candidateName?.split(' ')[0] ?? 'Candidat'
  const items = slots
    .map((s) => `<li>${new Date(s).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</li>`)
    .join('')
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 20px; color: #1f2937;">
  <div style="color:#60207E;font-weight:800;font-size:20px;margin-bottom:28px;">DISCIPLINA</div>
  <p>Bonjour ${name},</p>
  <p>L'entreprise <strong>${companyName}</strong> souhaite vous rencontrer. Voici les créneaux d'entretien proposés :</p>
  <ul>${items}</ul>
  <p>Merci de nous indiquer le créneau qui vous convient.</p>
  <p style="margin-top:40px;color:#9ca3af;font-size:12px;">Cordialement,<br>L'équipe DISCIPLINA</p>
</body>
</html>`
}

function MatchingSection({
  suggestedCandidates,
  savedCandidateIds,
  decisions,
  isMatching,
  matchError,
  hasLaunched,
  savingIds,
  onLaunch,
  onAccept,
  onDismiss,
  onRemove,
  onInfo,
  onSaveMatch,
  onSendMail,
}: {
  suggestedCandidates: MatchedCandidate[]
  savedCandidateIds: Set<string>
  decisions: Record<string, CandidateDecision>
  isMatching: boolean
  matchError: string | null
  hasLaunched: boolean
  savingIds: Set<string>
  onLaunch: () => void
  onAccept: (id: string) => void
  onDismiss: (id: string) => void
  onRemove: (id: string) => void
  onInfo: (c: MatchedCandidate) => void
  onSaveMatch: (id: string) => void
  onSendMail: (c: MatchedCandidate) => void
}) {
  const retainedCount = savedCandidateIds.size
  const acceptedThisSession = Object.values(decisions).filter((d) => d === 'accepted').length

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={15} className="text-blue" />
        <h3 className="text-sm font-semibold text-gray-800">Matching automatique</h3>
        {hasLaunched && !isMatching && (
          <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-light text-blue">
            {suggestedCandidates.length} suggestion{suggestedCandidates.length > 1 ? 's' : ''}
          </span>
        )}
        {(retainedCount > 0 || acceptedThisSession > 0) && hasLaunched && !isMatching && (
          <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-success-bg text-success">
            <Check size={10} /> {retainedCount + acceptedThisSession} retenu{retainedCount + acceptedThisSession > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {!hasLaunched && (
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-light text-blue">
            <Sparkles size={22} />
          </div>
          <p className="text-xs text-gray-500 text-center max-w-[220px]">
            Lancez le matching pour trouver les candidats correspondant aux critères de cette offre.
          </p>
          <button
            onClick={onLaunch}
            className="flex items-center gap-2 rounded-xl bg-blue px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-blue/90 active:scale-[0.97] shadow-sm"
          >
            <PlayCircle size={16} />
            Lancer le matching
          </button>
        </div>
      )}

      {hasLaunched && isMatching && (
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-2 border-blue-light" />
            <Loader2 size={20} className="absolute inset-0 m-auto animate-spin text-blue" />
          </div>
          <p className="text-sm text-gray-400">Matching en cours…</p>
        </div>
      )}

      {hasLaunched && !isMatching && matchError && (
        <div className="flex items-start gap-2 rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{matchError}</span>
        </div>
      )}

      {hasLaunched && !isMatching && !matchError && (
        <>
          {suggestedCandidates.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-100">
                <Users size={18} className="text-gray-300" />
              </div>
              <p className="text-xs text-gray-400">Aucun profil disponible ne correspond à cette offre.</p>
              <button
                onClick={onLaunch}
                className="flex items-center gap-1.5 text-xs font-medium text-blue hover:text-blue/80 transition-colors mt-1"
              >
                <RefreshCw size={12} /> Relancer
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {suggestedCandidates.map((c) => (
                <CandidateCard
                  key={c.id}
                  candidate={c}
                  decision={decisions[c.id] ?? null}
                  isSaved={savedCandidateIds.has(c.id)}
                  isSaving={savingIds.has(c.id)}
                  onAccept={() => onAccept(c.id)}
                  onDismiss={() => onDismiss(c.id)}
                  onRemove={() => onRemove(c.id)}
                  onInfo={() => onInfo(c)}
                  onSaveMatch={() => onSaveMatch(c.id)}
                  onSendMail={() => onSendMail(c)}
                />
              ))}
              <button
                onClick={onLaunch}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-100 px-3 py-2 text-xs font-medium text-gray-500 transition-all hover:bg-gray-50 mt-1"
              >
                <RefreshCw size={12} /> Relancer le matching
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Right Panel ──────────────────────────────────────────────────────────────

function formatSlot(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function ProposedCandidatesSection({
  candidates,
  onSendDates,
}: {
  candidates: ProposedCandidate[]
  onSendDates: (candidate: ProposedCandidate) => void
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Heart size={15} className="text-purple" />
        <h3 className="text-sm font-semibold text-gray-800">Candidats proposés</h3>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple/10 text-purple">{candidates.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {candidates.map((c) => {
          const slots = c.interviewSlots ?? []
          const canSendDates = (c.answer === ProposedCandidateAnswer.ACCEPTED || c.answer === ProposedCandidateAnswer.FAVORITE) && slots.length > 0
          return (
            <div key={c.id} className="rounded-lg border border-gray-100 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900">{c.fullName}</p>
                {c.answer ? (
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${PROPOSED_CANDIDATE_ANSWER_BADGE_CLASS[c.answer]}`}>
                    {PROPOSED_CANDIDATE_ANSWER_LABELS[c.answer]}
                  </span>
                ) : (
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-medium text-gray-500">En attente</span>
                )}
              </div>
              {slots.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {slots.map((s) => (
                    <span key={s} className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-1 text-[11px] text-gray-600">
                      <CalendarClock size={11} /> {formatSlot(s)}
                    </span>
                  ))}
                </div>
              )}
              {canSendDates && (
                <button
                  onClick={() => onSendDates(c)}
                  className="mt-2 flex items-center gap-1.5 rounded-lg border border-purple/20 px-2.5 py-1 text-xs font-medium text-purple hover:bg-purple/5 transition-colors"
                >
                  <Mail size={12} /> Envoyer les dates au candidat
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ProposeCandidatesModal({
  candidates,
  isSubmitting,
  onSubmit,
  onClose,
}: {
  candidates: MatchedCandidate[]
  isSubmitting: boolean
  onSubmit: (descriptions: Record<string, string>) => void
  onClose: () => void
}) {
  const [descriptions, setDescriptions] = useState<Record<string, string>>({})

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <h2 className="text-base font-bold text-gray-900">Proposer les candidats à l'entreprise</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-50"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <p className="mb-4 text-[13px] text-gray-500">
            Ajoutez une note pour chaque candidat. Un lien sécurisé sera envoyé à l'entreprise pour qu'elle réponde.
          </p>
          <div className="flex flex-col gap-4">
            {candidates.map((c) => (
              <div key={c.id}>
                <p className="mb-1 text-[13px] font-semibold text-gray-800">{c.fullName}</p>
                <textarea
                  value={descriptions[c.id] ?? ''}
                  onChange={(e) => setDescriptions((p) => ({ ...p, [c.id]: e.target.value }))}
                  placeholder="Note / point fort du candidat (optionnel)"
                  rows={2}
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-purple"
                />
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 p-4">
          <button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-[13px] font-semibold text-gray-600 hover:bg-gray-50">
            Annuler
          </button>
          <button
            onClick={() => onSubmit(descriptions)}
            disabled={isSubmitting || candidates.length === 0}
            className="flex items-center gap-2 rounded-lg bg-purple px-4 py-2 text-[13px] font-bold text-white hover:bg-purple-dark disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Envoyer le lien
          </button>
        </div>
      </div>
    </div>
  )
}

function ProposeResultModal({ companyName, onClose }: { companyName: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 text-green-600">
          <Check size={30} />
        </div>
        <p className="mt-3 text-[16px] font-extrabold text-gray-900">Lien envoyé</p>
        <p className="mt-1 text-[13px] text-gray-500">
          Un lien sécurisé a été envoyé à {companyName}. Vous serez notifié dès sa réponse.
        </p>
        <button onClick={onClose} className="mt-4 w-full rounded-lg bg-purple px-4 py-2.5 text-[14px] font-bold text-white hover:bg-purple-dark">
          Fermer
        </button>
      </div>
    </div>
  )
}

function RightPanel({ selectedJob }: { selectedJob: Job | null }) {
  const [jobData, setJobData] = useState<MatchJobResult | null>(null)
  const [suggestedCandidates, setSuggestedCandidates] = useState<MatchedCandidate[]>([])
  const [savedCandidateIds, setSavedCandidateIds] = useState<Set<string>>(new Set())
  const [decisions, setDecisions] = useState<Record<string, CandidateDecision>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isMatching, setIsMatching] = useState(false)
  const [isUnmatching, setIsUnmatching] = useState(false)
  const [isMailingAll, setIsMailingAll] = useState(false)
  const [mailAllProgress, setMailAllProgress] = useState<{ sent: number; total: number } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [matchError, setMatchError] = useState<string | null>(null)
  const [hasLaunched, setHasLaunched] = useState(false)
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())
  const [drawerCandidate, setDrawerCandidate] = useState<MatchedCandidate | null>(null)
  const [mailState, setMailState] = useState<{ candidate: MatchedCandidate; ouiUrl: string; nonUrl: string } | null>(null)
  const [proposeState, setProposeState] = useState<{ candidates: MatchedCandidate[]; descriptions: Record<string, string> } | null>(null)
  const [proposeResult, setProposeResult] = useState<{ signature: string } | null>(null)
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [datesMailState, setDatesMailState] = useState<ProposedCandidate | null>(null)
  const [missingCvCandidateIds, setMissingCvCandidateIds] = useState<Set<string>>(new Set())
  const token = useAuthStore((s) => s.token)

  const loadJobData = useCallback(async (job: Job) => {
    setIsLoading(true)
    setLoadError(null)
    setJobData(null)
    setSuggestedCandidates([])
    setSavedCandidateIds(new Set())
    setDecisions({})
    setHasLaunched(false)
    setMatchError(null)

    try {
      const result = await jobGraphqlClient.query(MATCH_JOB, { id: job.id }).toPromise()
      if (result.error) { setLoadError(result.error.message); return }
      if (result.data?.matchJob) {
        const data = result.data.matchJob as MatchJobResult
        setJobData(data)
        const matchedIds = new Set((data.matchedCandidate ?? []).map((c) => c.id))
        setSavedCandidateIds(matchedIds)
        setSuggestedCandidates((data.suggestedCandidates ?? []).filter((c) => !matchedIds.has(c.id)))
      }
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const runMatch = useCallback(async (job: Job) => {
    setIsMatching(true)
    setMatchError(null)
    setHasLaunched(true)
    setDecisions({})

    try {
      const result = await jobGraphqlClient.query(MATCH_JOB, { id: job.id }).toPromise()
      if (result.error) { setMatchError(result.error.message); return }
      if (result.data?.matchJob) {
        const data = result.data.matchJob as MatchJobResult
        const matchedIds = new Set((data.matchedCandidate ?? []).map((c) => c.id))
        setSavedCandidateIds(matchedIds)
        setSuggestedCandidates((data.suggestedCandidates ?? []).filter((c) => !matchedIds.has(c.id)))
        if (jobData) setJobData({ ...jobData, matchedCandidate: data.matchedCandidate ?? [] })
      }
    } catch (err: unknown) {
      setMatchError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setIsMatching(false)
    }
  }, [jobData])

  useEffect(() => {
    if (selectedJob) loadJobData(selectedJob)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJob?.id])

  const handleSaveMatch = async (candidateId: string) => {
    if (!selectedJob) return
    setSavingIds((p) => new Set(p).add(candidateId))
    try {
      const result = await jobGraphqlClient.mutation(ADD_CANDIDATE_TO_JOB, { jobId: selectedJob.id, candidateId }).toPromise()
      if (!result.error) {
        setSavedCandidateIds((p) => new Set(p).add(candidateId))
        setSuggestedCandidates((p) => p.filter((c) => c.id !== candidateId))
        if (result.data?.addCandidateToJob?.matchedCandidate && jobData) {
          setJobData({ ...jobData, matchedCandidate: result.data.addCandidateToJob.matchedCandidate })
        }
      }
    } finally {
      setSavingIds((p) => { const n = new Set(p); n.delete(candidateId); return n })
    }
  }

  const handleRemoveCandidate = async (candidate: MatchedCandidate) => {
    if (!selectedJob) return
    const result = await jobGraphqlClient.mutation(REMOVE_CANDIDATE_FROM_JOB, { jobId: selectedJob.id, candidateId: candidate.id }).toPromise()
    if (!result.error && jobData) {
      const updated = result.data?.removeCandidateFromJob
      setJobData({ ...jobData, matchedCandidate: updated?.matchedCandidate ?? [], status: updated?.status ?? jobData.status })
      setSavedCandidateIds((p) => { const n = new Set(p); n.delete(candidate.id); return n })
    }
  }

  const handleUnmatchAll = async () => {
    if (!selectedJob) return
    setIsUnmatching(true)
    try {
      const result = await jobGraphqlClient.mutation(UNMATCH_JOB, { id: selectedJob.id }).toPromise()
      if (!result.error && jobData) {
        setJobData({ ...jobData, matchedCandidate: [], status: 'NOT_MATCHED' })
        setSavedCandidateIds(new Set())
      }
    } finally {
      setIsUnmatching(false)
    }
  }

  const handleMailAll = async () => {
    if (!selectedJob || !jobData) return
    const retained = jobData.matchedCandidate ?? []
    if (retained.length === 0) return

    setIsMailingAll(true)
    setMailAllProgress({ sent: 0, total: retained.length })

    const missingCvIds = new Set<string>()
    const sentIds = new Set<string>()

    for (let i = 0; i < retained.length; i++) {
      const candidate = retained[i]
      try {
        const hasCv = await hasCandidateCv(candidate.id)
        if (!hasCv) {
          missingCvIds.add(candidate.id)
          setMailAllProgress({ sent: i + 1, total: retained.length })
          continue
        }

        const linksResult = await jobGraphqlClient.query(OFFER_RESPONSE_LINKS, { jobId: selectedJob.id, candidateId: candidate.id }).toPromise()
        if (linksResult.data?.offerResponseLinks) {
          const { ouiUrl, nonUrl } = linksResult.data.offerResponseLinks
          const subject = `DISCIPLINA – Offre en alternance`
          const body = buildOfferMailBody(candidate.fullName, jobData.sector, jobData.localisation, jobData.desiredTP, ouiUrl, nonUrl)
          await fetch(`${import.meta.env.VITE_API_URL}/api/email/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ to: candidate.email, subject, body }),
          })
          await jobGraphqlClient.mutation(UPDATE_MATCHED_CANDIDATE_STATUS, { jobId: selectedJob.id, candidateId: candidate.id, status: MatchedCandidateStatus.OFFER_SEND }).toPromise()
          sentIds.add(candidate.id)
        }
      } catch {
        // continue with next candidate on error
      }
      setMailAllProgress({ sent: i + 1, total: retained.length })
    }

    setMissingCvCandidateIds(missingCvIds)

    if (jobData) {
      setJobData({
        ...jobData,
        matchedCandidate: (jobData.matchedCandidate ?? []).map((c) =>
          sentIds.has(c.id) ? { ...c, status: MatchedCandidateStatus.OFFER_SEND } : c
        ),
      })
    }
    setIsMailingAll(false)
    setMailAllProgress(null)
  }

  const handleOpenMail = async (candidate: MatchedCandidate) => {
    if (!selectedJob) return

    const hasCv = await hasCandidateCv(candidate.id)
    if (!hasCv) {
      setMissingCvCandidateIds((p) => new Set(p).add(candidate.id))
      return
    }
    setMissingCvCandidateIds((p) => { const n = new Set(p); n.delete(candidate.id); return n })

    const result = await jobGraphqlClient.query(OFFER_RESPONSE_LINKS, { jobId: selectedJob.id, candidateId: candidate.id }).toPromise()
    if (result.data?.offerResponseLinks) {
      const { ouiUrl, nonUrl } = result.data.offerResponseLinks
      setMailState({ candidate, ouiUrl, nonUrl })
    }
  }

  const handleMailSent = async (candidate: MatchedCandidate) => {
    if (!selectedJob) return
    await jobGraphqlClient.mutation(UPDATE_MATCHED_CANDIDATE_STATUS, { jobId: selectedJob.id, candidateId: candidate.id, status: MatchedCandidateStatus.OFFER_SEND }).toPromise()
    if (jobData) {
      setJobData({
        ...jobData,
        matchedCandidate: (jobData.matchedCandidate ?? []).map((c) =>
          c.id === candidate.id ? { ...c, status: MatchedCandidateStatus.OFFER_SEND } : c
        ),
      })
    }
  }

  const handleOpenProposeCandidates = () => {
    if (!jobData) return
    const accepted = (jobData.matchedCandidate ?? []).filter((c) => c.status === MatchedCandidateStatus.ACCEPTED)
    setProposeState({ candidates: accepted, descriptions: {} })
  }

  const handleCreateMatchSession = async (descriptions: Record<string, string>) => {
    if (!jobData || !proposeState) return
    setIsCreatingSession(true)
    try {
      const companyEmail = await resolveCompanyEmail(jobData.companyName)
      const candidates = proposeState.candidates.map((c) => ({ id: c.id, description: descriptions[c.id] ?? '' }))
      const result = await jobGraphqlClient
        .mutation(CREATE_MATCH_SESSION, { jobId: jobData.id, companyEmail, candidates })
        .toPromise()
      if (result.error) throw new Error(result.error.message)
      setProposeState(null)
      setProposeResult({ signature: result.data?.createMatchSession ?? '' })
    } finally {
      setIsCreatingSession(false)
    }
  }

  const handleSendInterviewDates = (candidate: ProposedCandidate) => {
    setDatesMailState(candidate)
  }

  const handleSetManualStatus = async (status: JobStatus) => {
    if (!selectedJob) return
    const result = await jobGraphqlClient.mutation(UPDATE_JOB, { id: selectedJob.id, job: { id: selectedJob.id, status } }).toPromise()
    if (!result.error && jobData) {
      setJobData({ ...jobData, status })
    }
  }

  if (!selectedJob) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 py-24 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-light text-blue">
          <Sparkles size={24} />
        </div>
        <p className="text-sm font-medium text-gray-700">Sélectionnez une offre</p>
        <p className="text-xs text-gray-400 max-w-[200px]">
          Cliquez sur une offre pour voir ses détails et lancer le matching.
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <Loader2 size={28} className="animate-spin text-blue" />
        <p className="text-sm text-gray-400">Chargement de l'offre…</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex items-start gap-2 rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        <span>{loadError}</span>
      </div>
    )
  }

  if (!jobData) return null

  return (
    <div className="flex flex-col gap-4 pb-6">
      <JobDetailsSection
        job={jobData}
        onSetStatus={handleSetManualStatus}
        hasAcceptedCandidates={(jobData.matchedCandidate ?? []).some((c) => c.status === MatchedCandidateStatus.ACCEPTED)}
        isCreatingSession={isCreatingSession}
        onProposeCandidates={handleOpenProposeCandidates}
      />

      <RetainedCandidatesSection
        candidates={jobData.matchedCandidate ?? []}
        isUnmatching={isUnmatching}
        isMailingAll={isMailingAll}
        mailAllProgress={mailAllProgress}
        missingCvCandidateIds={missingCvCandidateIds}
        onInfo={setDrawerCandidate}
        onSendMail={handleOpenMail}
        onRemove={handleRemoveCandidate}
        onUnmatchAll={handleUnmatchAll}
        onMailAll={handleMailAll}
      />

      {(jobData.proposedCandidate?.length ?? 0) > 0 && (
        <ProposedCandidatesSection
          candidates={jobData.proposedCandidate}
          onSendDates={handleSendInterviewDates}
        />
      )}

      <MatchingSection
        suggestedCandidates={suggestedCandidates}
        savedCandidateIds={savedCandidateIds}
        decisions={decisions}
        isMatching={isMatching}
        matchError={matchError}
        hasLaunched={hasLaunched}
        savingIds={savingIds}
        onLaunch={() => runMatch(selectedJob)}
        onAccept={(id) => setDecisions((p) => ({ ...p, [id]: 'accepted' }))}
        onDismiss={(id) => setDecisions((p) => ({ ...p, [id]: 'dismissed' }))}
        onRemove={(id) => {
          setSuggestedCandidates((p) => p.filter((c) => c.id !== id))
          setDecisions((p) => { const n = { ...p }; delete n[id]; return n })
        }}
        onInfo={setDrawerCandidate}
        onSaveMatch={handleSaveMatch}
        onSendMail={handleOpenMail}
      />

      {drawerCandidate && (
        <CandidateInfoDrawer
          candidate={drawerCandidate}
          onClose={() => setDrawerCandidate(null)}
        />
      )}

      {mailState && (
        <MailModal
          defaultTo={mailState.candidate.email}
          candidateName={mailState.candidate.fullName}
          defaultSubject={`DISCIPLINA – Offre en alternance`}
          defaultBody={buildOfferMailBody(
            mailState.candidate.fullName,
            jobData.sector,
            jobData.localisation,
            jobData.desiredTP,
            mailState.ouiUrl,
            mailState.nonUrl,
          )}
          scope="rh"
          onClose={() => setMailState(null)}
          onSent={() => handleMailSent(mailState.candidate)}
        />
      )}

      {proposeState && (
        <ProposeCandidatesModal
          candidates={proposeState.candidates}
          isSubmitting={isCreatingSession}
          onSubmit={handleCreateMatchSession}
          onClose={() => setProposeState(null)}
        />
      )}

      {proposeResult && (
        <ProposeResultModal companyName={jobData.companyName} onClose={() => setProposeResult(null)} />
      )}

      {datesMailState && (
        <MailModal
          defaultTo={datesMailState.email}
          candidateName={datesMailState.fullName}
          defaultSubject={`DISCIPLINA – Proposition d'entretien chez ${jobData.companyName}`}
          defaultBody={buildInterviewDatesMailBody(
            jobData.companyName,
            datesMailState.fullName,
            datesMailState.interviewSlots ?? [],
          )}
          scope="rh"
          onClose={() => setDatesMailState(null)}
        />
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Matching() {
  const [searchParams] = useSearchParams()
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [filters, setFilters] = useState<JobFiltersType>(EMPTY_JOB_FILTERS)

  const token = useAuthStore((s) => s.token)
  const [jobsResult] = useQuery({
    query: GET_JOBS,
    context: {
      url: `${import.meta.env.VITE_API_URL}/api/graphql/jobs`,
      fetchOptions: { headers: { Authorization: `Bearer ${token}` } },
    },
  })

  const jobs: Job[] = jobsResult.data?.jobs ?? []
  const filteredJobs = applyJobFilters(jobs, filters)
  // ?job= (lien de notification) sert d'offre présélectionnée tant qu'aucune sélection manuelle
  const effectiveJobId = selectedJobId ?? searchParams.get('job')
  const selectedJob = filteredJobs.find((j) => j.id === effectiveJobId) ?? null

  if (jobsResult.fetching) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <Loader2 size={28} className="animate-spin text-blue" />
        <p className="text-sm text-gray-400">Chargement des offres…</p>
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
              {filteredJobs.length} offre{filteredJobs.length > 1 ? 's' : ''}{jobs.length !== filteredJobs.length ? ` · ${jobs.length} au total` : ''}
            </p>
          </div>
        </div>
        <JobFilters filters={filters} onChange={setFilters} jobs={jobs} />
      </div>

      {/* Two-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* ─ Left: Job list ─ */}
        <div className="w-[360px] shrink-0 flex flex-col border-r border-gray-100 bg-gray-50/50 overflow-y-auto">
          <div className="px-4 pt-4 pb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Offres entreprises</p>
          </div>
          {filteredJobs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center px-6">
              <Building2 size={28} className="text-gray-300" />
              <p className="text-sm text-gray-400">
                {jobs.length === 0 ? 'Aucune offre disponible' : 'Aucune offre ne correspond aux filtres'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 px-4 pb-6">
              {filteredJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  isSelected={selectedJobId === job.id}
                  onSelect={() => setSelectedJobId(job.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ─ Right: Detail panel ─ */}
        <div className="flex-1 overflow-y-auto px-5 pt-5">
          <RightPanel selectedJob={selectedJob} />
        </div>
      </div>
    </div>
  )
}

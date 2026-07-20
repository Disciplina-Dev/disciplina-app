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
  MailCheck,
  Send,
  Heart,
  CalendarClock,
  FileEdit,
} from 'lucide-react'
import { GET_OFFERS, MATCH_OFFER, ADD_CANDIDATE_TO_OFFER, ADD_MANUAL_PROPOSED_CANDIDATE, ADD_MANUAL_PROPOSED_CANDIDATE_FOR_IMMERSION, SET_INTERVIEW_CONCLUSION, SET_IMMERSION_CONCLUSION, OFFER_RESPONSE_LINKS, UPDATE_OFFER, REMOVE_CANDIDATE_FROM_OFFER, UPDATE_MATCHED_CANDIDATE_STATUS } from '@/graphql/queries'
import { MATCHED_CANDIDATE_STATUS_LABELS, MATCHED_CANDIDATE_STATUS_BADGE_CLASS, MatchedCandidateStatus } from '@/constants/matchedCandidateStatus'
import { INTERVIEW_CONCLUSION_LABELS, INTERVIEW_CONCLUSION_BADGE_CLASS, InterviewConclusion } from '@/constants/interviewConclusion'
import { IMMERSION_CONCLUSION_LABELS, IMMERSION_CONCLUSION_BADGE_CLASS, ImmersionConclusion } from '@/constants/immersionConclusion'
import { JOB_STATUS_LABELS, JOB_STATUS_BADGE_CLASS } from '@/constants/jobStatus'
import { OfferStatus, formatEnumLabel } from '@/features/matching/constants/jobEnums'
import { offerGraphqlClient } from '@/graphql/client'
import { useQuery } from 'urql'
import { useAuthStore, useCurrentUser, UserRole, Permission } from '@/store/authStore'
import { JobFilters } from '@/features/matching/components/JobFilters'
import type { JobFilters as JobFiltersType } from '@/features/matching/services/jobFilters'
import { EMPTY_JOB_FILTERS, applyJobFilters } from '@/features/matching/services/jobFilters'
import MailModal from '@/components/ui/MailModal'
import InterviewModal from '@/features/matching/components/InterviewModal'
import AddPreselectedCandidateModal from '@/features/matching/components/AddPreselectedCandidateModal'
import AddAcceptedCandidateModal from '@/features/matching/components/AddAcceptedCandidateModal'
import CompanyInfoModal from '@/features/matching/components/CompanyInfoModal'
import InterviewConclusionModal from '@/features/matching/components/InterviewConclusionModal'
import ImmersionConclusionModal from '@/features/matching/components/ImmersionConclusionModal'
import { isInterviewDatePast } from '@/utils/interview'
import NeedsAnalysisModal from '@/features/abEntreprise/components/NeedsAnalysisModal'
import { useNeedsAnalysis, useCompanyBySiret } from '@/graphql/hooks'
import type { Entreprise } from '@/types/entreprise'
import { LOCALISATION_LABELS } from '@/data/reunionCommunes'
import { SECTOR_LABELS } from '@/data/sectors'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchedCandidate {
  id: string
  fullName: string
  age: number
  sex: string
  city: string
  email: string
  phone: string
  status?: string | null
  description?: string | null
  comment?: string | null
  interviewLocation?: string
  bookedInterviewSlot?: string | null
  interviewConclusion?: InterviewConclusion | null
  immersionStartDate?: string | null
  immersionEndDate?: string | null
  immersionLocation?: string | null
  immersionConclusion?: ImmersionConclusion | null
}

interface SalerInfo {
  id?: number | null
  email?: string | null
}

interface ReferentDetails {
  name?: string | null
  phone?: string | null
  email?: string | null
  function?: string | null
}

interface Referents {
  isSame?: boolean | null
  legalReferents?: ReferentDetails | null
  recruitmentReferents?: ReferentDetails | null
}

interface Job {
  id: string
  needsAnalysisId?: string | null
  companyInfos?: { id?: number; name?: string; activities?: string[] | null } | null
  softSkills?: string | null
  companyName: string
  ageRange: string
  desiredTP: string | null
  desiredSex: string | null
  drivingLicencseB: boolean | null
  professionalExperience: boolean | null
  status: string | null
  localisation: string[] | null
  sector: string | null
  salerInfo?: SalerInfo | null
  referents?: Referents | null
  title?: string | null
  missions?: string[] | null
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
    AD: 'AD – Assistante de Direction',
    CC: 'CC – Conseiller Commercial',
    NTC: 'NTC – Négociateur technico-commercial',
    REM: "REM – Responsable d'établissement Marchand",
    SA: 'SA',
  }
  return map[raw] ?? raw
}

function statusChip(status: string | null): { label: string; cls: string } {
  if (!status) return { label: '—', cls: 'bg-gray-100 text-gray-600' }
  const jobStatus = status as OfferStatus
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

// ─── Candidate Row ────────────────────────────────────────────────────────────

function CandidateRow({
  candidate,
  onInfo,
  onSendMail,
  onRemove,
  actions,
}: {
  candidate: MatchedCandidate
  onInfo: () => void
  onSendMail?: () => void
  onRemove?: () => void
  actions?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-gray-100 p-3">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-sm font-semibold text-gray-900">{candidate.fullName}</p>
        {candidate.status && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${MATCHED_CANDIDATE_STATUS_BADGE_CLASS[candidate.status as MatchedCandidateStatus] ?? 'bg-gray-100 text-gray-600'}`}>
            {MATCHED_CANDIDATE_STATUS_LABELS[candidate.status as MatchedCandidateStatus] ?? candidate.status}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-3 mb-2">
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
        {candidate.age && (
          <span className="text-xs text-gray-500">{candidate.age} ans</span>
        )}
      </div>

      {candidate.status === MatchedCandidateStatus.REFUSED && candidate.comment && (
        <p className="mb-2 rounded-md bg-gray-50 px-2 py-1 text-[11px] text-gray-600">
          Motif du refus : {candidate.comment}
        </p>
      )}

      {candidate.bookedInterviewSlot && candidate.interviewLocation && (
        <div className="mb-2 rounded-md bg-gray-50 px-2 py-1 text-[11px] text-gray-600">
          <p><CalendarClock size={11} className="inline mr-1" /> {formatSlot(candidate.bookedInterviewSlot)}</p>
          <p>📍 {candidate.interviewLocation}</p>
        </div>
      )}

      {candidate.immersionStartDate && candidate.immersionEndDate && (
        <p className="mb-2 text-[11px] text-gray-500">
          Immersion du {candidate.immersionStartDate} au {candidate.immersionEndDate}
        </p>
      )}

      {candidate.interviewConclusion && (
        <span className={`mb-2 inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-medium ${INTERVIEW_CONCLUSION_BADGE_CLASS[candidate.interviewConclusion]}`}>
          {INTERVIEW_CONCLUSION_LABELS[candidate.interviewConclusion]}
        </span>
      )}

      {candidate.immersionConclusion && (
        <span className={`mb-2 inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-medium ${IMMERSION_CONCLUSION_BADGE_CLASS[candidate.immersionConclusion]}`}>
          {IMMERSION_CONCLUSION_LABELS[candidate.immersionConclusion]}
        </span>
      )}

      <div className="flex items-center gap-1">
        <button
          onClick={onInfo}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          title="Voir la fiche"
        >
          <Info size={14} />
        </button>
        {onSendMail && (
          <button
            onClick={onSendMail}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-blue transition-colors"
            title="Envoyer un mail"
          >
            <Mail size={14} />
          </button>
        )}
        {onRemove && (
          <button
            onClick={onRemove}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-danger-bg hover:text-danger transition-colors"
            title="Retirer ce candidat"
          >
            <UserX size={14} />
          </button>
        )}
        {actions}
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
  hasAcceptedCandidates,
  isCreatingSession,
  onProposeCandidates,
  onShowCompanyInfo,
  onEditAb,
}: {
  job: MatchJobResult
  onSetStatus: (status: OfferStatus) => void
  hasAcceptedCandidates: boolean
  isCreatingSession: boolean
  onProposeCandidates: () => void
  onShowCompanyInfo: () => void
  onEditAb?: () => void
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
            <button
              type="button"
              onClick={onShowCompanyInfo}
              className="text-left text-base font-bold text-gray-900 truncate hover:text-blue hover:underline"
              title="Voir toutes les infos de l'entreprise"
            >
              {job.companyName}
            </button>
            <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-medium ${chip.cls}`}>
              {chip.label}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onEditAb && (
            <button
              onClick={onEditAb}
              className="flex items-center justify-center gap-2 rounded-xl border border-gray-100 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:border-blue/20 hover:text-blue hover:bg-blue-light/30 md:px-4"
              title="Modifier l'analyse du besoin"
            >
              <FileEdit size={16} />
              <span className="hidden md:inline">Modifier l'AB</span>
            </button>
          )}
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
      </div>

      <div className="mb-4 pb-4 border-b border-gray-50">
        <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-400 mb-2">
          <Briefcase size={10} className="inline mr-1 text-gray-300" />
          Critères
        </p>
        <div className="grid grid-cols-2 gap-3">
          {job.desiredTP && (
            <div className="flex items-start gap-2">
              <Briefcase size={13} className="text-gray-300 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-400">Type de TP</p>
                <p className="text-xs font-medium text-gray-800 mt-0.5">{tpLabel(job.desiredTP)}</p>
              </div>
            </div>
          )}
          {job.title && (
            <div className="flex items-start gap-2">
              <User size={13} className="text-gray-300 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-400">Intitulé du poste</p>
                <p className="text-xs font-medium text-gray-800 mt-0.5">{job.title}</p>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {job.missions && job.missions.length > 0 && (
            <div>
              <details className="group">
                <summary className="flex cursor-pointer items-center gap-2 text-[10px] uppercase font-semibold tracking-wider text-gray-400 list-none [&::-webkit-details-marker]:hidden">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors group-open:bg-blue-light group-open:text-blue group-open:border-blue/20">
                    <ChevronRight size={12} className="transition-transform group-open:rotate-90" />
                    {job.missions.length} mission{job.missions.length > 1 ? 's' : ''}
                  </span>
                </summary>
                <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50/50 p-3 space-y-1.5">
                  {job.missions.map((mission, i) => (
                    <p key={i} className="text-xs font-medium text-gray-700 flex items-start gap-2">
                      <span className="text-gray-300 mt-0.5 shrink-0">•</span>
                      {mission}
                    </p>
                  ))}
                </div>
              </details>
            </div>
          )}
          {job.companyInfos?.activities && job.companyInfos.activities.length > 0 && (
            <div>
              <details className="group">
                <summary className="flex cursor-pointer items-center gap-2 text-[10px] uppercase font-semibold tracking-wider text-gray-400 list-none [&::-webkit-details-marker]:hidden">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors group-open:bg-blue-light group-open:text-blue group-open:border-blue/20">
                    <ChevronRight size={12} className="transition-transform group-open:rotate-90" />
                    {job.companyInfos.activities.length} secteur{job.companyInfos.activities.length > 1 ? 's' : ''} d'activité
                  </span>
                </summary>
                <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50/50 p-3 space-y-1.5">
                  {job.companyInfos.activities.map((activity, i) => (
                    <p key={i} className="text-xs font-medium text-gray-700 flex items-start gap-2">
                      <span className="text-gray-300 mt-0.5 shrink-0">•</span>
                      {SECTOR_LABELS[activity] ?? activity}
                    </p>
                  ))}
                </div>
              </details>
            </div>
          )}
          {job.softSkills && (
            <div>
              <details className="group">
                <summary className="flex cursor-pointer items-center gap-2 text-[10px] uppercase font-semibold tracking-wider text-gray-400 list-none [&::-webkit-details-marker]:hidden">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors group-open:bg-blue-light group-open:text-blue group-open:border-blue/20">
                    <ChevronRight size={12} className="transition-transform group-open:rotate-90" />
                    Soft skills
                  </span>
                </summary>
                <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50/50 p-3 space-y-1.5">
                  {job.softSkills.split(',').map((skill, i) => (
                    <p key={i} className="text-xs font-medium text-gray-700 flex items-start gap-2">
                      <span className="text-gray-300 mt-0.5 shrink-0">•</span>
                      {skill.trim()}
                    </p>
                  ))}
                </div>
              </details>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {job.ageRange && (
          <div className="flex items-start gap-2">
            <User size={13} className="text-gray-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-400">Tranche d'âge</p>
              <p className="text-xs font-medium text-gray-800 mt-0.5">{job.ageRange} ans</p>
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

      {(job.salerInfo?.id != null || job.salerInfo?.email) && (
        <div className="mt-3 pt-3 border-t border-gray-50">
          <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-400 mb-2">
            <User size={10} className="inline mr-1 text-gray-300" />
            Commercial
          </p>
          <div className="grid grid-cols-2 gap-3">
            {job.salerInfo.email && (
              <div className="flex items-start gap-2">
                <Mail size={13} className="text-gray-300 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-400">Email commercial</p>
                  <p className="text-xs font-medium text-gray-800 mt-0.5">{job.salerInfo.email}</p>
                </div>
              </div>
            )}
            {job.salerInfo.id != null && (
              <div className="flex items-start gap-2">
                <User size={13} className="text-gray-300 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-400">ID commercial</p>
                  <p className="text-xs font-medium text-gray-800 mt-0.5">{job.salerInfo.id}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {job.referents && (
        <div className="mt-3 pt-3 border-t border-gray-50">
          <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-400 mb-2">
            <User size={10} className="inline mr-1 text-gray-300" />
            Référents
          </p>
          {job.referents.isSame
            ? (
              <ReferentBlock
                label="Référent"
                details={job.referents.legalReferents ?? job.referents.recruitmentReferents}
              />
            )
            : (
              <div className="grid grid-cols-2 gap-3">
                <ReferentBlock label="Référent légal" details={job.referents.legalReferents} />
                <ReferentBlock label="Référent recrutement" details={job.referents.recruitmentReferents} />
              </div>
            )
          }
        </div>
      )}
    </div>
  )
}

function ReferentBlock({ label, details }: { label: string; details: ReferentDetails | null | undefined }) {
  if (!details) return null
  const hasData = details.name || details.phone || details.email || details.function
  if (!hasData) return null

  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-3">
      <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-400 mb-2">{label}</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {details.name && (
          <div className="flex items-start gap-1.5">
            <User size={11} className="text-gray-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-400">Nom</p>
              <p className="text-xs font-medium text-gray-800">{details.name}</p>
            </div>
          </div>
        )}
        {details.phone && (
          <div className="flex items-start gap-1.5">
            <Phone size={11} className="text-gray-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-400">Téléphone</p>
              <p className="text-xs font-medium text-gray-800">{details.phone}</p>
            </div>
          </div>
        )}
        {details.email && (
          <div className="flex items-start gap-1.5">
            <Mail size={11} className="text-gray-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-400">Email</p>
              <p className="text-xs font-medium text-gray-800">{details.email}</p>
            </div>
          </div>
        )}
        {details.function && (
          <div className="flex items-start gap-1.5">
            <Briefcase size={11} className="text-gray-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-400">Fonction</p>
              <p className="text-xs font-medium text-gray-800">{details.function}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Preselected Candidates Section (PRE_SELECTED, PRE_SELECTED_MAIL_SEND, DECLINED) ──

function PreselectedCandidatesSection({
  candidates,
  isMailingAll,
  mailAllProgress,
  onInfo,
  onSendMail,
  onRemove,
  onMailAll,
  onAddCandidate,
}: {
  candidates: MatchedCandidate[]
  isMailingAll: boolean
  mailAllProgress: { sent: number; total: number } | null
  onInfo: (c: MatchedCandidate) => void
  onSendMail: (c: MatchedCandidate) => void
  onRemove: (c: MatchedCandidate) => void
  onMailAll: () => void
  onAddCandidate?: () => void
}) {
  const currentUser = useCurrentUser()
  const canAdd = currentUser?.permission === Permission.RESPONSABLE || currentUser?.permission === Permission.ADMIN

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <UserCheck size={15} className="text-blue" />
        <h3 className="text-sm font-semibold text-gray-800">Candidats pré-sélectionnés</h3>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue/10 text-blue">
          {candidates.length}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {canAdd && (
            <button
              onClick={onAddCandidate}
              className="flex items-center gap-1 rounded-lg border border-blue/20 px-2.5 py-1 text-xs font-medium text-blue hover:bg-blue-light transition-colors"
              title="Ajouter manuellement un candidat pré-sélectionné"
            >
              <Plus size={11} /> Ajouter un candidat
            </button>
          )}
          {candidates.length > 0 && (
            <button
              onClick={onMailAll}
              disabled={isMailingAll}
              className="flex items-center gap-1 rounded-lg border border-blue/20 px-2.5 py-1 text-xs font-medium text-blue hover:bg-blue-light transition-colors disabled:opacity-50"
            >
              {isMailingAll ? (
                <><Loader2 size={11} className="animate-spin" /> {mailAllProgress ? `${mailAllProgress.sent}/${mailAllProgress.total}` : '…'}</>
              ) : (
                <><MailCheck size={11} /> Mail à tous</>
              )}
            </button>
          )}
        </div>
      </div>

      {candidates.length === 0 ? (
        <div className="text-center py-4 px-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-400">Aucun candidat pré-sélectionné.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {candidates.map((c) => (
            <CandidateRow
              key={c.id}
              candidate={c}
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

// ─── To-Send Candidates Section (ACCEPTED, SEND) ─────────────────────────────

function ToSendCandidatesSection({
  candidates,
  onInfo,
  onSendMail,
  onRemove,
  onAddCandidate,
}: {
  candidates: MatchedCandidate[]
  onInfo: (c: MatchedCandidate) => void
  onSendMail: (c: MatchedCandidate) => void
  onRemove: (c: MatchedCandidate) => void
  onAddCandidate?: () => void
}) {
  const currentUser = useCurrentUser()
  const canAdd = currentUser?.permission === Permission.RESPONSABLE || currentUser?.permission === Permission.ADMIN

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Send size={15} className="text-purple" />
        <h3 className="text-sm font-semibold text-gray-800">Candidats à envoyer</h3>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple/10 text-purple">
          {candidates.length}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {canAdd && (
            <button
              onClick={onAddCandidate}
              className="flex items-center gap-1 rounded-lg border border-purple/20 px-2.5 py-1 text-xs font-medium text-purple hover:bg-purple/5 transition-colors"
              title="Ajouter manuellement un candidat accepté"
            >
              <Plus size={11} /> Ajouter un candidat
            </button>
          )}
        </div>
      </div>

      {candidates.length === 0 ? (
        <div className="text-center py-4 px-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-400">Aucun candidat à envoyer.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {candidates.map((c) => (
            <CandidateRow
              key={c.id}
              candidate={c}
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

// ─── Already-Sent Candidates Section (REFUSED, INTERVIEW, IMMERSING) ─────────

function AlreadySentCandidatesSection({
  candidates,
  onInfo,
  onSendDates,
  onConcludeInterview,
  onConcludeImmersion,
  onAddCandidate,
}: {
  candidates: MatchedCandidate[]
  onInfo: (c: MatchedCandidate) => void
  onSendDates: (c: MatchedCandidate) => void
  onConcludeInterview: (c: MatchedCandidate) => void
  onConcludeImmersion: (c: MatchedCandidate) => void
  onAddCandidate: () => void
}) {
  const currentUser = useCurrentUser()
  const canProposeOffers = currentUser?.permission === Permission.RESPONSABLE || currentUser?.permission === Permission.ADMIN

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Heart size={15} className="text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-800">Candidats déjà envoyés</h3>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
          {candidates.length}
        </span>
        {canProposeOffers && (
          <button
            onClick={onAddCandidate}
            className="ml-auto flex items-center gap-1 rounded-lg border border-purple/20 px-2.5 py-1 text-xs font-medium text-purple hover:bg-purple/5 transition-colors"
            title="Ajouter manuellement un candidat pour entretien ou immersion"
          >
            <Plus size={11} /> Ajouter un candidat
          </button>
        )}
      </div>

      {candidates.length === 0 ? (
        <div className="text-center py-4 px-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-400">Aucun candidat déjà envoyé.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {candidates.map((c) => {
            const needsInterviewConclusion = c.status === MatchedCandidateStatus.INTERVIEW && isInterviewDatePast(c.bookedInterviewSlot) && !c.interviewConclusion
            const needsImmersionConclusion = c.status === MatchedCandidateStatus.IMMERSING && !c.immersionConclusion
            const canSendDates = c.status === MatchedCandidateStatus.INTERVIEW && c.bookedInterviewSlot && c.interviewLocation

            return (
              <CandidateRow
                key={c.id}
                candidate={c}
                onInfo={() => onInfo(c)}
                actions={
                  <div className="flex items-center gap-1">
                    {canSendDates && (
                      <button
                        onClick={() => onSendDates(c)}
                        className="flex h-7 items-center gap-1 rounded-lg border border-purple/20 px-2 text-[11px] font-medium text-purple hover:bg-purple/5 transition-colors"
                        title="Envoyer les dates au candidat"
                      >
                        <Mail size={11} /> Dates
                      </button>
                    )}
                    {needsInterviewConclusion && (
                      <button
                        onClick={() => onConcludeInterview(c)}
                        className="flex h-7 items-center gap-1 rounded-lg border border-blue/20 px-2 text-[11px] font-medium text-blue hover:bg-blue/5 transition-colors"
                      >
                        <CalendarClock size={11} /> Conclure entretien
                      </button>
                    )}
                    {needsImmersionConclusion && (
                      <button
                        onClick={() => onConcludeImmersion(c)}
                        className="flex h-7 items-center gap-1 rounded-lg border border-blue/20 px-2 text-[11px] font-medium text-blue hover:bg-blue/5 transition-colors"
                      >
                        <CalendarClock size={11} /> Conclure immersion
                      </button>
                    )}
                  </div>
                }
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Matching Section ─────────────────────────────────────────────────────────

function buildOfferMailBody(
  candidateName: string,
  job: MatchJobResult,
  ouiUrl: string,
  nonUrl: string,
): string {
  const name = candidateName?.split(' ')[0] ?? 'Candidat'
  const segments: string[] = []

  if (job.sector && job.sector !== 'NONE') {
    segments.push(`<div class="field"><div class="field-label">Secteur</div><div class="field-value">${formatEnumLabel(job.sector)}</div></div>`)
  }
  if (job.localisation && job.localisation.length > 0) {
    const locs = job.localisation
      .map((l) => LOCALISATION_LABELS[l as keyof typeof LOCALISATION_LABELS] ?? l)
      .filter(Boolean)
      .join(', ')
    if (locs) {
      segments.push(`<div class="field"><div class="field-label">Localisation</div><div class="field-value">${locs}</div></div>`)
    }
  }
  if (job.missions && job.missions.length > 0) {
    const items = job.missions.map((m) => `<li>${m}</li>`).join('')
    segments.push(`<div class="field"><div class="field-label">Missions</div><ul class="mission-list">${items}</ul></div>`)
  }
  if (job.companyInfos?.activities && job.companyInfos.activities.length > 0) {
    const tags = job.companyInfos.activities.map((a) => `<span class="activity-tag">${SECTOR_LABELS[a] ?? a}</span>`).join(' ')
    segments.push(`<div class="field"><div class="field-label">Activités de l'entreprise</div><div>${tags}</div></div>`)
  }
  const offerCard = segments.length > 0
    ? `<div class="offer-card">${segments.join('')}</div>`
    : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 20px; color: #1f2937; }
  .logo { color: #60207E; font-weight: 800; font-size: 20px; margin-bottom: 28px; letter-spacing: -0.5px; }
  p { line-height: 1.6; margin: 0 0 16px; }
  .offer-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin: 16px 0; }
  .field { margin-bottom: 10px; }
  .field-label { font-size: 10px; text-transform: uppercase; font-weight: 600; color: #9ca3af; letter-spacing: 0.5px; }
  .field-value { font-size: 13px; font-weight: 600; color: #1f2937; margin-top: 2px; }
  .mission-list { list-style: none; padding: 0; margin: 4px 0 0; }
  .mission-list li { padding: 3px 0; font-size: 13px; color: #374151; position: relative; padding-left: 16px; }
  .mission-list li::before { content: "•"; position: absolute; left: 0; color: #60207E; }
  .activity-tag { display: inline-block; background: #f3e8ff; color: #60207E; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; margin: 2px; }
  .question { font-size: 17px; font-weight: 700; margin: 28px 0 24px; }
  .buttons { display: flex; gap: 12px; margin: 28px 0; }
  .btn { display: inline-block; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px; }
  .btn-oui { background: #60207E; color: #ffffff; }
  .btn-non { background: #f3f4f6; color: #374151; }
  .benefits { background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 16px; margin: 20px 0; }
  .benefits h4 { color: #60207E; font-size: 14px; margin: 0 0 8px; }
  .benefits ul { margin: 0; padding-left: 20px; }
  .benefits li { font-size: 13px; color: #374151; margin-bottom: 4px; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px; }
</style>
</head>
<body>
  <div class="logo">DISCIPLINA</div>
  <p>Bonjour ${name},</p>
  <p>Nous avons sélectionné pour vous une offre en alternance qui correspond à votre profil :</p>
  ${offerCard}
  <div class="benefits">
    <h4>Pourquoi postuler ?</h4>
    <ul>
      <li>Une formation en alternance rémunérée</li>
      <li>Une expérience professionnelle enrichissante</li>
      <li>Un accompagnement personnalisé tout au long de votre parcours</li>
      <li>Un diplôme reconnu à la clé</li>
    </ul>
  </div>
  <p class="question">Souhaitez-vous postuler à cette offre ?</p>
  <div class="buttons">
    <a href="${ouiUrl}" class="btn btn-oui">✓ &nbsp;Oui, je suis intéressé(e)</a>
    <a href="${nonUrl}" class="btn btn-non">✗ &nbsp;Non, merci</a>
  </div>
  <p>Un simple clic suffit. Notre équipe vous recontactera rapidement pour la suite du processus.</p>
  <div class="footer">
    Cordialement,<br>
    L'équipe DISCIPLINA<br>
    <small style="color:#9ca3af;">Cet email a été envoyé automatiquement. Merci de ne pas y répondre.</small>
  </div>
</body>
</html>`
}

function buildInterviewMailBody(candidateName: string, bookedInterviewSlot: string, interviewLocation: string): string {
  const name = candidateName?.split(' ')[0] ?? 'Candidat'
  const dateFormatted = new Date(bookedInterviewSlot).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false })
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 20px; color: #1f2937; }
  .logo { color: #60207E; font-weight: 800; font-size: 20px; margin-bottom: 28px; }
  p { line-height: 1.6; margin: 0 0 16px; }
  .details { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin: 16px 0; }
  .details strong { color: #374151; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px; }
</style>
</head>
<body>
  <div class="logo">DISCIPLINA</div>
  <p>Bonjour ${name},</p>
  <p>Nous avons le plaisir de vous convier à un entretien dans le cadre de votre candidature.</p>
  <div class="details">
    <p><strong>Date :</strong> ${dateFormatted}</p>
    <p><strong>Lieu :</strong> ${interviewLocation}</p>
  </div>
  <p>Merci de confirmer votre présence par retour de mail. Nous vous souhaitons bonne chance pour cet entretien !</p>
  <div class="footer">
    Cordialement,<br>
    L'équipe DISCIPLINA<br>
    <small style="color:#9ca3af;">Cet email a été envoyé automatiquement. Merci de ne pas y répondre.</small>
  </div>
</body>
</html>`
}

function buildImmersionMailBody(candidateName: string, startDate: string, endDate: string, location: string): string {
  const name = candidateName?.split(' ')[0] ?? 'Candidat'
  const startFormatted = new Date(startDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const endFormatted = new Date(endDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 20px; color: #1f2937; }
  .logo { color: #60207E; font-weight: 800; font-size: 20px; margin-bottom: 28px; }
  p { line-height: 1.6; margin: 0 0 16px; }
  .details { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin: 16px 0; }
  .details strong { color: #374151; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px; }
</style>
</head>
<body>
  <div class="logo">DISCIPLINA</div>
  <p>Bonjour ${name},</p>
  <p>Nous avons le plaisir de vous proposer une immersion dans le cadre de votre candidature.</p>
  <div class="details">
    <p><strong>Date de début :</strong> ${startFormatted}</p>
    <p><strong>Date de fin :</strong> ${endFormatted}</p>
    <p><strong>Lieu :</strong> ${location}</p>
  </div>
  <p>Merci de confirmer votre disponibilité par retour de mail. Nous vous souhaitons une excellente immersion !</p>
  <div class="footer">
    Cordialement,<br>
    L'équipe DISCIPLINA<br>
    <small style="color:#9ca3af;">Cet email a été envoyé automatiquement. Merci de ne pas y répondre.</small>
  </div>
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
  return new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
}



function RightPanel({ selectedJob, currentUser }: { selectedJob: Job | null; currentUser: import('@/store/authStore').AppUser | null }) {
  const [jobData, setJobData] = useState<MatchJobResult | null>(null)
  const [showCompanyInfo, setShowCompanyInfo] = useState(false)
  const [suggestedCandidates, setSuggestedCandidates] = useState<MatchedCandidate[]>([])
  const [savedCandidateIds, setSavedCandidateIds] = useState<Set<string>>(new Set())
  const [decisions, setDecisions] = useState<Record<string, CandidateDecision>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isMatching, setIsMatching] = useState(false)
  const [isMailingAll, setIsMailingAll] = useState(false)
  const [mailAllProgress, setMailAllProgress] = useState<{ sent: number; total: number } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [matchError, setMatchError] = useState<string | null>(null)
  const [hasLaunched, setHasLaunched] = useState(false)
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())
  const [drawerCandidate, setDrawerCandidate] = useState<MatchedCandidate | null>(null)
  const [mailState, setMailState] = useState<{ candidate: MatchedCandidate; ouiUrl: string; nonUrl: string } | null>(null)
  const [datesMailState, setDatesMailState] = useState<MatchedCandidate | null>(null)
  const [notifyMailState, setNotifyMailState] = useState<{
    email: string
    candidateName: string
    type: 'interview' | 'immersion'
    interviewLocation?: string
    bookedInterviewSlot?: string
    immersionStartDate?: string
    immersionEndDate?: string
  } | null>(null)
  const [interviewModalOpen, setInterviewModalOpen] = useState(false)
  const [addPreselectedOpen, setAddPreselectedOpen] = useState(false)
  const [addAcceptedOpen, setAddAcceptedOpen] = useState(false)
  const [conclusionCandidate, setConclusionCandidate] = useState<MatchedCandidate | null>(null)
  const [immersionConclusionCandidate, setImmersionConclusionCandidate] = useState<MatchedCandidate | null>(null)
  const [abEditOpen, setAbEditOpen] = useState(false)
  const [abNeedsAnalysisId, setAbNeedsAnalysisId] = useState<string | null>(null)
  const needsAnalysisResult = useNeedsAnalysis(abNeedsAnalysisId)
  const needsAnalysisData = needsAnalysisResult.data?.needsAnalysis
  const { result: abCompanyResult, searchBySiret: searchAbCompanyBySiret } = useCompanyBySiret()
  const abCompany = abCompanyResult.data?.companyBySiret

  const interviewLocationNeedsAnalysis = useNeedsAnalysis(selectedJob?.needsAnalysisId ?? null)
  const interviewDefaultLocation =
    interviewLocationNeedsAnalysis.data?.needsAnalysis?.companyInfos?.commune ||
    (interviewLocationNeedsAnalysis.data?.needsAnalysis?.companyInfos?.postalCode
      ? `Commune ${interviewLocationNeedsAnalysis.data.needsAnalysis.companyInfos.postalCode}`
      : '')

  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    if (abEditOpen && needsAnalysisData?.companyInfos?.siret) {
      searchAbCompanyBySiret(needsAnalysisData.companyInfos.siret)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abEditOpen, needsAnalysisData?.companyInfos?.siret])

  const preselectedStatuses: MatchedCandidateStatus[] = [
    MatchedCandidateStatus.PRE_SELECTED,
    MatchedCandidateStatus.PRE_SELECTED_MAIL_SEND,
    MatchedCandidateStatus.DECLINED,
  ]
  const toSendStatuses: MatchedCandidateStatus[] = [
    MatchedCandidateStatus.ACCEPTED,
    MatchedCandidateStatus.SEND,
  ]
  const alreadySentStatuses: MatchedCandidateStatus[] = [
    MatchedCandidateStatus.REFUSED,
    MatchedCandidateStatus.INTERVIEW,
    MatchedCandidateStatus.IMMERSING,
  ]

  function filterByStatus(candidates: MatchedCandidate[], statuses: MatchedCandidateStatus[]) {
    return (candidates ?? []).filter((c) => c.status && statuses.includes(c.status as MatchedCandidateStatus))
  }

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
      const result = await offerGraphqlClient.query(MATCH_OFFER, { id: job.id }).toPromise()
      if (result.error) { setLoadError(result.error.message); return }
      if (result.data?.matchOffer) {
        const data = result.data.matchOffer as MatchJobResult
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
      const result = await offerGraphqlClient.query(MATCH_OFFER, { id: job.id }).toPromise()
      if (result.error) { setMatchError(result.error.message); return }
      if (result.data?.matchOffer) {
        const data = result.data.matchOffer as MatchJobResult
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
      const result = await offerGraphqlClient.mutation(ADD_CANDIDATE_TO_OFFER, { offerId: selectedJob.id, candidateId }).toPromise()
      if (!result.error) {
        setSavedCandidateIds((p) => new Set(p).add(candidateId))
        setSuggestedCandidates((p) => p.filter((c) => c.id !== candidateId))
        if (result.data?.addCandidateToOffer?.matchedCandidate && jobData) {
          setJobData({ ...jobData, matchedCandidate: result.data.addCandidateToOffer.matchedCandidate })
        }
      }
    } finally {
      setSavingIds((p) => { const n = new Set(p); n.delete(candidateId); return n })
    }
  }

  const handleRemoveCandidate = async (candidate: MatchedCandidate) => {
    if (!selectedJob) return
    const result = await offerGraphqlClient.mutation(REMOVE_CANDIDATE_FROM_OFFER, { offerId: selectedJob.id, candidateId: candidate.id }).toPromise()
    if (!result.error && jobData) {
      const updated = result.data?.removeCandidateFromOffer
      setJobData({ ...jobData, matchedCandidate: updated?.matchedCandidate ?? [], status: updated?.status ?? jobData.status })
      setSavedCandidateIds((p) => { const n = new Set(p); n.delete(candidate.id); return n })
    }
  }

  const handleMailAll = async () => {
    if (!selectedJob || !jobData) return
    const preselected = filterByStatus(jobData.matchedCandidate, preselectedStatuses)
    if (preselected.length === 0) return

    setIsMailingAll(true)
    setMailAllProgress({ sent: 0, total: preselected.length })

    const sentIds = new Set<string>()

    for (let i = 0; i < preselected.length; i++) {
      const candidate = preselected[i]
      try {
        const linksResult = await offerGraphqlClient.query(OFFER_RESPONSE_LINKS, { offerId: selectedJob.id, candidateId: candidate.id }).toPromise()
        if (linksResult.data?.offerResponseLinks) {
          const { ouiUrl, nonUrl } = linksResult.data.offerResponseLinks
          const subject = `DISCIPLINA – Offre en alternance`
          const body = buildOfferMailBody(candidate.fullName, jobData, ouiUrl, nonUrl)
          await fetch(`${import.meta.env.VITE_API_URL}/api/email/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ to: candidate.email, subject, body }),
          })
          await offerGraphqlClient.mutation(UPDATE_MATCHED_CANDIDATE_STATUS, { offerId: selectedJob.id, candidateId: candidate.id, status: MatchedCandidateStatus.PRE_SELECTED_MAIL_SEND }).toPromise()
          sentIds.add(candidate.id)
        }
      } catch {
        // continue with next candidate on error
      }
      setMailAllProgress({ sent: i + 1, total: preselected.length })
    }

    if (jobData) {
      setJobData({
        ...jobData,
        matchedCandidate: (jobData.matchedCandidate ?? []).map((c) =>
          sentIds.has(c.id) ? { ...c, status: MatchedCandidateStatus.PRE_SELECTED_MAIL_SEND } : c
        ),
      })
    }
    setIsMailingAll(false)
    setMailAllProgress(null)
  }

  const handleOpenMail = async (candidate: MatchedCandidate) => {
    if (!selectedJob) return

    const result = await offerGraphqlClient.query(OFFER_RESPONSE_LINKS, { offerId: selectedJob.id, candidateId: candidate.id }).toPromise()
    if (result.data?.offerResponseLinks) {
      const { ouiUrl, nonUrl } = result.data.offerResponseLinks
      setMailState({ candidate, ouiUrl, nonUrl })
    }
  }

  const handleMailSent = async (candidate: MatchedCandidate) => {
    if (!selectedJob) return
    await offerGraphqlClient.mutation(UPDATE_MATCHED_CANDIDATE_STATUS, { offerId: selectedJob.id, candidateId: candidate.id, status: MatchedCandidateStatus.PRE_SELECTED_MAIL_SEND }).toPromise()
    if (jobData) {
      setJobData({
        ...jobData,
        matchedCandidate: (jobData.matchedCandidate ?? []).map((c) =>
          c.id === candidate.id ? { ...c, status: MatchedCandidateStatus.PRE_SELECTED_MAIL_SEND } : c
        ),
      })
    }
  }

  const handleSendInterviewDates = (candidate: MatchedCandidate) => {
    setDatesMailState(candidate)
  }

  const handleAddManualProposedCandidate = async (candidateId: string, location: string, dateOrStartDate: string, hourOrEndDate: string, type: 'interview' | 'immersion', email: string, candidateName: string) => {
    if (!selectedJob || !jobData) return
    try {
      if (type === 'interview') {
        const result = await offerGraphqlClient
          .mutation(ADD_MANUAL_PROPOSED_CANDIDATE, {
            offerId: selectedJob.id,
            candidateId,
            interviewDate: dateOrStartDate,
            interviewHour: hourOrEndDate,
            interviewLocation: location,
          })
          .toPromise()
        if (result.error) throw new Error(result.error.message)

        setNotifyMailState({
          email,
          candidateName,
          type: 'interview',
          interviewLocation: location,
          bookedInterviewSlot: new Date(`${dateOrStartDate}T${hourOrEndDate}`).toISOString(),
        })
      } else {
        const result = await offerGraphqlClient
          .mutation(ADD_MANUAL_PROPOSED_CANDIDATE_FOR_IMMERSION, {
            offerId: selectedJob.id,
            candidateId,
            immersionStartDate: dateOrStartDate,
            immersionEndDate: hourOrEndDate,
            immersionLocation: location,
          })
          .toPromise()
        if (result.error) throw new Error(result.error.message)

        setNotifyMailState({
          email,
          candidateName,
          type: 'immersion',
          immersionStartDate: dateOrStartDate,
          immersionEndDate: hourOrEndDate,
          interviewLocation: location,
        })
      }

      setInterviewModalOpen(false)
    } catch (error) {
      console.error('Erreur lors de l\'ajout du candidat proposé:', error)
    }
  }

  const handleSetInterviewConclusion = async (
    conclusion: InterviewConclusion,
    immersionStartDate?: string,
    immersionEndDate?: string,
  ) => {
    if (!selectedJob || !jobData || !conclusionCandidate) return
    try {
      const result = await offerGraphqlClient
        .mutation(SET_INTERVIEW_CONCLUSION, {
          offerId: selectedJob.id,
          candidateId: conclusionCandidate.id,
          conclusion,
          immersionStartDate,
          immersionEndDate,
        })
        .toPromise()
      if (result.error) throw new Error(result.error.message)

      setConclusionCandidate(null)
      if (selectedJob) loadJobData(selectedJob)
    } catch (error) {
      console.error('Erreur lors de la conclusion de l\'entretien:', error)
    }
  }

  const handleSetImmersionConclusion = async (conclusion: ImmersionConclusion) => {
    if (!selectedJob || !jobData || !immersionConclusionCandidate) return
    try {
      const result = await offerGraphqlClient
        .mutation(SET_IMMERSION_CONCLUSION, {
          offerId: selectedJob.id,
          candidateId: immersionConclusionCandidate.id,
          conclusion,
        })
        .toPromise()
      if (result.error) throw new Error(result.error.message)

      setImmersionConclusionCandidate(null)
      if (selectedJob) loadJobData(selectedJob)
    } catch (error) {
      console.error("Erreur lors de la conclusion de l'immersion:", error)
    }
  }

  const handleAddPreselectedCandidate = async (candidateId: string, _candidateName: string, hasAccepted: boolean) => {
    if (!selectedJob) return
    try {
      const result = await offerGraphqlClient
        .mutation(ADD_CANDIDATE_TO_OFFER, { offerId: selectedJob.id, candidateId })
        .toPromise()
      if (result.error) throw new Error(result.error.message)

      if (hasAccepted) {
        await offerGraphqlClient
          .mutation(UPDATE_MATCHED_CANDIDATE_STATUS, {
            offerId: selectedJob.id,
            candidateId,
            status: MatchedCandidateStatus.PRE_SELECTED_MAIL_SEND,
          })
          .toPromise()
      }

      if (selectedJob) loadJobData(selectedJob)
    } catch (error) {
      console.error("Erreur lors de l'ajout du candidat pré-sélectionné:", error)
    }
    setAddPreselectedOpen(false)
  }

  const handleAddAcceptedCandidate = async (candidateId: string, _candidateName: string) => {
    if (!selectedJob) return
    try {
      const result = await offerGraphqlClient
        .mutation(ADD_CANDIDATE_TO_OFFER, { offerId: selectedJob.id, candidateId })
        .toPromise()
      if (result.error) throw new Error(result.error.message)

      await offerGraphqlClient
        .mutation(UPDATE_MATCHED_CANDIDATE_STATUS, {
          offerId: selectedJob.id,
          candidateId,
          status: MatchedCandidateStatus.ACCEPTED,
        })
        .toPromise()

      if (selectedJob) loadJobData(selectedJob)
    } catch (error) {
      console.error("Erreur lors de l'ajout du candidat accepté:", error)
    }
    setAddAcceptedOpen(false)
  }

  const handleSetManualStatus = async (status: OfferStatus) => {
    if (!selectedJob) return
    const result = await offerGraphqlClient.mutation(UPDATE_OFFER, { id: selectedJob.id, offer: { id: selectedJob.id, status } }).toPromise()
    if (!result.error && jobData) {
      setJobData({ ...jobData, status })
    }
  }

  const handleEditAb = () => {
    if (!selectedJob?.needsAnalysisId) return
    setAbNeedsAnalysisId(selectedJob.needsAnalysisId)
    setAbEditOpen(true)
  }

  const handleAbEditClose = () => {
    setAbEditOpen(false)
    setAbNeedsAnalysisId(null)
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

  const preselectedCandidates = filterByStatus(jobData.matchedCandidate, preselectedStatuses)
  const toSendCandidates = filterByStatus(jobData.matchedCandidate, toSendStatuses)
  const alreadySentCandidates = filterByStatus(jobData.matchedCandidate, alreadySentStatuses)

  return (
    <div className="flex flex-col gap-4 pb-6">
      <JobDetailsSection
        job={jobData}
        onSetStatus={handleSetManualStatus}
        hasAcceptedCandidates={false}
        isCreatingSession={false}
        onProposeCandidates={() => {}}
        onShowCompanyInfo={() => setShowCompanyInfo(true)}
        onEditAb={
          selectedJob?.needsAnalysisId && (currentUser?.permission === Permission.RESPONSABLE || currentUser?.permission === Permission.ADMIN)
            ? handleEditAb
            : undefined
        }
      />

      {showCompanyInfo && selectedJob && (
        <CompanyInfoModal offerId={selectedJob.id} needsAnalysisId={selectedJob.needsAnalysisId} onClose={() => setShowCompanyInfo(false)} />
      )}

      <PreselectedCandidatesSection
        candidates={preselectedCandidates}
        isMailingAll={isMailingAll}
        mailAllProgress={mailAllProgress}
        onInfo={setDrawerCandidate}
        onSendMail={handleOpenMail}
        onRemove={handleRemoveCandidate}
        onMailAll={handleMailAll}
        onAddCandidate={() => setAddPreselectedOpen(true)}
      />

      <ToSendCandidatesSection
        candidates={toSendCandidates}
        onInfo={setDrawerCandidate}
        onSendMail={handleOpenMail}
        onRemove={handleRemoveCandidate}
        onAddCandidate={() => setAddAcceptedOpen(true)}
      />

      <AlreadySentCandidatesSection
        candidates={alreadySentCandidates}
        onInfo={setDrawerCandidate}
        onSendDates={handleSendInterviewDates}
        onConcludeInterview={setConclusionCandidate}
        onConcludeImmersion={setImmersionConclusionCandidate}
        onAddCandidate={() => setInterviewModalOpen(true)}
      />

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
          defaultBody={buildOfferMailBody(mailState.candidate.fullName, jobData, mailState.ouiUrl, mailState.nonUrl)}
          scope="rh"
          onClose={() => setMailState(null)}
          onSent={() => handleMailSent(mailState.candidate)}
        />
      )}

      {datesMailState && (
        <MailModal
          defaultTo={datesMailState.email}
          candidateName={datesMailState.fullName}
          defaultSubject="DISCIPLINA – Convocation à un entretien"
          defaultBody={
            datesMailState.bookedInterviewSlot && datesMailState.interviewLocation
              ? buildInterviewMailBody(
                datesMailState.fullName,
                datesMailState.bookedInterviewSlot,
                datesMailState.interviewLocation,
              )
              : ''
          }
          scope="rh"
          onClose={() => setDatesMailState(null)}
        />
      )}

      {notifyMailState && (
        <MailModal
          defaultTo={notifyMailState.email}
          candidateName={notifyMailState.candidateName}
          defaultSubject={
            notifyMailState.type === 'interview'
              ? 'DISCIPLINA – Convocation à un entretien'
              : 'DISCIPLINA – Proposition d\'immersion'
          }
          defaultBody={
            notifyMailState.type === 'interview'
              ? buildInterviewMailBody(
                  notifyMailState.candidateName,
                  notifyMailState.bookedInterviewSlot ?? '',
                  notifyMailState.interviewLocation ?? '',
                )
              : buildImmersionMailBody(
                  notifyMailState.candidateName,
                  notifyMailState.immersionStartDate ?? '',
                  notifyMailState.immersionEndDate ?? '',
                  notifyMailState.interviewLocation ?? '',
                )
          }
          scope="rh"
          onClose={() => {
            setNotifyMailState(null)
            if (selectedJob) loadJobData(selectedJob)
          }}
          onSent={() => {
            setNotifyMailState(null)
            if (selectedJob) loadJobData(selectedJob)
          }}
        />
      )}

      {addPreselectedOpen && (
        <AddPreselectedCandidateModal
          job={jobData}
          onSubmit={handleAddPreselectedCandidate}
          onClose={() => setAddPreselectedOpen(false)}
        />
      )}

      {addAcceptedOpen && (
        <AddAcceptedCandidateModal
          job={jobData}
          onSubmit={handleAddAcceptedCandidate}
          onClose={() => setAddAcceptedOpen(false)}
        />
      )}

      {interviewModalOpen && (
        <InterviewModal
          job={jobData}
          defaultLocation={interviewDefaultLocation}
          onSubmit={handleAddManualProposedCandidate}
          onClose={() => setInterviewModalOpen(false)}
        />
      )}

      {conclusionCandidate && (
        <InterviewConclusionModal
          candidateName={conclusionCandidate.fullName}
          onSubmit={handleSetInterviewConclusion}
          onClose={() => setConclusionCandidate(null)}
        />
      )}
      {immersionConclusionCandidate && (
        <ImmersionConclusionModal
          candidateName={immersionConclusionCandidate.fullName}
          immersionStartDate={immersionConclusionCandidate.immersionStartDate ?? undefined}
          immersionEndDate={immersionConclusionCandidate.immersionEndDate ?? undefined}
          onSubmit={handleSetImmersionConclusion}
          onClose={() => setImmersionConclusionCandidate(null)}
        />
      )}

      {abEditOpen && needsAnalysisData && selectedJob && (
        <NeedsAnalysisModal
          entreprise={{
            // Fusionne la fiche entreprise réelle (siret/adresse/légal, si trouvée) avec
            // les infos de l'analyse du besoin — champ par champ, l'un comblant les trous de l'autre.
            id: String(abCompany?.id ?? selectedJob.companyInfos?.id ?? ''),
            nom_commercial: abCompany?.name ?? selectedJob.companyName ?? null,
            proprietaire_contact: null,
            commercial: null,
            proprietaire_id: abCompany?.userID ?? null,
            representant_legal: abCompany?.legalReferent ?? needsAnalysisData.referents?.legalReferents?.name ?? null,
            telephone: abCompany?.phone ?? needsAnalysisData.referents?.legalReferents?.phone ?? null,
            email: abCompany?.email ?? needsAnalysisData.referents?.legalReferents?.email ?? null,
            adresse: abCompany?.address ?? null,
            secteur: abCompany?.sector ?? needsAnalysisData.companyInfos?.activities?.join(', ') ?? null,
            metier: abCompany?.mainActivity ?? null,
            siret: abCompany?.siret ?? needsAnalysisData.companyInfos?.siret ?? null,
            idcc: abCompany?.idcc ?? needsAnalysisData.companyInfos?.idcc ?? null,
            note: abCompany?.notes ?? needsAnalysisData.companyInfos?.description ?? null,
            conclusion: abCompany?.conclusion ?? null,
            status: (abCompany?.status as Entreprise['status']) || (needsAnalysisData.status as Entreprise['status']) || 'À Réfléchir',
            date_insertion: null,
            date_relance: null,
            type_relance: null,
            relance_template_id: null,
            relance_channel: null,
          }}
          currentUser={currentUser!}
          initialData={needsAnalysisData}
          onClose={handleAbEditClose}
          onSuccess={() => {
            handleAbEditClose()
            if (selectedJob) loadJobData(selectedJob)
          }}
        />
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Matching() {
  const [searchParams] = useSearchParams()
  const currentUser = useCurrentUser()
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [filters, setFilters] = useState<JobFiltersType>(EMPTY_JOB_FILTERS)

  const token = useAuthStore((s) => s.token)
  const [jobsResult] = useQuery({
    query: GET_OFFERS,
    context: {
      url: `${import.meta.env.VITE_API_URL}/api/graphql/offers`,
      fetchOptions: { headers: { Authorization: `Bearer ${token}` } },
    },
  })

  const jobs: Job[] = jobsResult.data?.offers ?? []
  const filteredJobs = applyJobFilters(jobs, filters)
  // ?offer= (lien de notification) sert d'offre présélectionnée tant qu'aucune sélection manuelle
  const effectiveJobId = selectedJobId ?? searchParams.get('offer')
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
        <JobFilters filters={filters} onChange={setFilters} />
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
          <RightPanel selectedJob={selectedJob} currentUser={currentUser} />
        </div>
      </div>
    </div>
  )
}

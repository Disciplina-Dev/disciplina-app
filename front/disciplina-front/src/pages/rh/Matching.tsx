import { useState, useCallback, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { IconAlert, IconArrowLeft, IconCar, IconCheck, IconChevronRight, IconClose, IconCompany, IconEye, IconFavorite, IconInfo, IconJob, IconLoader, IconMail, IconMailSent, IconMapPin, IconPhone, IconPlay, IconPlus, IconRefresh, IconSchedule, IconSend, IconSparkles, IconTrash, IconUser, IconUserCheck, IconUserRemove, IconUsers } from '@/components/ui/icons'
import { MATCH_OFFER, ADD_CANDIDATE_TO_OFFER, ADD_MANUAL_PROPOSED_CANDIDATE, ADD_MANUAL_PROPOSED_CANDIDATE_FOR_IMMERSION, SET_INTERVIEW_CONCLUSION, SET_IMMERSION_CONCLUSION, OFFER_RESPONSE_LINKS, UPDATE_OFFER, REMOVE_CANDIDATE_FROM_OFFER, UPDATE_MATCHED_CANDIDATE_STATUS, DELETE_OFFER, DELETE_OFFERS_BY_NEEDS_ANALYSIS, OFFERS_BY_NEEDS_ANALYSIS, BLACKLIST_AND_CLEANUP_COMPANY, CREATE_MATCH_SESSION } from '@/graphql/queries'
import { MATCHED_CANDIDATE_STATUS_LABELS, MATCHED_CANDIDATE_STATUS_BADGE_CLASS, MatchedCandidateStatus } from '@/constants/matchedCandidateStatus'
import { INTERVIEW_CONCLUSION_LABELS, INTERVIEW_CONCLUSION_BADGE_CLASS, InterviewConclusion } from '@/constants/interviewConclusion'
import { IMMERSION_CONCLUSION_LABELS, IMMERSION_CONCLUSION_BADGE_CLASS, ImmersionConclusion } from '@/constants/immersionConclusion'
import { JOB_STATUS_LABELS, JOB_STATUS_BADGE_CLASS } from '@/constants/jobStatus'
import { OfferStatus, formatEnumLabel } from '@/features/matching/constants/jobEnums'
import { offerGraphqlClient, graphqlClient } from '@/graphql/client'
import { useQuery } from 'urql'
import { useCurrentUser, Permission } from '@/store/authStore'
import { apiFetch } from '@/api/httpClient'
import MailModal from '@/components/ui/MailModal'
import InterviewModal from '@/features/matching/components/InterviewModal'
import AddPreselectedCandidateModal from '@/features/matching/components/AddPreselectedCandidateModal'
import AddAcceptedCandidateModal from '@/features/matching/components/AddAcceptedCandidateModal'
import CompanyInfoModal from '@/features/matching/components/CompanyInfoModal'
import InterviewConclusionModal from '@/features/matching/components/InterviewConclusionModal'
import ImmersionConclusionModal from '@/features/matching/components/ImmersionConclusionModal'
import SendToCompanyModal from '@/features/matching/components/SendToCompanyModal'
import HistoryModal from '@/features/matching/components/HistoryModal'
import { isInterviewDatePast } from '@/utils/interview'
import { EditNeedsAnalysisButton } from '@/features/abEntreprise/components/EditNeedsAnalysisButton'
import ABDetailModal from '@/features/abEntreprise/components/ABDetailModal'
import { useNeedsAnalysis, useDeleteNeedsAnalysis, useUpdateNeedsAnalysisAbStatus } from '@/graphql/hooks'
import { LOCALISATION_LABELS } from '@/data/reunionCommunes'
import { SECTOR_LABELS } from '@/data/sectors'
import { formatScheduleSlots } from '@/utils/schedule'
import TruncatedText from '@/components/ui/TruncatedText'

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
  identityDescription?: string | null
  comment?: string | null
  cvWebview?: string | null
  hasCv?: boolean
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

interface OfferTp {
  tpType: string | null
  missions: string[]
  descriptionMissions: string[]
  otherDescriptionMissions?: string | null
  otherMissions?: string | null
}

interface ScheduleSlot {
  day?: string | null
  startHour?: string | null
  endHour?: string | null
}

interface Job {
  id: string
  needsAnalysisId?: string | null
  companyInfos?: { id?: number; name?: string; address?: string | null; email?: string | null; activities?: string[] | null } | null
  softSkills?: string | null
  schedule?: (ScheduleSlot | string)[] | null
  companyName: string
  ageRange: string
  desiredTp: OfferTp[]
  desiredSex: string | null
  drivingLicencseB: boolean | null
  hasVehicle: boolean | null
  professionalExperience: boolean | null
  status: string | null
  localisation: string[] | null
  sector: string | null
  salerInfo?: SalerInfo | null
  referents?: Referents | null
  title?: string | null
  jobRole?: string | null
  relaxedCriteria?: string[] | null
}

interface MatchJobResult extends Job {
  matchedCandidate: MatchedCandidate[]
  suggestedCandidates: MatchedCandidate[]
  interviewSlots?: string[] | null
  interviewLocation?: string | null
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
  if (!status) return { label: '—', cls: 'bg-[var(--ds-surface-sunken)] text-[var(--ds-text-muted)]' }
  const jobStatus = status as OfferStatus
  return JOB_STATUS_LABELS[jobStatus]
    ? { label: JOB_STATUS_LABELS[jobStatus], cls: JOB_STATUS_BADGE_CLASS[jobStatus] }
    : { label: formatEnum(status), cls: 'bg-[var(--ds-surface-sunken)] text-[var(--ds-text-muted)]' }
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
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-sm overflow-y-auto bg-[var(--ds-surface)] shadow-2xl flex flex-col">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[var(--ds-border)] bg-[var(--ds-surface)] px-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--ds-text)] truncate">{candidate.fullName}</p>
            <p className="text-xs text-[var(--ds-text-subtle)] mt-0.5">Fiche candidat</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--ds-text-subtle)] hover:bg-[var(--ds-surface-sunken)] hover:text-[var(--ds-text-muted)] transition-colors"
          >
            <IconClose width={16} height={16} />
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
            <div key={i} className="flex items-start justify-between gap-3 border-b border-[var(--ds-border)] py-3 last:border-b-0">
              <span className="text-xs text-[var(--ds-text-subtle)] shrink-0 min-w-[110px]">{row.label}</span>
              <span className="text-xs font-medium text-[var(--ds-text)] text-right break-words">
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
  interviewSlots,
  interviewLocation,
}: {
  candidate: MatchedCandidate
  onInfo: () => void
  onSendMail?: () => void
  onRemove?: () => void
  actions?: React.ReactNode
  interviewSlots?: string[] | null
  interviewLocation?: string | null
}) {
  return (
    <div className="rounded-lg border border-[var(--ds-border)] p-3">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-sm font-semibold text-[var(--ds-text)]">{candidate.fullName}</p>
        {candidate.status && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${MATCHED_CANDIDATE_STATUS_BADGE_CLASS[candidate.status as MatchedCandidateStatus] ?? 'bg-[var(--ds-surface-sunken)] text-[var(--ds-text-muted)]'}`}>
            {MATCHED_CANDIDATE_STATUS_LABELS[candidate.status as MatchedCandidateStatus] ?? candidate.status}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-3 mb-2">
        {candidate.email && (
          <span className="flex items-center gap-1 text-xs text-[var(--ds-text-subtle)]">
            <IconMail width={10} height={10} className="text-[var(--ds-text-subtle)]" /> {candidate.email}
          </span>
        )}
        {candidate.city && (
          <span className="flex items-center gap-1 text-xs text-[var(--ds-text-subtle)]">
            <IconMapPin width={10} height={10} className="text-[var(--ds-text-subtle)]" /> {formatEnum(candidate.city)}
          </span>
        )}
        {candidate.age && (
          <span className="text-xs text-[var(--ds-text-subtle)]">{candidate.age} ans</span>
        )}
      </div>

      {candidate.status === MatchedCandidateStatus.REFUSED && candidate.comment && (
        <p className="mb-2 rounded-md bg-[var(--ds-surface-sunken)] px-2 py-1 text-[11px] text-[var(--ds-text-muted)]">
          Motif du refus : {candidate.comment}
        </p>
      )}

      {candidate.bookedInterviewSlot && (
        <div className="mb-2 rounded-md bg-[var(--ds-success-bg)] px-2 py-1 text-[11px] text-[var(--ds-text-muted)] border border-[var(--ds-border)]">
          <p><IconSchedule width={11} height={11} className="inline mr-1" /> {formatSlot(candidate.bookedInterviewSlot)}</p>
          <p>{candidate.interviewLocation || interviewLocation || 'Lieu non précisé'}</p>
        </div>
      )}

      {!candidate.bookedInterviewSlot && interviewSlots && interviewSlots.length > 0 && (
        <div className="mb-2 rounded-md bg-[var(--ds-warning-bg)] px-2 py-1 text-[11px] text-[var(--ds-text-muted)] border border-[var(--ds-border)]">
          <p className="font-medium mb-0.5">Créneaux proposés par l'entreprise</p>
          <div className="flex flex-wrap gap-1">
            {interviewSlots.map((slot) => (
              <span key={slot} className="rounded bg-[var(--ds-surface)] px-1.5 py-0.5 text-[15px] text-[var(--ds-text-subtle)]">
                {formatSlot(slot)}
              </span>
            ))}
          </div>
          {interviewLocation && <p className="mt-0.5">{interviewLocation}</p>}
        </div>
      )}

      {candidate.immersionStartDate && candidate.immersionEndDate && (
        <p className="mb-2 text-[11px] text-[var(--ds-text-subtle)]">
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
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--ds-text-subtle)] hover:bg-[var(--ds-surface-sunken)] hover:text-[var(--ds-text-muted)] transition-colors"
          title="Voir la fiche"
        >
          <IconInfo width={14} height={14} />
        </button>
        {onSendMail && (
          <button
            onClick={onSendMail}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--ds-text-subtle)] hover:bg-[var(--ds-surface-sunken)] hover:text-blue transition-colors"
            title="Envoyer un mail"
          >
            <IconMail width={14} height={14} />
          </button>
        )}
        {onRemove && (
          <button
            onClick={onRemove}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--ds-text-subtle)] hover:bg-[var(--ds-danger-bg)] hover:text-[var(--ds-danger)] transition-colors"
            title="Retirer ce candidat"
          >
            <IconUserRemove width={14} height={14} />
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
        'rounded-xl border bg-[var(--ds-surface)]',
        isAccepted ? 'border-success/30 ring-1 ring-success/10 shadow-sm' : 'border-[var(--ds-border)] shadow-sm',
      ].join(' ')}>
        <div className="p-4">
          <div className="flex items-start gap-3 mb-3">
            <div className={[
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
              isAccepted ? 'bg-[var(--ds-success-bg)] text-[var(--ds-success)]' : 'bg-purple-light text-purple',
            ].join(' ')}>
              {isAccepted ? <IconUserCheck width={16} height={16} /> : <IconUser width={16} height={16} />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--ds-text)] truncate">{candidate.fullName}</p>
              <p className="text-xs text-[var(--ds-text-subtle)]">
                {sexLabel(candidate.sex)}{candidate.age ? ` · ${candidate.age} ans` : ''}
              </p>
            </div>
            <button
              onClick={onInfo}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--ds-text-subtle)] hover:bg-[var(--ds-surface-sunken)] hover:text-[var(--ds-text-muted)] transition-colors"
            >
              <IconInfo width={14} height={14} />
            </button>
          </div>

          <div className="space-y-1.5 mb-3">
            {candidate.email && (
              <div className="flex items-center gap-2 text-xs text-[var(--ds-text-subtle)]">
                <IconMail width={12} height={12} className="text-[var(--ds-text-subtle)] shrink-0" />
                <span className="truncate">{candidate.email}</span>
              </div>
            )}
            {candidate.phone && (
              <div className="flex items-center gap-2 text-xs text-[var(--ds-text-subtle)]">
                <IconPhone width={12} height={12} className="text-[var(--ds-text-subtle)] shrink-0" />
                <span>{candidate.phone}</span>
              </div>
            )}
            {candidate.city && (
              <div className="flex items-center gap-2 text-xs text-[var(--ds-text-subtle)]">
                <IconMapPin width={12} height={12} className="text-[var(--ds-text-subtle)] shrink-0" />
                <span>{formatEnum(candidate.city)}</span>
              </div>
            )}
          </div>

          {!isAccepted && (
            <div className="flex gap-2">
              <button
                onClick={onDismiss}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--ds-border)] px-3 py-1.5 text-xs font-medium text-[var(--ds-danger)] transition-all hover:bg-[var(--ds-danger-bg)] hover:border-danger/20 active:scale-[0.97]"
              >
                <IconClose width={13} height={13} /> Non
              </button>
              <button
                onClick={onAccept}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--ds-border)] px-3 py-1.5 text-xs font-medium text-[var(--ds-success)] transition-all hover:bg-[var(--ds-success-bg)] hover:border-success/20 active:scale-[0.97]"
              >
                <IconCheck width={13} height={13} /> Oui
              </button>
            </div>
          )}

          {isAccepted && (
            <div className="flex flex-col gap-2">
              {isSaved ? (
                <div className="flex items-center gap-1.5 text-xs text-[var(--ds-success)] font-medium">
                  <IconCheck width={13} height={13} /> Retenu
                </div>
              ) : (
                <button
                  onClick={onSaveMatch}
                  disabled={isSaving}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-success/30 bg-[var(--ds-success-bg)] px-3 py-1.5 text-xs font-medium text-[var(--ds-success)] transition-all hover:bg-success/10 active:scale-[0.97] disabled:opacity-50"
                >
                  {isSaving ? <IconLoader width={13} height={13} className="animate-spin" /> : <IconPlus width={13} height={13} />}
                  Enregistrer le match
                </button>
              )}
              <button
                onClick={onSendMail}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--ds-border)] px-3 py-1.5 text-xs font-medium text-[var(--ds-text-muted)] transition-all hover:bg-[var(--ds-surface-sunken)] active:scale-[0.97]"
              >
                <IconMail width={13} height={13} /> Envoyer un mail
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
          : 'border-[var(--ds-border)] bg-[var(--ds-surface)] shadow-sm hover:shadow-md hover:border-[var(--ds-border)]',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <div className={[
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors',
          isSelected ? 'bg-blue text-white' : 'bg-blue-light text-blue',
        ].join(' ')}>
          <IconCompany width={18} height={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--ds-text)] truncate">{job.companyName}</p>
          <p className="text-xs text-[var(--ds-text-subtle)] mt-0.5">{job.ageRange ? `${job.ageRange} ans` : '—'}</p>
        </div>
        <IconChevronRight
          width={16} height={16}
          className={[
            'text-[var(--ds-text-subtle)] transition-transform duration-200 shrink-0 mt-0.5',
            isSelected ? 'rotate-90 text-blue' : 'group-hover:text-[var(--ds-text-subtle)]',
          ].join(' ')}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
        {job.desiredTp.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--ds-text-subtle)] col-span-2">
            <IconJob width={11} height={11} className="text-[var(--ds-text-subtle)] shrink-0" />
            <span className="truncate font-medium">
              {job.desiredTp.map((tp) => tpLabel(tp.tpType)).join(' · ')}
            </span>
          </div>
        )}
        {job.desiredSex && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--ds-text-subtle)]">
            <IconUser width={11} height={11} className="text-[var(--ds-text-subtle)] shrink-0" />
            <span>{sexLabel(job.desiredSex)}</span>
          </div>
        )}
        {job.drivingLicencseB === true && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--ds-text-subtle)]">
            <IconCar width={11} height={11} className="text-[var(--ds-text-subtle)] shrink-0" />
            <span>Permis B requis</span>
          </div>
        )}
        {job.hasVehicle === true && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--ds-text-subtle)] ml-3 pl-3 border-l border-[var(--ds-border)]">
            <IconCar width={11} height={11} className="text-[var(--ds-text-subtle)] shrink-0" />
            <span>Véhiculé requis</span>
          </div>
        )}
        {job.sector && job.sector !== 'NONE' && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--ds-text-subtle)]">
            <IconCompany width={11} height={11} className="text-[var(--ds-text-subtle)] shrink-0" />
            <span className="truncate">{formatEnum(job.sector)}</span>
          </div>
        )}
      </div>

      {job.localisation && job.localisation.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {job.localisation.slice(0, 3).map((loc) => (
            <span key={loc} className="rounded-md bg-[var(--ds-surface-sunken)] px-2 py-0.5 text-[10px] text-[var(--ds-text-subtle)] border border-[var(--ds-border)]">
              {locLabel(loc)}
            </span>
          ))}
          {job.localisation.length > 3 && (
            <span className="rounded-md bg-[var(--ds-surface-sunken)] px-2 py-0.5 text-[10px] text-[var(--ds-text-subtle)] border border-[var(--ds-border)]">
              +{job.localisation.length - 3}
            </span>
          )}
        </div>
      )}

      {formatScheduleSlots(job.schedule).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {formatScheduleSlots(job.schedule).slice(0, 3).map((s) => (
            <span key={s} className="rounded-md bg-[var(--ds-surface-sunken)] px-2 py-0.5 text-[10px] text-[var(--ds-text-subtle)] border border-[var(--ds-border)]">
              {s}
            </span>
          ))}
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
  onDeleteOffer,
  onSeeAb,
}: {
  job: MatchJobResult
  onSetStatus: (status: OfferStatus) => void
  hasAcceptedCandidates: boolean
  isCreatingSession: boolean
  onProposeCandidates: () => void
  onShowCompanyInfo: () => void
  onDeleteOffer?: () => void
  onSeeAb?: () => void
}) {
  const chip = statusChip(job.status)

  return (
    <div className="rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-light text-blue">
            <IconCompany width={20} height={20} />
          </div>
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={onShowCompanyInfo}
              className="text-left text-base font-bold text-[var(--ds-text)] truncate hover:text-blue hover:underline"
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
          {onSeeAb && (
            <button
              onClick={onSeeAb}
              className="flex items-center justify-center gap-2 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 py-2 text-sm font-semibold text-[var(--ds-text-muted)] shadow-sm transition-all hover:border-blue hover:text-blue md:px-4"
              title="Voir l'analyse de besoin"
            >
              <IconEye width={16} height={16} />
              <span className="hidden md:inline">Voir l'AB</span>
            </button>
          )}
          {onDeleteOffer && (
            <button
              onClick={onDeleteOffer}
              className="flex items-center justify-center gap-2 rounded-xl border border-danger/30 bg-[var(--ds-surface)] px-3 py-2 text-sm font-semibold text-[var(--ds-danger)] shadow-sm transition-all hover:bg-[var(--ds-danger-bg)] md:px-4"
              title="Supprimer l'offre"
            >
              <IconTrash width={16} height={16} />
              <span className="hidden md:inline">Supprimer</span>
            </button>
          )}
          {hasAcceptedCandidates && (
            <button
              onClick={onProposeCandidates}
              disabled={isCreatingSession}
              className="flex shrink-0 items-center gap-2 rounded-xl border border-blue/20 px-4 py-2 text-sm font-semibold text-blue hover:bg-blue-light transition-colors disabled:opacity-50"
              title="Proposer les candidats acceptés à l'entreprise via un lien sécurisé"
            >
              {isCreatingSession ? <IconLoader width={16} height={16} className="animate-spin" /> : <IconSend width={16} height={16} />}
              Proposer les candidats
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 pb-4 border-b border-[var(--ds-border)]">
        <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--ds-text-subtle)] mb-2">
          <IconJob width={10} height={10} className="inline mr-1 text-[var(--ds-text-subtle)]" />
          Critères
        </p>
        <div className="grid grid-cols-2 gap-3">
          {job.desiredTp.length > 0 && (
            <div className="flex items-start gap-2">
              <IconJob width={13} height={13} className="text-[var(--ds-text-subtle)] mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--ds-text-subtle)]">Type de TP</p>
                <p className="text-xs font-medium text-[var(--ds-text)] mt-0.5">
                  {job.desiredTp.map((tp) => tpLabel(tp.tpType)).join(' · ')}
                </p>
              </div>
            </div>
          )}
          {job.title && (
            <div className="flex items-start gap-2">
              <IconUser width={13} height={13} className="text-[var(--ds-text-subtle)] mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--ds-text-subtle)]">Intitulé du poste</p>
                <p className="text-xs font-medium text-[var(--ds-text)] mt-0.5">{job.title}</p>
              </div>
            </div>
          )}
          {job.jobRole && (
            <div className="flex items-start gap-2">
              <IconJob width={13} height={13} className="text-[var(--ds-text-subtle)] mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--ds-text-subtle)]">Intitulé du métier</p>
                <p className="text-xs font-medium text-[var(--ds-text)] mt-0.5">{job.jobRole}</p>
              </div>
            </div>
          )}
          {job.companyInfos?.address && (
            <div className="flex items-start gap-2">
              <IconCompany width={13} height={13} className="text-[var(--ds-text-subtle)] mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--ds-text-subtle)]">Siège social</p>
                <p className="text-xs font-medium text-[var(--ds-text)] mt-0.5 truncate">{job.companyInfos.address}</p>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {job.desiredTp
            .filter((tp) => tp.missions.length > 0)
            .map((tp) => (
              <div key={tp.tpType ?? ''}>
                <details className="group">
                  <summary className="flex cursor-pointer items-center gap-2 text-[10px] uppercase font-semibold tracking-wider text-[var(--ds-text-subtle)] list-none [&::-webkit-details-marker]:hidden">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ds-border)] px-2.5 py-1 text-xs font-medium text-[var(--ds-text-muted)] transition-colors group-open:bg-blue-light group-open:text-blue group-open:border-blue/20">
                      <IconChevronRight width={12} height={12} className="transition-transform group-open:rotate-90" />
                      {tpLabel(tp.tpType)} — {tp.missions.length} mission{tp.missions.length > 1 ? 's' : ''}
                    </span>
                  </summary>
                  <div className="mt-2 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-sunken)] p-3 space-y-1.5">
                    {tp.missions.map((mission, i) => (
                      <p key={i} className="text-xs font-medium text-[var(--ds-text-muted)] flex items-start gap-2">
                        <span className="text-[var(--ds-text-subtle)] mt-0.5 shrink-0">•</span>
                        {mission}
                      </p>
                    ))}
                  </div>
                </details>
              </div>
            ))}
          {job.companyInfos?.activities && job.companyInfos.activities.length > 0 && (
            <div>
              <details className="group">
                <summary className="flex cursor-pointer items-center gap-2 text-[10px] uppercase font-semibold tracking-wider text-[var(--ds-text-subtle)] list-none [&::-webkit-details-marker]:hidden">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ds-border)] px-2.5 py-1 text-xs font-medium text-[var(--ds-text-muted)] transition-colors group-open:bg-blue-light group-open:text-blue group-open:border-blue/20">
                    <IconChevronRight width={12} height={12} className="transition-transform group-open:rotate-90" />
                    {job.companyInfos.activities.length} secteur{job.companyInfos.activities.length > 1 ? 's' : ''} d'activité
                  </span>
                </summary>
                <div className="mt-2 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-sunken)] p-3 space-y-1.5">
                  {job.companyInfos.activities.map((activity, i) => (
                    <p key={i} className="text-xs font-medium text-[var(--ds-text-muted)] flex items-start gap-2">
                      <span className="text-[var(--ds-text-subtle)] mt-0.5 shrink-0">•</span>
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
                <summary className="flex cursor-pointer items-center gap-2 text-[10px] uppercase font-semibold tracking-wider text-[var(--ds-text-subtle)] list-none [&::-webkit-details-marker]:hidden">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ds-border)] px-2.5 py-1 text-xs font-medium text-[var(--ds-text-muted)] transition-colors group-open:bg-blue-light group-open:text-blue group-open:border-blue/20">
                    <IconChevronRight width={12} height={12} className="transition-transform group-open:rotate-90" />
                    Soft skills
                  </span>
                </summary>
                <div className="mt-2 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-sunken)] p-3 space-y-1.5">
                  {job.softSkills.split(',').map((skill, i) => (
                    <p key={i} className="text-xs font-medium text-[var(--ds-text-muted)] flex items-start gap-2">
                      <span className="text-[var(--ds-text-subtle)] mt-0.5 shrink-0">•</span>
                      {skill.trim()}
                    </p>
                  ))}
                </div>
              </details>
            </div>
          )}
          {formatScheduleSlots(job.schedule).length > 0 && (
            <div>
              <details className="group">
                <summary className="flex cursor-pointer items-center gap-2 text-[10px] uppercase font-semibold tracking-wider text-[var(--ds-text-subtle)] list-none [&::-webkit-details-marker]:hidden">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ds-border)] px-2.5 py-1 text-xs font-medium text-[var(--ds-text-muted)] transition-colors group-open:bg-blue-light group-open:text-blue group-open:border-blue/20">
                    <IconChevronRight width={12} height={12} className="transition-transform group-open:rotate-90" />
                    Horaires
                  </span>
                </summary>
                <div className="mt-2 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-sunken)] p-3 space-y-1.5">
                  {formatScheduleSlots(job.schedule).map((s, i) => (
                    <p key={i} className="text-xs font-medium text-[var(--ds-text-muted)] flex items-start gap-2">
                      <span className="text-[var(--ds-text-subtle)] mt-0.5 shrink-0">•</span>
                      {s}
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
            <IconUser width={13} height={13} className="text-[var(--ds-text-subtle)] mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--ds-text-subtle)]">Tranche d'âge</p>
              <p className="text-xs font-medium text-[var(--ds-text)] mt-0.5">{job.ageRange} ans</p>
            </div>
          </div>
        )}
        {job.sector && job.sector !== 'NONE' && (
          <div className="flex items-start gap-2">
            <IconCompany width={13} height={13} className="text-[var(--ds-text-subtle)] mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--ds-text-subtle)]">Secteur</p>
              <p className="text-xs font-medium text-[var(--ds-text)] mt-0.5">{formatEnum(job.sector)}</p>
            </div>
          </div>
        )}
        {job.drivingLicencseB === true && (
          <div className="flex items-start gap-2">
            <IconCar width={13} height={13} className="text-[var(--ds-text-subtle)] mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--ds-text-subtle)]">Permis B</p>
              <p className="text-xs font-medium text-[var(--ds-text)] mt-0.5">Requis</p>
            </div>
          </div>
        )}
        {job.hasVehicle != null && (
          <div className="flex items-start gap-2 ml-3 pl-3 border-l border-[var(--ds-border)]">
            <IconCar width={13} height={13} className="text-[var(--ds-text-subtle)] mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--ds-text-subtle)]">Véhiculé</p>
              <p className="text-xs font-medium text-[var(--ds-text)] mt-0.5">{job.hasVehicle ? 'Oui' : 'Non'}</p>
            </div>
          </div>
        )}
        {job.professionalExperience === true && (
          <div className="flex items-start gap-2">
            <IconJob width={13} height={13} className="text-[var(--ds-text-subtle)] mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--ds-text-subtle)]">Expérience</p>
              <p className="text-xs font-medium text-[var(--ds-text)] mt-0.5">Requise</p>
            </div>
          </div>
        )}
      </div>

      {job.localisation && job.localisation.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[var(--ds-border)]">
          <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--ds-text-subtle)] mb-2">
            <IconMapPin width={10} height={10} className="inline mr-1 text-[var(--ds-text-subtle)]" />
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
        <div className="mt-3 pt-3 border-t border-[var(--ds-border)]">
          <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--ds-text-subtle)] mb-2">
            <IconUser width={10} height={10} className="inline mr-1 text-[var(--ds-text-subtle)]" />
            Commercial
          </p>
          <div className="grid grid-cols-2 gap-3">
            {job.salerInfo.email && (
              <div className="flex items-start gap-2">
                <IconMail width={13} height={13} className="text-[var(--ds-text-subtle)] mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--ds-text-subtle)]">Email commercial</p>
                  <p className="text-xs font-medium text-[var(--ds-text)] mt-0.5">{job.salerInfo.email}</p>
                </div>
              </div>
            )}
            {job.salerInfo.id != null && (
              <div className="flex items-start gap-2">
                <IconUser width={13} height={13} className="text-[var(--ds-text-subtle)] mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--ds-text-subtle)]">ID commercial</p>
                  <p className="text-xs font-medium text-[var(--ds-text)] mt-0.5">{job.salerInfo.id}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {job.referents && (() => {
        const legal = job.referents.legalReferents
        const recruit = job.referents.recruitmentReferents
        const hasRecruit = !!(recruit?.name || recruit?.phone || recruit?.email || recruit?.function)
        // Stale isSame flag from old data may be inaccurate — also compare actual fields.
        const actuallySame = !hasRecruit || (
          (recruit?.name ?? null) === (legal?.name ?? null) &&
          (recruit?.phone ?? null) === (legal?.phone ?? null) &&
          (recruit?.email ?? null) === (legal?.email ?? null) &&
          (recruit?.function ?? null) === (legal?.function ?? null)
        )
        const shouldShowBoth = !job.referents.isSame || !actuallySame
        const showBoth = shouldShowBoth && hasRecruit
        return (
          <div className="mt-3 pt-3 border-t border-[var(--ds-border)]">
            <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--ds-text-subtle)] mb-2">
              <IconUser width={10} height={10} className="inline mr-1 text-[var(--ds-text-subtle)]" />
              Référents
            </p>
            {showBoth
              ? (
                <div className="grid grid-cols-2 gap-3">
                  <ReferentBlock label="Référent légal" details={legal} />
                  <ReferentBlock label="Référent recrutement" details={recruit} />
                </div>
              )
              : (
                <ReferentBlock
                  label="Référent"
                  details={legal ?? recruit}
                />
              )
            }
          </div>
        )
      })()}
    </div>
  )
}

function ReferentBlock({ label, details }: { label: string; details: ReferentDetails | null | undefined }) {
  if (!details) return null
  const hasData = details.name || details.phone || details.email || details.function
  if (!hasData) return null

  return (
    <div className="rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-sunken)] p-3">
      <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--ds-text-subtle)] mb-2">{label}</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {details.name && (
          <div className="flex items-start gap-1.5">
            <IconUser width={11} height={11} className="text-[var(--ds-text-subtle)] mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--ds-text-subtle)]">Nom</p>
              <p className="text-xs font-medium text-[var(--ds-text)]">{details.name}</p>
            </div>
          </div>
        )}
        {details.phone && (
          <div className="flex items-start gap-1.5">
            <IconPhone width={11} height={11} className="text-[var(--ds-text-subtle)] mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--ds-text-subtle)]">Téléphone</p>
              <p className="text-xs font-medium text-[var(--ds-text)]">{details.phone}</p>
            </div>
          </div>
        )}
        {details.email && (
          <div className="flex items-start gap-1.5">
            <IconMail width={11} height={11} className="text-[var(--ds-text-subtle)] mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--ds-text-subtle)]">Email</p>
              <p className="text-xs font-medium text-[var(--ds-text)]">{details.email}</p>
            </div>
          </div>
        )}
        {details.function && (
          <div className="flex items-start gap-1.5">
            <IconJob width={11} height={11} className="text-[var(--ds-text-subtle)] mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--ds-text-subtle)]">Fonction</p>
              <p className="text-xs font-medium text-[var(--ds-text)]">{details.function}</p>
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
    <div className="rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <IconUserCheck width={15} height={15} className="text-blue" />
        <h3 className="text-sm font-semibold text-[var(--ds-text)]">Candidats pré-sélectionnés</h3>
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
              <IconPlus width={11} height={11} /> Ajouter un candidat
            </button>
          )}
          {candidates.length > 0 && (
            <button
              onClick={onMailAll}
              disabled={isMailingAll}
              className="flex items-center gap-1 rounded-lg border border-blue/20 px-2.5 py-1 text-xs font-medium text-blue hover:bg-blue-light transition-colors disabled:opacity-50"
            >
              {isMailingAll ? (
                <><IconLoader width={11} height={11} className="animate-spin" /> {mailAllProgress ? `${mailAllProgress.sent}/${mailAllProgress.total}` : '…'}</>
              ) : (
                <><IconMailSent width={11} height={11} /> IconMail à tous</>
              )}
            </button>
          )}
        </div>
      </div>

      {candidates.length === 0 ? (
        <div className="text-center py-4 px-3 bg-[var(--ds-surface-sunken)] rounded-lg">
          <p className="text-xs text-[var(--ds-text-subtle)]">Aucun candidat pré-sélectionné.</p>
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
    <div className="rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <IconSend width={15} height={15} className="text-purple" />
        <h3 className="text-sm font-semibold text-[var(--ds-text)]">Candidats à envoyer</h3>
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
              <IconPlus width={11} height={11} /> Ajouter un candidat
            </button>
          )}
        </div>
      </div>

      {candidates.length === 0 ? (
        <div className="text-center py-4 px-3 bg-[var(--ds-surface-sunken)] rounded-lg">
          <p className="text-xs text-[var(--ds-text-subtle)]">Aucun candidat à envoyer.</p>
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
  interviewSlots,
  interviewLocation,
}: {
  candidates: MatchedCandidate[]
  onInfo: (c: MatchedCandidate) => void
  onSendDates: (c: MatchedCandidate) => void
  onConcludeInterview: (c: MatchedCandidate) => void
  onConcludeImmersion: (c: MatchedCandidate) => void
  onAddCandidate: () => void
  interviewSlots?: string[] | null
  interviewLocation?: string | null
}) {
  const currentUser = useCurrentUser()
  const canProposeOffers = currentUser?.permission === Permission.RESPONSABLE || currentUser?.permission === Permission.ADMIN

  return (
    <div className="rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <IconFavorite width={15} height={15} className="text-[var(--ds-text-subtle)]" />
        <h3 className="text-sm font-semibold text-[var(--ds-text)]">Candidats déjà envoyés</h3>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--ds-surface-sunken)] text-[var(--ds-text-subtle)]">
          {candidates.length}
        </span>
        {canProposeOffers && (
          <button
            onClick={onAddCandidate}
            className="ml-auto flex items-center gap-1 rounded-lg border border-purple/20 px-2.5 py-1 text-xs font-medium text-purple hover:bg-purple/5 transition-colors"
            title="Ajouter manuellement un candidat pour entretien ou immersion"
          >
            <IconPlus width={11} height={11} /> Ajouter un candidat
          </button>
        )}
      </div>

      {candidates.length === 0 ? (
        <div className="text-center py-4 px-3 bg-[var(--ds-surface-sunken)] rounded-lg">
          <p className="text-xs text-[var(--ds-text-subtle)]">Aucun candidat déjà envoyé.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {candidates.map((c) => {
            const needsInterviewConclusion = c.status === MatchedCandidateStatus.INTERVIEW && isInterviewDatePast(c.bookedInterviewSlot) && !c.interviewConclusion
            const needsImmersionConclusion = c.status === MatchedCandidateStatus.IMMERSING && !c.immersionConclusion
            const canSendDates = c.status === MatchedCandidateStatus.INTERVIEW && c.bookedInterviewSlot && (c.interviewLocation || interviewLocation)

            return (
              <CandidateRow
                key={c.id}
                candidate={c}
                onInfo={() => onInfo(c)}
                interviewSlots={interviewSlots}
                interviewLocation={interviewLocation}
                actions={
                  <div className="flex items-center gap-1">
                    {canSendDates && (
                      <button
                        onClick={() => onSendDates(c)}
                        className="flex h-7 items-center gap-1 rounded-lg border border-purple/20 px-2 text-[11px] font-medium text-purple hover:bg-purple/5 transition-colors"
                        title="Envoyer les dates au candidat"
                      >
                        <IconMail width={11} height={11} /> Dates
                      </button>
                    )}
                    {needsInterviewConclusion && (
                      <button
                        onClick={() => onConcludeInterview(c)}
                        className="flex h-7 items-center gap-1 rounded-lg border border-blue/20 px-2 text-[11px] font-medium text-blue hover:bg-blue/5 transition-colors"
                      >
                        <IconSchedule width={11} height={11} /> Conclure entretien
                      </button>
                    )}
                    {needsImmersionConclusion && (
                      <button
                        onClick={() => onConcludeImmersion(c)}
                        className="flex h-7 items-center gap-1 rounded-lg border border-blue/20 px-2 text-[11px] font-medium text-blue hover:bg-blue/5 transition-colors"
                      >
                        <IconSchedule width={11} height={11} /> Conclure immersion
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
  const companyName = job.companyInfos?.name ?? job.companyName
  const offerTitle = job.jobRole || job.title
  const segments: string[] = []

  if (offerTitle) {
    segments.push(`<div class="job-title"><strong>Role</strong></br> ${offerTitle}</div>`)
  }
  if (job.sector && job.sector !== 'NONE') {
    segments.push(`<div class="field"><div class="field-label">Secteur</div><div class="field-value">${formatEnumLabel(job.sector)}</div></div>`)
  }
  if (job.localisation && job.localisation.length > 0) {
    const locs = job.localisation
      .map((l) => LOCALISATION_LABELS[l as keyof typeof LOCALISATION_LABELS] ?? l)
      .filter(Boolean)
      .join(', ')
    if (locs) {
      segments.push(`<div class="field"><div class="field-label"><strong>Localisation</strong></div><div class="field-value">${locs}</div></div>`)
    }
  }
  for (const tp of job.desiredTp) {
    if (tp.missions.length === 0) continue
    const items = tp.missions.map((m) => `<li>${m}</li>`).join('')
    segments.push(`<div class="field"><div class="field-label"><strong>Missions</strong> — ${tpLabel(tp.tpType)}</div><ul class="mission-list">${items}</ul></div>`)
  }
  const schedule = formatScheduleSlots(job.schedule)
  if (schedule.length > 0) {
    const items = schedule.map((s) => `<li>${s}</li>`).join('')
    segments.push(`<div class="field"><div class="field-label"><strong>Horaires</strong></div><ul class="mission-list">${items}</ul></div>`)
  }
  if (job.companyInfos?.activities && job.companyInfos.activities.length > 0) {
    const tags = job.companyInfos.activities.map((a) => `<span class="activity-tag">${SECTOR_LABELS[a] ?? a}</span>`).join(' ')
    segments.push(`<div class="field"><div class="field-label"><strong>Activités de l'entreprise</strong></div><div>${tags}</div></div>`)
  }
  const offerCard = segments.length > 0
    ? `<div class="offer-card">${segments.join('')}</div>`
    : ''

  const introCompany = companyName ? ` chez <strong>${companyName}</strong>` : ''

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
  .company { font-size: 17px; font-weight: 800; color: #60207E; margin-bottom: 4px; }
  .job-title { font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 8px; }
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
  <p>Nous avons sélectionné pour vous une offre en alternance${introCompany} qui correspond à votre profil :</p>
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
  const dateFormatted = new Date(bookedInterviewSlot).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Indian/Reunion' })
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
  const startFormatted = new Date(startDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Indian/Reunion' })
  const endFormatted = new Date(endDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Indian/Reunion' })
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
  relaxedCriteria,
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
  relaxedCriteria?: string[] | null
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
    <div className="rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <IconSparkles width={15} height={15} className="text-blue" />
        <h3 className="text-sm font-semibold text-[var(--ds-text)]">Matching automatique</h3>
        {hasLaunched && !isMatching && (
          <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-light text-blue">
            {suggestedCandidates.length} suggestion{suggestedCandidates.length > 1 ? 's' : ''}
          </span>
        )}
        {(retainedCount > 0 || acceptedThisSession > 0) && hasLaunched && !isMatching && (
          <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--ds-success-bg)] text-[var(--ds-success)]">
            <IconCheck width={10} height={10} /> {retainedCount + acceptedThisSession} retenu{retainedCount + acceptedThisSession > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {hasLaunched && !isMatching && relaxedCriteria?.includes('sector') && (
        <div className="mb-3 flex items-start gap-2 rounded-xl bg-[var(--ds-warning-bg)] border border-[var(--ds-warning)] px-4 py-3 text-xs text-[var(--ds-warning)]">
          <IconAlert width={14} height={14} className="mt-0.5 shrink-0 text-[var(--ds-warning)]" />
          <span>
            Aucun candidat ne correspond au(x) secteur(s) d'activité de cette offre&nbsp;: ce critère a été ignoré
            pour afficher des résultats.
          </span>
        </div>
      )}

      {!hasLaunched && (
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-light text-blue">
            <IconSparkles width={22} height={22} />
          </div>
          <p className="text-xs text-[var(--ds-text-subtle)] text-center max-w-[220px]">
            Lancez le matching pour trouver les candidats correspondant aux critères de cette offre.
          </p>
          <button
            onClick={onLaunch}
            className="flex items-center gap-2 rounded-xl bg-blue px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-blue/90 active:scale-[0.97] shadow-sm"
          >
            <IconPlay width={16} height={16} />
            Lancer le matching
          </button>
        </div>
      )}

      {hasLaunched && isMatching && (
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-2 border-blue-light" />
            <IconLoader width={20} height={20} className="absolute inset-0 m-auto animate-spin text-blue" />
          </div>
          <p className="text-sm text-[var(--ds-text-subtle)]">Matching en cours…</p>
        </div>
      )}

      {hasLaunched && !isMatching && matchError && (
        <div className="flex items-start gap-2 rounded-xl bg-[var(--ds-danger-bg)] px-4 py-3 text-sm text-[var(--ds-danger)]">
          <IconAlert width={16} height={16} className="mt-0.5 shrink-0" />
          <span>{matchError}</span>
        </div>
      )}

      {hasLaunched && !isMatching && !matchError && (
        <>
          {suggestedCandidates.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--ds-surface-sunken)]">
                <IconUsers width={18} height={18} className="text-[var(--ds-text-subtle)]" />
              </div>
              <p className="text-xs text-[var(--ds-text-subtle)]">Aucun profil disponible ne correspond à cette offre.</p>
              <button
                onClick={onLaunch}
                className="flex items-center gap-1.5 text-xs font-medium text-blue hover:text-blue/80 transition-colors mt-1"
              >
                <IconRefresh width={12} height={12} /> Relancer
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
                className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--ds-border)] px-3 py-2 text-xs font-medium text-[var(--ds-text-subtle)] transition-all hover:bg-[var(--ds-surface-sunken)] mt-1"
              >
                <IconRefresh width={12} height={12} /> Relancer le matching
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
  return new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Indian/Reunion' })
}



function RightPanel({ selectedJob, currentUser, onJobDeleted }: { selectedJob: Job | null; currentUser: import('@/store/authStore').AppUser | null; onJobDeleted?: () => void }) {
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
  const [sendToCompanyOpen, setSendToCompanyOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteStep, setDeleteStep] = useState<'reason' | 'confirmAll' | 'blacklist' | 'confirming'>('reason')
  const [deleteReason, setDeleteReason] = useState('')
  const [deleteAllFromNA, setDeleteAllFromNA] = useState(false)
  const [shouldBlacklist, setShouldBlacklist] = useState(false)
  const [offersInNA, setOffersInNA] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [showOfferAbDetail, setShowOfferAbDetail] = useState(false)

  const interviewLocationNeedsAnalysis = useNeedsAnalysis(selectedJob?.needsAnalysisId ?? null)
  const interviewDefaultLocation =
    interviewLocationNeedsAnalysis.data?.needsAnalysis?.companyInfos?.commune ||
    (interviewLocationNeedsAnalysis.data?.needsAnalysis?.companyInfos?.postalCode
      ? `Commune ${interviewLocationNeedsAnalysis.data.needsAnalysis.companyInfos.postalCode}`
      : '')

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
    MatchedCandidateStatus.CONTRACT,
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
        console.log(data);
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
          await apiFetch('/api/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
          bookedInterviewSlot: new Date(`${dateOrStartDate}T${hourOrEndDate}:00+04:00`).toISOString(),
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

  const handleAddAcceptedCandidate = async (candidateId: string) => {
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

  const handleCreateMatchSession = async (offerId: string, companyEmail: string, candidates: { id: string; description: string }[], templateId?: string): Promise<string> => {
    const result = await offerGraphqlClient
      .mutation(CREATE_MATCH_SESSION, { offerId, companyEmail, candidates, templateId })
      .toPromise()
    if (result.error) throw new Error(result.error.message)
    const signature = result.data?.createMatchSession
    if (!signature) throw new Error('Aucune signature retournée')
    if (selectedJob) loadJobData(selectedJob)
    return signature
  }

  const handleDeleteClick = async () => {
    setDeleteReason('')
    setDeleteStep('reason')
    setDeleteAllFromNA(false)
    setShouldBlacklist(false)
    setOffersInNA(0)
    setDeleteError(null)
    setDeleteModalOpen(true)
  }

  const handleDeleteReasonNext = async () => {
    if (!deleteReason.trim()) return
    setDeleteError(null)
    if (selectedJob?.needsAnalysisId) {
      try {
        const result = await offerGraphqlClient.query(OFFERS_BY_NEEDS_ANALYSIS, { needsAnalysisId: selectedJob.needsAnalysisId }).toPromise()
        const offers = (result.data?.offersByNeedsAnalysis ?? []) as { id: string }[]
        setOffersInNA(offers.length)
        if (offers.length > 1) {
          setDeleteStep('confirmAll')
          return
        }
      } catch {
        // if query fails, just proceed without the "delete all" choice
      }
    }
    setDeleteStep('blacklist')
  }

  const handleDeleteConfirmAll = (all: boolean) => {
    setDeleteAllFromNA(all)
    setDeleteStep('blacklist')
  }

  const handleDeleteBlacklistChoice = (blacklist: boolean) => {
    setShouldBlacklist(blacklist)
    setDeleteStep('confirming')
  }

  const handleDeleteConfirm = async () => {
    if (!selectedJob) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      if (shouldBlacklist) {
        const companyId = selectedJob.companyInfos?.id
        if (!companyId) throw new Error('Impossible de trouver l\'ID entreprise pour le blacklistage')
        const result = await graphqlClient.mutation(BLACKLIST_AND_CLEANUP_COMPANY, {
          companyId,
          reason: deleteReason.trim(),
          allBlacklist: true,
        }).toPromise()
        if (result.error) throw new Error(result.error.message)
      } else if (deleteAllFromNA && selectedJob.needsAnalysisId) {
        const result = await offerGraphqlClient.mutation(DELETE_OFFERS_BY_NEEDS_ANALYSIS, {
          needsAnalysisId: selectedJob.needsAnalysisId,
        }).toPromise()
        if (result.error) throw new Error(result.error.message)
      } else {
        const result = await offerGraphqlClient.mutation(DELETE_OFFER, {
          id: selectedJob.id,
        }).toPromise()
        if (result.error) throw new Error(result.error.message)
      }
      setDeleteModalOpen(false)
      onJobDeleted?.()
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Erreur lors de la suppression')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteClose = () => {
    if (!isDeleting) {
      setDeleteModalOpen(false)
      setDeleteError(null)
    }
  }

  if (!selectedJob) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 py-24 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-light text-blue">
          <IconSparkles width={24} height={24} />
        </div>
        <p className="text-sm font-medium text-[var(--ds-text-muted)]">Sélectionnez une offre</p>
        <p className="text-xs text-[var(--ds-text-subtle)] max-w-[200px]">
          Cliquez sur une offre pour voir ses détails et lancer le matching.
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <IconLoader width={28} height={28} className="animate-spin text-blue" />
        <p className="text-sm text-[var(--ds-text-subtle)]">Chargement de l'offre…</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex items-start gap-2 rounded-xl bg-[var(--ds-danger-bg)] px-4 py-3 text-sm text-[var(--ds-danger)]">
        <IconAlert width={16} height={16} className="mt-0.5 shrink-0" />
        <span>{loadError}</span>
      </div>
    )
  }

  if (!jobData) return null

  const preselectedCandidates = filterByStatus(jobData.matchedCandidate, preselectedStatuses)
  const toSendCandidates = filterByStatus(jobData.matchedCandidate, toSendStatuses)
  const alreadySentCandidates = filterByStatus(jobData.matchedCandidate, alreadySentStatuses)
  const contractCandidates = filterByStatus(jobData.matchedCandidate, [MatchedCandidateStatus.CONTRACT])

  return (
    <div className="flex flex-col gap-4 pb-6">

      {contractCandidates.length > 0 && (
        <div className="rounded-xl border border-success/20 bg-[var(--ds-success-bg)] p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <IconUserCheck width={16} height={16} className="text-[var(--ds-success)]" />
            <p className="text-sm font-semibold text-[var(--ds-success)]">
              En contrat avec {contractCandidates.map((c) => c.fullName).join(', ')}
            </p>
          </div>
        </div>
      )}

      <JobDetailsSection
        job={jobData}
        onSetStatus={handleSetManualStatus}
        hasAcceptedCandidates={toSendCandidates.length > 0}
        isCreatingSession={false}
        onProposeCandidates={() => setSendToCompanyOpen(true)}
        onShowCompanyInfo={() => setShowCompanyInfo(true)}
        onDeleteOffer={
          currentUser?.permission === Permission.RESPONSABLE || currentUser?.permission === Permission.ADMIN
            ? handleDeleteClick
            : undefined
        }
        onSeeAb={jobData.needsAnalysisId ? () => setShowOfferAbDetail(true) : undefined}
      />

      <HistoryModal offerId={selectedJob.id} />

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
        interviewSlots={jobData.interviewSlots}
        interviewLocation={jobData.interviewLocation}
      />

      <MatchingSection
        suggestedCandidates={suggestedCandidates}
        savedCandidateIds={savedCandidateIds}
        decisions={decisions}
        isMatching={isMatching}
        matchError={matchError}
        hasLaunched={hasLaunched}
        savingIds={savingIds}
        relaxedCriteria={jobData?.relaxedCriteria}
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

      {sendToCompanyOpen && (
        <SendToCompanyModal
          job={jobData}
          candidates={toSendCandidates}
          onClose={() => setSendToCompanyOpen(false)}
          onSubmit={handleCreateMatchSession}
        />
      )}

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
            datesMailState.bookedInterviewSlot
              ? buildInterviewMailBody(
                datesMailState.fullName,
                datesMailState.bookedInterviewSlot,
                datesMailState.interviewLocation || jobData?.interviewLocation || '',
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

      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-[var(--ds-surface)] p-6 shadow-xl">
            {deleteStep === 'reason' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-[var(--ds-text)]">Supprimer l'offre</h3>
                <p className="text-xs text-[var(--ds-text-subtle)]">Veuillez indiquer la raison de la suppression.</p>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Raison de la suppression…"
                  rows={3}
                  className="w-full resize-none rounded-lg border border-[var(--ds-border)] p-3 text-sm outline-none transition focus:border-blue focus:ring-1 focus:ring-blue"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleDeleteClose}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--ds-text-subtle)] transition hover:bg-[var(--ds-surface-sunken)]"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleDeleteReasonNext}
                    disabled={!deleteReason.trim()}
                    className="rounded-lg bg-danger px-3 py-1.5 text-xs font-medium text-white transition hover:bg-danger/90 disabled:opacity-40"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}

            {deleteStep === 'confirmAll' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-[var(--ds-text)]">Supprimer les offres liées ?</h3>
                <p className="text-xs text-[var(--ds-text-subtle)]">
                  Cette analyse de besoin contient {offersInNA} offre{offersInNA > 1 ? 's' : ''}. Voulez-vous supprimer toutes les offres de cette analyse de besoin ou uniquement celle-ci ?
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => handleDeleteConfirmAll(false)}
                    className="rounded-lg border border-[var(--ds-border)] px-3 py-1.5 text-xs font-medium text-[var(--ds-text-muted)] transition hover:bg-[var(--ds-surface-sunken)]"
                  >
                    Cette offre uniquement
                  </button>
                  <button
                    onClick={() => handleDeleteConfirmAll(true)}
                    className="rounded-lg bg-danger px-3 py-1.5 text-xs font-medium text-white transition hover:bg-danger/90"
                  >
                    Toutes les supprimer
                  </button>
                </div>
              </div>
            )}

            {deleteStep === 'blacklist' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-[var(--ds-text)]">Blacklister l'entreprise ?</h3>
                <p className="text-xs text-[var(--ds-text-subtle)]">
                  Voulez-vous blacklister cette entreprise ? Cela supprimera toutes ses analyses de besoin et offres associées, et l'entreprise ne pourra plus être prospectée.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => handleDeleteBlacklistChoice(false)}
                    className="rounded-lg border border-[var(--ds-border)] px-3 py-1.5 text-xs font-medium text-[var(--ds-text-muted)] transition hover:bg-[var(--ds-surface-sunken)]"
                  >
                    Non
                  </button>
                  <button
                    onClick={() => handleDeleteBlacklistChoice(true)}
                    className="rounded-lg bg-danger px-3 py-1.5 text-xs font-medium text-white transition hover:bg-danger/90"
                  >
                    Oui, blacklister
                  </button>
                </div>
              </div>
            )}

            {deleteStep === 'confirming' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-[var(--ds-text)]">Confirmer la suppression</h3>
                <div className="space-y-2 rounded-lg bg-[var(--ds-surface-sunken)] p-3 text-xs text-[var(--ds-text-muted)]">
                  <p><strong>Raison :</strong> {deleteReason}</p>
                  <p><strong>Action :</strong> {shouldBlacklist ? 'Blacklistage de l\'entreprise (supprime toutes ses AB et offres)' : deleteAllFromNA ? 'Suppression de toutes les offres de l\'AB' : 'Suppression de cette offre uniquement'}</p>
                </div>
                {deleteError && (
                  <div className="flex items-start gap-2 rounded-lg bg-[var(--ds-danger-bg)] p-3 text-xs text-[var(--ds-danger)]">
                    <IconAlert width={14} height={14} className="mt-0.5 shrink-0" />
                    <span>{deleteError}</span>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleDeleteClose}
                    disabled={isDeleting}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--ds-text-subtle)] transition hover:bg-[var(--ds-surface-sunken)] disabled:opacity-40"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleDeleteConfirm}
                    disabled={isDeleting}
                    className="flex items-center gap-1.5 rounded-lg bg-danger px-3 py-1.5 text-xs font-medium text-white transition hover:bg-danger/90 disabled:opacity-40"
                  >
                    {isDeleting && <IconLoader width={14} height={14} className="animate-spin" />}
                    {isDeleting ? 'Suppression…' : 'Confirmer la suppression'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showOfferAbDetail && jobData?.needsAnalysisId && (
        <ABDetailModal id={jobData.needsAnalysisId} onClose={() => setShowOfferAbDetail(false)} />
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function AbHeader({
  needsAnalysisId,
  currentUser,
  fallbackName,
  fallbackCompanyId,
  onBack,
  onEdited,
}: {
  needsAnalysisId: string
  currentUser: import('@/store/authStore').AppUser | null
  fallbackName?: string | null
  fallbackCompanyId?: number | null
  onBack: () => void
  onEdited: () => void
}) {
   const abResult = useNeedsAnalysis(needsAnalysisId)
  const ab = abResult.data?.needsAnalysis
  const info = ab?.companyInfos
  const legalReferent = ab?.referents?.legalReferents
  const recruitmentReferent = ab?.referents?.recruitmentReferents
  const isSameReferent = ab?.referents?.isSame ?? true
  const hasRecruitmentHeader = !!(recruitmentReferent?.name || recruitmentReferent?.email || recruitmentReferent?.phone || recruitmentReferent?.function)
  const actuallySameHeader = !hasRecruitmentHeader || (
    (recruitmentReferent?.name ?? null) === (legalReferent?.name ?? null) &&
    (recruitmentReferent?.phone ?? null) === (legalReferent?.phone ?? null) &&
    (recruitmentReferent?.email ?? null) === (legalReferent?.email ?? null) &&
    (recruitmentReferent?.function ?? null) === (legalReferent?.function ?? null)
  )
  const showRecruitmentInHeader = (!isSameReferent || !actuallySameHeader) && hasRecruitmentHeader
  const canEdit = currentUser?.permission === Permission.RESPONSABLE || currentUser?.permission === Permission.ADMIN
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [abStatusSaving, setAbStatusSaving] = useState(false)
  const [showAbDetail, setShowAbDetail] = useState(false)
  const { deleteNeedsAnalysis, result: deleteResult } = useDeleteNeedsAnalysis()
  const { updateAbStatus } = useUpdateNeedsAnalysisAbStatus()

  const handleAbStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    setAbStatusSaving(true)
    try {
      const res = await updateAbStatus(needsAnalysisId, value === 'AUTO' ? null : value)
      if (!res.error) abResult.refetch()
    } finally {
      setAbStatusSaving(false)
    }
  }

  const handleDelete = async () => {
    await deleteNeedsAnalysis(needsAnalysisId)
    navigate('/rh/matching')
  }

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <button
          onClick={onBack}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--ds-text-subtle)] transition-colors hover:bg-[var(--ds-surface-sunken)] hover:text-[var(--ds-text-muted)]"
          title="Retour à la liste"
        >
          <IconArrowLeft width={18} height={18} />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-[var(--ds-text)]">{info?.name ?? fallbackName ?? 'Analyse de besoin'}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--ds-text-subtle)]">
            {info?.siret && <span>SIRET&nbsp;: {info.siret}</span>}
            {info?.activities && info.activities.length > 0 && (
              // Un intitulé NAF non référencé est une phrase entière : coupé
              // ici pour ne pas pousser l'en-tête sur plusieurs lignes.
              <TruncatedText
                className="max-w-md"
                text={info.activities.map((a: string) => SECTOR_LABELS[a] ?? a).join(' · ')}
              />
            )}
            {ab?.tags && ab.tags.length > 0 && (
              <span className="flex flex-wrap items-center gap-1">
                {ab.tags.map((tag: string) => (
                  <span key={tag} className="rounded-full bg-blue-light px-2 py-0.5 text-[11px] font-medium text-blue">
                    {tag}
                  </span>
                ))}
              </span>
            )}
            {legalReferent?.name && (
              <span className="flex items-center gap-1"><IconUser width={11} height={11} className="text-[var(--ds-text-subtle)]" /> {legalReferent.name}{legalReferent.function ? ` (${legalReferent.function})` : ''}</span>
            )}
            {legalReferent?.phone && (
              <span className="flex items-center gap-1"><IconPhone width={11} height={11} className="text-[var(--ds-text-subtle)]" /> {legalReferent.phone}</span>
            )}
            {legalReferent?.email && (
              <span className="flex items-center gap-1"><IconMail width={11} height={11} className="text-[var(--ds-text-subtle)]" /> {legalReferent.email}</span>
            )}
            {showRecruitmentInHeader && (
              <>
                <span className="text-[var(--ds-text-subtle)]">|</span>
                {recruitmentReferent?.name && (
                  <span className="flex items-center gap-1"><IconUser width={11} height={11} className="text-[var(--ds-text-subtle)]" /> {recruitmentReferent.name}{recruitmentReferent.function ? ` (${recruitmentReferent.function})` : ''} <span className="text-[10px] text-[var(--ds-text-subtle)]">(recrutement)</span></span>
                )}
                {recruitmentReferent?.phone && (
                  <span className="flex items-center gap-1"><IconPhone width={11} height={11} className="text-[var(--ds-text-subtle)]" /> {recruitmentReferent.phone}</span>
                )}
                {recruitmentReferent?.email && (
                  <span className="flex items-center gap-1"><IconMail width={11} height={11} className="text-[var(--ds-text-subtle)]" /> {recruitmentReferent.email}</span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {ab && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAbDetail(true)}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 py-2 text-sm font-semibold text-[var(--ds-text-muted)] shadow-sm transition-all hover:border-blue hover:text-blue md:px-4"
            title="Voir l'analyse de besoin"
          >
            <IconEye width={16} height={16} />
            <span className="hidden md:inline">Voir l'AB</span>
          </button>
          <div className="flex items-center gap-2 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 py-2 shadow-sm" title="Changer le statut de l'analyse de besoin — onglet de la liste matching">
            <span className="text-xs font-medium text-[var(--ds-text-subtle)]">Statut</span>
            <select
              value={ab.abStatus ?? 'AUTO'}
              onChange={handleAbStatusChange}
              disabled={abStatusSaving}
              className="cursor-pointer bg-transparent text-sm font-semibold text-[var(--ds-text)] outline-none disabled:opacity-50"
            >
              <option value="AUTO">Automatique</option>
              <option value="ACTIVE">Actif</option>
              <option value="ARCHIVED">Archivé</option>
              <option value="INACTIVE">Inactif</option>
            </select>
          </div>
          {canEdit && (
            <>
              {confirmDelete ? (
                <div className="flex items-center gap-2 rounded-xl border border-[var(--ds-danger)] bg-[var(--ds-danger-bg)] px-3 py-2">
                  <span className="text-xs font-medium text-[var(--ds-danger)]">Supprimer cette AB ?</span>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface)] px-2.5 py-1 text-xs font-medium text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-sunken)]"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleteResult.fetching}
                    className="rounded-lg bg-[var(--ds-danger)] px-2.5 py-1 text-xs font-medium text-white hover:bg-[var(--ds-danger)] disabled:opacity-50"
                  >
                    {deleteResult.fetching ? 'Suppression…' : 'Confirmer'}
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center justify-center gap-2 rounded-xl border border-[var(--ds-danger)] bg-[var(--ds-surface)] px-3 py-2 text-sm font-semibold text-[var(--ds-danger)] shadow-sm transition-all hover:bg-[var(--ds-danger-bg)] md:px-4"
                    title="Supprimer l'analyse du besoin"
                  >
                    <IconTrash width={16} height={16} />
                    <span className="hidden md:inline">Supprimer</span>
                  </button>
                  <EditNeedsAnalysisButton
                    needsAnalysisData={ab}
                    currentUser={currentUser!}
                    companyId={info?.id ?? fallbackCompanyId}
                    companyName={info?.name ?? fallbackName}
                    onSuccess={onEdited}
                  />
                </>
              )}
            </>
          )}
        </div>
      )}
      {showAbDetail && (
        <ABDetailModal id={needsAnalysisId} onClose={() => setShowAbDetail(false)} />
      )}
    </div>
  )
}

export default function Matching() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const currentUser = useCurrentUser()
  const needsAnalysisId = searchParams.get('needsAnalysis')
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)

  const [jobsResult, reexecuteJobsQuery] = useQuery({
    query: OFFERS_BY_NEEDS_ANALYSIS,
    variables: { needsAnalysisId },
    pause: !needsAnalysisId,
    context: {
      url: `${import.meta.env.VITE_API_URL}/api/graphql/offers`,
    },
  })

  const jobs: Job[] = jobsResult.data?.offersByNeedsAnalysis ?? []

  // ?offer= (lien de notification) : se synchronise dans selectedJobId à chaque
  // changement (notamment quand on clique sur une notification déjà sur la page).
  const offerFromUrl = searchParams.get('offer')
  useEffect(() => {
    if (offerFromUrl) setSelectedJobId(offerFromUrl)
  }, [offerFromUrl])

  const effectiveJobId = selectedJobId ?? searchParams.get('offer')
  const selectedJob = jobs.find((j) => j.id === effectiveJobId) ?? null

  if (jobsResult.fetching) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <IconLoader width={28} height={28} className="animate-spin text-blue" />
        <p className="text-sm text-[var(--ds-text-subtle)]">Chargement des offres…</p>
      </div>
    )
  }

  if (jobsResult.error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-danger/20 bg-[var(--ds-danger-bg)] px-6 py-8 text-center">
          <IconAlert width={28} height={28} className="text-[var(--ds-danger)]" />
          <p className="text-sm font-medium text-[var(--ds-danger)]">Erreur de chargement</p>
          <p className="text-xs text-[var(--ds-danger)]">{jobsResult.error.message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      {/* Top bar — infos de l'analyse de besoin */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-[var(--ds-border)] bg-[var(--ds-surface)] backdrop-blur-sm">
        {needsAnalysisId && (
          <AbHeader
            needsAnalysisId={needsAnalysisId}
            currentUser={currentUser}
            fallbackName={jobs[0]?.companyName}
            fallbackCompanyId={jobs[0]?.companyInfos?.id}
            onBack={() => navigate('/rh/matching')}
            onEdited={reexecuteJobsQuery}
          />
        )}
      </div>

      {/* Two-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* ─ Left: Job list ─ */}
        <div className="w-[360px] shrink-0 flex flex-col border-r border-[var(--ds-border)] bg-[var(--ds-surface-sunken)] overflow-y-auto">
          <div className="px-4 pt-4 pb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ds-text-subtle)]">Offres entreprises</p>
          </div>
          {jobs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center px-6">
              <IconCompany width={28} height={28} className="text-[var(--ds-text-subtle)]" />
              <p className="text-sm text-[var(--ds-text-subtle)]">Aucune offre pour cette analyse de besoin</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 px-4 pb-6">
              {jobs.map((job) => (
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
          <RightPanel selectedJob={selectedJob} currentUser={currentUser} onJobDeleted={() => { setSelectedJobId(null); reexecuteJobsQuery() }} />
        </div>
      </div>
    </div>
  )
}

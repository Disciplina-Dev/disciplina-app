import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IconAlert, IconArrowLeft, IconCheck, IconChevronLeft, IconChevronRight, IconEye, IconFile, IconLoader, IconSend } from '@/components/ui/icons'
import {
  getMatchCandidates,
  submitMatchAnswers,
  MatchAuthError,
  MatchCompletedError,
  PROPOSED_ANSWER_TO_STATUS,
  type ProposedCandidateView,
  type ProposedAnswer,
  type SubmitAnswerPayload,
} from '@/api/match'
import { getExternalProfile } from '@/api/external'
import { REGION_TIMEZONE } from '@/lib/timezone'
import ExternalExpiryNotice from '@/features/external/components/ExternalExpiryNotice'
import ExternalGuestCloseButton from '@/features/external/components/ExternalGuestCloseButton'
import CandidateComparator from '@/features/publicMatch/components/CandidateComparator'
import AnswerControls from '@/features/publicMatch/components/AnswerControls'
import InterviewProposalForm from '@/features/publicMatch/components/InterviewProposalForm'
import RefusalCommentForm from '@/features/publicMatch/components/RefusalCommentForm'

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-[var(--ds-surface-sunken)] p-6">{children}</div>
}

const ANSWER_BADGE: Record<ProposedAnswer, { label: string; className: string }> = {
  FAVORITE: { label: 'Coup de cœur', className: 'bg-purple text-white' },
  ACCEPTED: { label: 'Accepté', className: 'bg-success text-white' },
  REFUSED: { label: 'Refusé', className: 'bg-danger text-white' },
}

function initialsOf(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

export default function MatchComparator() {
  const { signature = '' } = useParams()
  const navigate = useNavigate()

  const [candidates, setCandidates] = useState<ProposedCandidateView[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  // null = vue liste/grille ; un id = vue détail du candidat (affichage actuel).
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, ProposedAnswer>>({})
  const [slots, setSlots] = useState<string[]>([''])
  const [location, setLocation] = useState('')
  const [comments, setComments] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  // Fuseau du tenant, nécessaire pour saisir les créneaux : cette page est
  // hors session staff (/external/matching/:signature), donc AppUser.region
  // n'est pas disponible ici.
  const [timezone, setTimezone] = useState(REGION_TIMEZONE.reunion)

  useEffect(() => {
    getMatchCandidates(signature)
      .then(setCandidates)
      .catch((e) => {
        if (e instanceof MatchAuthError) {
          navigate(`/external/authenticate?sig=${signature}`, { replace: true })
          return
        }
        setLoadError(e instanceof Error ? e.message : 'Erreur')
      })
    getExternalProfile(signature)
      .then((profile) => {
        setExpiresAt(profile.expiresAt)
        if (profile.timezone) setTimezone(profile.timezone)
      })
      .catch(() => {})
  }, [signature, navigate])

  const setAnswer = (candidateId: string, answer: ProposedAnswer) => {
    setAnswers((prev) => {
      const next = { ...prev }
      if (answer === 'FAVORITE') {
        for (const key of Object.keys(next)) if (next[key] === 'FAVORITE') delete next[key]
      }
      next[candidateId] = answer
      return next
    })
  }

  const submit = async () => {
    if (!candidates) return
    setBusy(true)
    setLoadError(null)
    const cleanSlots = slots.map((s) => s.trim()).filter(Boolean)
    const cleanLocation = location.trim() || undefined
    const payload: SubmitAnswerPayload[] = candidates.map((candidate) => {
      const answer = answers[candidate.id]
      const withSlots = answer === 'ACCEPTED' || answer === 'FAVORITE'
      const comment = answer === 'REFUSED' ? comments[candidate.id]?.trim() || undefined : undefined
      return {
        candidateId: candidate.id,
        status: PROPOSED_ANSWER_TO_STATUS[answer],
        interviewSlots: withSlots ? cleanSlots : undefined,
        interviewLocation: withSlots ? cleanLocation : undefined,
        comment,
      }
    })
    try {
      await submitMatchAnswers(signature, payload)
      setDone(true)
    } catch (e) {
      if (e instanceof MatchCompletedError) {
        setDone(true)
        return
      }
      setLoadError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setBusy(false)
    }
  }

  const total = candidates?.length ?? 0
  const selectedIndex = candidates?.findIndex((c) => c.id === selectedId) ?? -1
  const current = selectedIndex >= 0 && candidates ? candidates[selectedIndex] : null
  const goPrev = () => {
    if (!candidates || selectedIndex <= 0) return
    setSelectedId(candidates[selectedIndex - 1].id)
  }
  const goNext = () => {
    if (!candidates || selectedIndex < 0 || selectedIndex >= candidates.length - 1) return
    setSelectedId(candidates[selectedIndex + 1].id)
  }

  useEffect(() => {
    if (!current || total === 0) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) return
      if (e.key === 'ArrowLeft') goPrev()
      else goNext()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, selectedId])

  if (loadError) {
    return (
      <Centered>
        <div className="flex flex-col items-center gap-3 text-center">
          <IconAlert width={32} height={32} className="text-[var(--ds-danger)]" />
          <p className="text-[13px] text-[var(--ds-text-subtle)]">{loadError}</p>
        </div>
      </Centered>
    )
  }

  if (done) {
    return (
      <Centered>
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--ds-success-bg)] text-[var(--ds-success)]">
            <IconCheck width={30} height={30} />
          </div>
          <p className="text-[17px] font-extrabold text-[var(--ds-text)]">Merci pour vos réponses</p>
          <p className="text-[13px] text-[var(--ds-text-subtle)]">Votre conseiller a été notifié et reviendra vers vous.</p>
        </div>
      </Centered>
    )
  }

  if (!candidates) {
    return (
      <Centered>
        <IconLoader width={28} height={28} className="animate-spin text-purple" />
      </Centered>
    )
  }

  if (candidates.length === 0) {
    return (
      <Centered>
        <p className="text-[13px] text-[var(--ds-text-subtle)]">Aucun candidat à afficher.</p>
      </Centered>
    )
  }

  const answeredCount = candidates.filter((c) => answers[c.id]).length
  const allAnswered = candidates.every((c) => answers[c.id])
  const hasSelection = candidates.some((c) => answers[c.id] === 'ACCEPTED' || answers[c.id] === 'FAVORITE')

  const submitBlock = (
    <>
      {hasSelection && (
        <div className="mt-4 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-5 shadow-sm">
          <InterviewProposalForm
            slots={slots}
            onChange={setSlots}
            location={location}
            onLocationChange={setLocation}
            signature={signature}
            timezone={timezone}
          />
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] font-bold text-[var(--ds-text-muted)]">
          {answeredCount} / {candidates.length} candidat{candidates.length > 1 ? 's' : ''} traité{answeredCount > 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-3">
          {!allAnswered && <p className="text-[12px] text-[var(--ds-text-subtle)]">Répondez à tous les candidats pour valider.</p>}
          <button
            onClick={submit}
            disabled={busy || !allAnswered}
            className="flex items-center gap-2 rounded-lg bg-purple px-5 py-2.5 text-[14px] font-bold text-white hover:bg-purple-dark disabled:opacity-50"
          >
            {busy ? <IconLoader width={16} height={16} className="animate-spin" /> : <IconSend width={16} height={16} />} Valider mes réponses
          </button>
        </div>
      </div>
    </>
  )

  // ── Vue liste/grille ──────────────────────────────────────────────
  if (!current) {
    return (
      <div className="min-h-screen bg-[var(--ds-surface-sunken)] px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-[20px] font-extrabold text-[var(--ds-text)]">Candidats proposés</h1>
              <ExternalExpiryNotice expiresAt={expiresAt} />
            </div>
            <div className="pt-1">
              <ExternalGuestCloseButton signature={signature} onClosed={() => setDone(true)} />
            </div>
          </div>
          <p className="mb-5 text-[13px] text-[var(--ds-text-subtle)]">
            {candidates.length} CV{candidates.length > 1 ? 's' : ''} proposé{candidates.length > 1 ? 's' : ''} — cliquez sur un candidat pour voir son CV et donner votre réponse.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {candidates.map((candidate) => {
              const name = candidate.fullName ?? 'Candidat'
              const answer = answers[candidate.id] ?? null
              const badge = answer ? ANSWER_BADGE[answer] : null
              return (
                <article
                  key={candidate.id}
                  className="flex flex-col rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-5 shadow-sm transition hover:border-purple hover:shadow-md"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(candidate.id)}
                    aria-label={`Voir le CV de ${name}`}
                    className="flex flex-1 flex-col items-start gap-3 text-left"
                  >
                    <div className="flex w-full items-center gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-purple/10 text-[16px] font-extrabold text-purple">
                        {initialsOf(candidate.fullName)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-[16px] font-extrabold text-[var(--ds-text)]">{name}</h2>
                        <p className="mt-0.5 flex flex-wrap gap-x-2 text-[13px] text-[var(--ds-text-subtle)]">
                          {candidate.age != null && <span>{candidate.age} ans</span>}
                          {candidate.city && <span>{candidate.city}</span>}
                        </p>
                      </div>
                      {badge ? (
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${badge.className}`}>{badge.label}</span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-[var(--ds-surface-sunken)] px-2.5 py-1 text-[11px] font-bold text-[var(--ds-text-subtle)]">
                          À traiter
                        </span>
                      )}
                    </div>
                    <p className="line-clamp-3 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--ds-text-muted)]">
                      {candidate.description || 'Aucune note du conseiller.'}
                    </p>
                    <span className="mt-auto inline-flex items-center gap-1.5 pt-1 text-[13px] font-bold text-purple">
                      <IconFile width={15} height={15} /> Voir le CV
                      <IconEye width={15} height={15} />
                    </span>
                  </button>
                  <div className="mt-3 border-t border-[var(--ds-border)] pt-3" onClick={(e) => e.stopPropagation()}>
                    <AnswerControls value={answer} onChange={(a) => setAnswer(candidate.id, a)} />
                  </div>
                </article>
              )
            })}
          </div>

          {submitBlock}
        </div>
      </div>
    )
  }

  // ── Vue détail (affichage actuel d'un candidat) ────────────────────
  const isCurrentRefused = answers[current.id] === 'REFUSED'

  return (
    <div className="min-h-screen bg-[var(--ds-surface-sunken)] px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            aria-label="Retour à la liste des candidats"
            className="inline-flex items-center gap-2 rounded-xl bg-purple px-5 py-2.5 text-[14px] font-extrabold text-white shadow-md transition hover:bg-purple-dark"
          >
            <IconArrowLeft width={18} height={18} /> Retour à la liste
          </button>
          <div className="flex shrink-0 items-center gap-2">
            <ExternalGuestCloseButton signature={signature} onClosed={() => setDone(true)} />
            <div className="flex items-center gap-2">
            <button
              onClick={goPrev}
              disabled={selectedIndex === 0}
              aria-label="Candidat précédent"
              title="Candidat précédent"
              className="rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-2.5 text-[var(--ds-text-muted)] shadow-sm hover:border-purple hover:text-purple disabled:opacity-40 disabled:hover:border-[var(--ds-border)] disabled:hover:text-[var(--ds-text-muted)]"
            >
              <IconChevronLeft width={20} height={20} />
            </button>
            <span className="min-w-12 text-center text-[14px] font-bold text-[var(--ds-text-muted)]">
              {selectedIndex + 1} / {candidates.length}
            </span>
            <button
              onClick={goNext}
              disabled={selectedIndex === candidates.length - 1}
              aria-label="Candidat suivant"
              title="Candidat suivant"
              className="rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-2.5 text-[var(--ds-text-muted)] shadow-sm hover:border-purple hover:text-purple disabled:opacity-40 disabled:hover:border-[var(--ds-border)] disabled:hover:text-[var(--ds-text-muted)]"
            >
              <IconChevronRight width={20} height={20} />
            </button>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <h1 className="text-[20px] font-extrabold text-[var(--ds-text)]">Candidats proposés</h1>
          <ExternalExpiryNotice expiresAt={expiresAt} />
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={goPrev}
            disabled={selectedIndex === 0}
            aria-label="Candidat précédent"
            title="Candidat précédent"
            className="flex h-12 w-12 shrink-0 items-center justify-center self-center rounded-full border border-[var(--ds-border)] bg-[var(--ds-surface)] text-[var(--ds-text-muted)] shadow-md transition hover:border-purple hover:bg-purple hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-[var(--ds-border)] disabled:hover:bg-[var(--ds-surface)] disabled:hover:text-[var(--ds-text-muted)] sm:h-16 sm:w-16"
          >
            <IconChevronLeft width={30} height={30} strokeWidth={2.5} />
          </button>

          <div className="min-w-0 flex-1">
            <CandidateComparator signature={signature} candidate={current} />
          </div>

          <button
            onClick={goNext}
            disabled={selectedIndex === candidates.length - 1}
            aria-label="Candidat suivant"
            title="Candidat suivant"
            className="flex h-12 w-12 shrink-0 items-center justify-center self-center rounded-full border border-[var(--ds-border)] bg-[var(--ds-surface)] text-[var(--ds-text-muted)] shadow-md transition hover:border-purple hover:bg-purple hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-[var(--ds-border)] disabled:hover:bg-[var(--ds-surface)] disabled:hover:text-[var(--ds-text-muted)] sm:h-16 sm:w-16"
          >
            <IconChevronRight width={30} height={30} strokeWidth={2.5} />
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-5 shadow-sm">
          <p className="mb-2 text-[13px] font-bold text-[var(--ds-text)]">Votre décision pour {current.fullName ?? 'ce candidat'}</p>
          <AnswerControls value={answers[current.id] ?? null} onChange={(a) => setAnswer(current.id, a)} />
        </div>

        {isCurrentRefused && (
          <div className="mt-4 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-5 shadow-sm">
            <RefusalCommentForm
              value={comments[current.id] ?? ''}
              onChange={(comment) => setComments((prev) => ({ ...prev, [current.id]: comment }))}
            />
          </div>
        )}

        {submitBlock}
      </div>
    </div>
  )
}

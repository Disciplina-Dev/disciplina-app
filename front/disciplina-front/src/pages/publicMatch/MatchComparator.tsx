import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, Check, Send } from 'lucide-react'
import {
  getMatchCandidates,
  submitMatchAnswers,
  type ProposedCandidateView,
  type ProposedAnswer,
  type SubmitAnswerPayload,
} from '@/api/match'
import { useGuestMatchTokenStore } from '@/store/guestMatchTokenStore'
import CandidateComparator from '@/features/publicMatch/components/CandidateComparator'
import AnswerControls from '@/features/publicMatch/components/AnswerControls'
import InterviewProposalForm from '@/features/publicMatch/components/InterviewProposalForm'
import RefusalCommentForm from '@/features/publicMatch/components/RefusalCommentForm'

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">{children}</div>
}

export default function MatchComparator() {
  const { signature = '' } = useParams()
  const navigate = useNavigate()
  const token = useGuestMatchTokenStore((s) => s.token)
  const clearToken = useGuestMatchTokenStore((s) => s.clearToken)

  const [candidates, setCandidates] = useState<ProposedCandidateView[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, ProposedAnswer>>({})
  const [slots, setSlots] = useState<string[]>([''])
  const [comments, setComments] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) {
      navigate(`/public/match?sig=${signature}`)
      return
    }
    getMatchCandidates(signature, token)
      .then(setCandidates)
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Erreur'))
  }, [signature, token, navigate])

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
    if (!token || !candidates) return
    setBusy(true)
    setLoadError(null)
    const cleanSlots = slots.map((s) => s.trim()).filter(Boolean)
    const payload: SubmitAnswerPayload[] = candidates.map((candidate) => {
      const answer = answers[candidate.id]
      const withSlots = answer === 'ACCEPTED' || answer === 'FAVORITE'
      const comment = answer === 'REFUSED' ? comments[candidate.id]?.trim() || undefined : undefined
      return { candidateId: candidate.id, answer, interviewSlots: withSlots ? cleanSlots : undefined, comment }
    })
    try {
      await submitMatchAnswers(signature, token, payload)
      clearToken()
      setDone(true)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setBusy(false)
    }
  }

  if (loadError) {
    return (
      <Centered>
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle size={32} className="text-danger" />
          <p className="text-[13px] text-gray-500">{loadError}</p>
        </div>
      </Centered>
    )
  }

  if (done) {
    return (
      <Centered>
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 text-green-600">
            <Check size={30} />
          </div>
          <p className="text-[17px] font-extrabold text-gray-900">Merci pour vos réponses</p>
          <p className="text-[13px] text-gray-500">Votre conseiller a été notifié et reviendra vers vous.</p>
        </div>
      </Centered>
    )
  }

  if (!candidates) {
    return (
      <Centered>
        <Loader2 size={28} className="animate-spin text-purple" />
      </Centered>
    )
  }

  if (candidates.length === 0) {
    return (
      <Centered>
        <p className="text-[13px] text-gray-500">Aucun candidat à afficher.</p>
      </Centered>
    )
  }

  const current = candidates[index]
  const allAnswered = candidates.every((c) => answers[c.id])
  const hasSelection = candidates.some((c) => answers[c.id] === 'ACCEPTED' || answers[c.id] === 'FAVORITE')
  const isCurrentRefused = answers[current.id] === 'REFUSED'

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-[20px] font-extrabold text-gray-900">Candidats proposés</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-[13px] font-bold text-gray-700">
              {index + 1} / {candidates.length}
            </span>
            <button
              onClick={() => setIndex((i) => Math.min(candidates.length - 1, i + 1))}
              disabled={index === candidates.length - 1}
              className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <CandidateComparator signature={signature} token={token!} candidate={current} />

        <div className="mt-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="mb-2 text-[13px] font-bold text-gray-800">Votre décision pour {current.fullName ?? 'ce candidat'}</p>
          <AnswerControls value={answers[current.id] ?? null} onChange={(a) => setAnswer(current.id, a)} />
        </div>

        {hasSelection && (
          <div className="mt-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <InterviewProposalForm slots={slots} onChange={setSlots} />
          </div>
        )}

        {isCurrentRefused && (
          <div className="mt-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <RefusalCommentForm
              value={comments[current.id] ?? ''}
              onChange={(comment) => setComments((prev) => ({ ...prev, [current.id]: comment }))}
            />
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          {!allAnswered && <p className="text-[12px] text-gray-400">Répondez à tous les candidats pour valider.</p>}
          <button
            onClick={submit}
            disabled={busy || !allAnswered}
            className="flex items-center gap-2 rounded-lg bg-purple px-5 py-2.5 text-[14px] font-bold text-white hover:bg-purple-dark disabled:opacity-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Valider mes réponses
          </button>
        </div>
      </div>
    </div>
  )
}

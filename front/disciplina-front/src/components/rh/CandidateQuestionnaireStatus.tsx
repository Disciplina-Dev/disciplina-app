import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchCandidateAttempts } from '@/api/questionnaire'
import type { AttemptListItem, QuestionnaireProgress } from '@/types/questionnaire'

interface Props {
  candidateId: string
  /** Progression SSE poussée sur la fiche (clé = tentative). */
  live: Record<string, QuestionnaireProgress>
}

/**
 * Suivi en direct des tests internes en attente ou en cours sur la fiche candidat.
 * Le résultat final, lui, s'affiche dans le bloc score existant (format ClassMarker).
 */
export default function CandidateQuestionnaireStatus({ candidateId, live }: Props) {
  const [attempts, setAttempts] = useState<AttemptListItem[]>([])
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    fetchCandidateAttempts(candidateId).then(setAttempts).catch(() => setAttempts([]))
  }, [candidateId])

  // Nouvelle invitation vue en SSE et absente de la liste : on recharge.
  const liveIds = Object.keys(live).join(',')
  useEffect(() => {
    if (!liveIds) return
    if (liveIds.split(',').some((id) => !attempts.some((a) => a._id === id))) {
      fetchCandidateAttempts(candidateId).then(setAttempts).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveIds, candidateId])

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const open = attempts
    .map((a) => {
      const l = live[a._id]
      return l ? { ...a, status: l.status, current_index: l.current_index, deadline: l.deadline } : a
    })
    .filter((a) => (a.status === 'invited' && new Date(a.expires_at).getTime() > now) || a.status === 'in_progress')

  if (open.length === 0) return null

  return (
    <div className="md:col-span-2 rounded-[var(--radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4" aria-live="polite">
      <p className="mb-2 text-sm font-bold text-[var(--ds-text)]">Tests en cours</p>
      <ul className="space-y-2 text-sm">
        {open.map((a) => {
          const remaining = a.status === 'in_progress' && a.deadline
            ? new Date(a.deadline).getTime() - now
            : new Date(a.expires_at).getTime() - now
          const minutes = Math.max(0, Math.ceil(remaining / 60000))
          return (
            <li key={a._id} className="flex flex-wrap items-center justify-between gap-2">
              <Link to={`/rh/questionnaires/resultats/${a._id}`} className="font-medium text-[var(--ds-text)] hover:underline">{a.questionnaire_title}</Link>
              <span className={a.status === 'in_progress' ? 'font-semibold text-purple' : 'text-[var(--ds-text-subtle)]'}>
                {a.status === 'in_progress'
                  ? `Question ${Math.min(a.current_index + 1, a.question_count)}/${a.question_count} — ${minutes} min restantes`
                  : `Invité — lien valable ${minutes} min`}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

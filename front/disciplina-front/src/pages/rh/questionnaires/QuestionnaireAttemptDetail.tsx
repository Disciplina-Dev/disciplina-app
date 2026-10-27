import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge, Button, LoadingPanel, PageHeader } from '@/components/ui'
import { IconArrowLeft, IconCheckCircle, IconCircle, IconErrorCircle, IconDownload, IconForbidden, IconUpload } from '@/components/ui/icons'
import { cancelAttempt, fetchAttempt, fetchAttemptPdf, resendAttemptPdf } from '@/api/questionnaire'
import { toast } from '@/store/toastStore'
import type { AttemptDetail } from '@/types/questionnaire'
import { ATTEMPT_STATUS, QUESTION_TYPE_LABEL, downloadBlob, formatDateTime, formatDuration } from './labels'

export default function QuestionnaireAttemptDetail() {
  const { attemptId = '' } = useParams()
  const [attempt, setAttempt] = useState<AttemptDetail | null>(null)
  const [busy, setBusy] = useState<'pdf' | 'download' | 'cancel' | null>(null)

  const load = () => {
    fetchAttempt(attemptId).then(setAttempt).catch((err) => toast.error(err, 'Passage introuvable'))
  }
  useEffect(load, [attemptId])

  if (!attempt) return <LoadingPanel message="Chargement du passage…" />

  const resend = async () => {
    setBusy('pdf')
    try {
      await resendAttemptPdf(attempt._id)
      toast.success('PDF déposé sur le Google Drive du candidat')
    } catch (err) {
      toast.errorMessage('Envoi du PDF impossible', err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(null)
    }
  }

  const download = async () => {
    setBusy('download')
    try {
      const { blob, fileName } = await fetchAttemptPdf(attempt._id)
      downloadBlob(blob, fileName)
    } catch (err) {
      toast.errorMessage('Téléchargement du PDF impossible', err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(null)
    }
  }

  const cancel = async () => {
    if (!window.confirm('Invalider ce passage ? Le candidat ne pourra plus répondre ; générez ensuite un nouveau lien.')) return
    setBusy('cancel')
    try {
      await cancelAttempt(attempt._id)
      load()
    } catch (err) {
      toast.errorMessage('Annulation impossible', err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(null)
    }
  }

  const status = ATTEMPT_STATUS[attempt.status]

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/rh/questionnaires/resultats" className="mb-3 flex items-center gap-1.5 text-sm text-[var(--ds-text-subtle)] hover:text-[var(--ds-text)]">
        <IconArrowLeft width={15} height={15} /> Résultats
      </Link>
      <PageHeader
        eyebrow={attempt.questionnaire.title}
        title={attempt.is_test_run ? 'Passage de test (correcteur)' : attempt.candidate_name || 'Candidat'}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            {attempt.candidate_id && <Link to={`/rh/candidats/${attempt.candidate_id}`} className="underline">Voir la fiche candidat</Link>}
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {(attempt.status === 'invited' || attempt.status === 'in_progress') && (
              <Button variant="secondary" leftIcon={<IconForbidden width={16} height={16} />} onClick={cancel} isLoading={busy === 'cancel'}>
                Invalider
              </Button>
            )}
            {attempt.status === 'completed' && (
              <Button variant="secondary" leftIcon={<IconDownload width={16} height={16} />} onClick={download} isLoading={busy === 'download'}>
                Télécharger le PDF
              </Button>
            )}
            {attempt.status === 'completed' && !attempt.is_test_run && (
              <Button leftIcon={<IconUpload width={16} height={16} />} onClick={resend} isLoading={busy === 'pdf'}>
                Envoyer le PDF sur Drive
              </Button>
            )}
          </div>
        }
      />

      <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Score" value={attempt.score ? `${Math.round(attempt.score.percentage)} %` : '—'}
          hint={attempt.score ? `${attempt.score.points_scored} / ${attempt.score.points_available} pt · seuil ${attempt.questionnaire.pass_threshold} %` : undefined} />
        <Stat label="Résultat" value={attempt.score ? (attempt.score.passed ? 'Réussi' : 'Échoué') : '—'} hint="Indicatif : la décision reste humaine" />
        <Stat label="Durée" value={formatDuration(attempt.started_at, attempt.completed_at)} hint={`Commencé ${formatDateTime(attempt.started_at)}`} />
        <Stat label="Sorties d’onglet" value={String(attempt.tab_switch_count)} hint="Informatif, aucune pénalité" />
      </dl>

      <ol className="space-y-3">
        {attempt.questions.map((q, i) => {
          const a = q.answer
          const state = !a || a.skipped ? 'none' : a.correct ? 'ok' : 'ko'
          return (
            <li key={q.id} className="rounded-[var(--radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-semibold text-[var(--ds-text)]">
                  {i + 1}. <span className="whitespace-pre-line">{q.text}</span>
                </p>
                <span className={`flex items-center gap-1 text-sm font-semibold ${state === 'ok' ? 'text-[var(--ds-success)]' : state === 'ko' ? 'text-[var(--ds-danger)]' : 'text-[var(--ds-text-subtle)]'}`}>
                  {state === 'ok' ? <IconCheckCircle width={16} height={16} /> : state === 'ko' ? <IconErrorCircle width={16} height={16} /> : <IconCircle width={16} height={16} />}
                  {state === 'ok' ? 'Correct' : state === 'ko' ? 'Incorrect' : a?.skipped ? 'Passée' : 'Sans réponse'} · {a?.points ?? 0}/{q.points_available} pt
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--ds-text-subtle)]">
                {QUESTION_TYPE_LABEL[q.type]}
                {a?.time_spent_seconds != null && ` · ${a.time_spent_seconds} s`}
              </p>
              {q.type === 'text' && (
                <div className="mt-3 space-y-1.5 text-sm">
                  <p className={`rounded-lg px-3 py-2 ${state === 'ok' ? 'bg-[var(--ds-success-bg)] text-[var(--ds-success)]' : state === 'ko' ? 'bg-[var(--ds-danger-bg)] text-[var(--ds-danger)]' : 'text-[var(--ds-text-subtle)]'}`}>
                    <span className="text-xs font-semibold">Réponse du candidat : </span>
                    {a?.text_answer || '—'}
                  </p>
                  <p className="px-3 text-[var(--ds-text-muted)]">
                    <span className="text-xs font-semibold">Réponse(s) acceptée(s) : </span>
                    {q.accepted_answers.join(' · ')}
                  </p>
                </div>
              )}
              <ul className="mt-3 space-y-1.5 text-sm">
                {q.choices.map((c) => {
                  const chosen = a?.choice_ids.includes(c.id)
                  return (
                    <li key={c.id} className={`rounded-lg px-3 py-2 ${c.correct ? 'bg-[var(--ds-success-bg)] text-[var(--ds-success)]' : chosen ? 'bg-[var(--ds-danger-bg)] text-[var(--ds-danger)]' : 'text-[var(--ds-text-muted)]'}`}>
                      {c.text}
                      {(c.correct || chosen) && (
                        <span className="ml-2 text-xs font-semibold">
                          ({[chosen && 'choix du candidat', c.correct && 'bonne réponse'].filter(Boolean).join(', ')})
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--ds-text-subtle)]">{label}</dt>
      <dd className="mt-1 text-xl font-extrabold text-[var(--ds-text)]">{value}</dd>
      {hint && <dd className="mt-1 text-xs text-[var(--ds-text-subtle)]">{hint}</dd>}
    </div>
  )
}

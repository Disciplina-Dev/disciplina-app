import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  IconAlert,
  IconCheck,
  IconCheckCircle,
  IconClock,
  IconErrorCircle,
  IconLoader,
  IconShieldCheck,
} from '@/components/ui/icons'
import {
  PublicTestError,
  answerPublicTest,
  fetchPublicTest,
  reportTabSwitch,
  startPublicTest,
} from '@/api/questionnaire'
import type { AnswerFeedback, PublicAttemptState, PublicQuestion } from '@/types/questionnaire'

// Page publique du questionnaire interne (lien / QR code, sans compte).
// Tout l'état fait foi côté serveur : chrono, question courante, correction.

const ERROR_MESSAGES: Record<string, string> = {
  not_found: "Ce lien n'est pas valide. Demandez un nouveau lien à votre interlocuteur.",
  device: 'Ce test a déjà été ouvert sur un autre appareil. Rapprochez-vous de votre interlocuteur pour obtenir un nouveau lien.',
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function PublicTest() {
  const { token = '' } = useParams()
  const [state, setState] = useState<PublicAttemptState | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Décalage horloge serveur − horloge locale : le chrono affiché suit le serveur.
  const [clockOffset, setClockOffset] = useState(0)

  const applyState = useCallback((next: PublicAttemptState) => {
    setClockOffset(new Date(next.server_now).getTime() - Date.now())
    setState(next)
  }, [])

  const handleError = useCallback((err: unknown) => {
    if (err instanceof PublicTestError) {
      setError(ERROR_MESSAGES[err.code] ?? err.message)
    } else {
      setError('Connexion impossible. Vérifiez votre réseau puis rechargez la page.')
    }
  }, [])

  const reload = useCallback(() => {
    fetchPublicTest(token).then(applyState).catch(handleError)
  }, [token, applyState, handleError])

  useEffect(() => { reload() }, [reload])

  if (error) {
    return (
      <Shell>
        <Message icon={<IconAlert width={32} height={32} className="text-[var(--ds-danger)]" />} title="Test indisponible">
          {error}
        </Message>
      </Shell>
    )
  }

  if (!state) {
    return (
      <Shell>
        <div className="flex justify-center py-24" role="status" aria-label="Chargement">
          <IconLoader width={28} height={28} className="animate-spin text-[var(--ds-accent)]" />
        </div>
      </Shell>
    )
  }

  if (state.status === 'invited') {
    return <Welcome token={token} state={state} onStarted={applyState} onError={handleError} />
  }
  if (state.status === 'in_progress') {
    return (
      <Running
        token={token}
        state={state}
        clockOffset={clockOffset}
        onState={applyState}
        onReload={reload}
        onError={handleError}
      />
    )
  }
  if (state.status === 'completed') {
    return (
      <Shell>
        <Message icon={<IconCheckCircle width={40} height={40} className="text-[var(--ds-success)]" />} title="Merci, vos réponses ont été envoyées">
          <span className="block">{state.title}</span>
          <span className="mt-6 block text-[44px] font-extrabold leading-none text-[var(--ds-text)]">
            {Math.round(state.percentage ?? 0)} %
          </span>
          <span className="mt-2 block">de bonnes réponses</span>
          <span className="mt-6 block text-[13px]">
            {state.is_test_run
              ? 'Mode test : aucun résultat n’a été enregistré.'
              : 'Votre interlocuteur reviendra vers vous. Ce score est un repère : il ne décide pas seul de la suite.'}
          </span>
        </Message>
      </Shell>
    )
  }
  return (
    <Shell>
      <Message icon={<IconClock width={32} height={32} className="text-[var(--ds-warning)]" />} title={state.status === 'expired' ? 'Ce lien a expiré' : 'Ce lien n’est plus valide'}>
        Demandez un nouveau lien à votre interlocuteur.
      </Message>
    </Shell>
  )
}

// ── Accueil + identification ──

function Welcome({
  token,
  state,
  onStarted,
  onError,
}: {
  token: string
  state: PublicAttemptState
  onStarted: (s: PublicAttemptState) => void
  onError: (e: unknown) => void
}) {
  const [notMe, setNotMe] = useState(false)
  const [starting, setStarting] = useState(false)

  const start = async () => {
    setStarting(true)
    try {
      onStarted(await startPublicTest(token))
    } catch (err) {
      onError(err)
    } finally {
      setStarting(false)
    }
  }

  return (
    <Shell>
      <div className="flex flex-col gap-6 px-5 pb-32 pt-8">
        <div>
          {state.is_test_run && (
            <p className="mb-3 inline-block rounded-full bg-[var(--ds-warning-bg)] px-3 py-1 text-xs font-semibold text-[var(--ds-warning)]">
              Mode test — aucun résultat enregistré
            </p>
          )}
          <h1 className="text-[26px] font-extrabold leading-tight text-[var(--ds-text)]">{state.title}</h1>
          {state.description && (
            <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-[var(--ds-text-muted)]">{state.description}</p>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-3">
          <Fact label="Durée" value={`${state.duration_minutes} min`} />
          <Fact label="Questions" value={String(state.question_count)} />
        </dl>

        <ul className="space-y-2 text-[14px] leading-relaxed text-[var(--ds-text-muted)]">
          <li>• Une question par page. Pas de panique : lisez bien chaque énoncé.</li>
          <li>• Une fois validée, une réponse ne peut plus être modifiée.</li>
          <li>• Le chrono démarre quand vous appuyez sur « Commencer » et continue même si vous quittez la page.</li>
          {state.allow_skip && <li>• Vous pouvez passer une question (elle compte 0 point).</li>}
        </ul>

        {state.candidate && (
          <section className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4" aria-labelledby="identity-title">
            <h2 id="identity-title" className="text-[15px] font-bold text-[var(--ds-text)]">Vous êtes bien…</h2>
            <p className="mt-2 text-[18px] font-semibold text-[var(--ds-text)]">{state.candidate.full_name}</p>
            {state.candidate.email_masked && (
              <p className="text-[14px] text-[var(--ds-text-subtle)]">{state.candidate.email_masked}</p>
            )}
            {notMe ? (
              <p className="mt-3 rounded-lg bg-[var(--ds-warning-bg)] p-3 text-[14px] text-[var(--ds-warning)]" role="alert">
                Ne commencez pas ce test : rapprochez-vous de votre interlocuteur pour obtenir votre propre lien.
              </p>
            ) : (
              <button type="button" onClick={() => setNotMe(true)} className="mt-3 min-h-[44px] text-[14px] font-medium text-[var(--ds-accent)] underline underline-offset-2">
                Ce n’est pas moi
              </button>
            )}
          </section>
        )}

        <details className="rounded-2xl bg-[var(--ds-surface-sunken)] p-4 text-[13px] leading-relaxed text-[var(--ds-text-muted)]">
          <summary className="flex min-h-[44px] cursor-pointer items-center gap-2 font-semibold text-[var(--ds-text)]">
            <IconShieldCheck width={18} height={18} /> Vos données personnelles
          </summary>
          <div className="mt-2 space-y-2">
            <p>
              <strong>Responsable :</strong> Disciplina. <strong>Finalité :</strong> évaluer votre positionnement dans le cadre de votre
              candidature. <strong>Base légale :</strong> mesures précontractuelles prises à votre demande.
            </p>
            <p>
              Vos réponses et votre score sont hébergés par Disciplina, sans transfert hors de l’Union européenne, et conservés avec
              votre dossier de candidature, puis supprimés avec lui. Un lien jamais utilisé est effacé dès son expiration.
            </p>
            <p>
              Le score aide votre interlocuteur ; la décision reste toujours humaine (aucune décision entièrement automatisée).
              Vous pouvez accéder à vos réponses, les faire rectifier ou effacer en écrivant au délégué à la protection des données
              (coordonnées dans la politique de confidentialité).
            </p>
          </div>
        </details>
      </div>

      <BottomBar>
        <button
          type="button"
          onClick={start}
          disabled={starting || notMe}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--ds-accent)] text-[16px] font-bold text-[var(--ds-text-inverse)] disabled:opacity-50"
        >
          {starting && <IconLoader width={18} height={18} className="animate-spin" />}
          {state.candidate ? 'C’est bien moi, commencer' : 'Commencer'}
        </button>
      </BottomBar>
    </Shell>
  )
}

// ── Passage ──

function Running({
  token,
  state,
  clockOffset,
  onState,
  onReload,
  onError,
}: {
  token: string
  state: PublicAttemptState
  clockOffset: number
  onState: (s: PublicAttemptState) => void
  onReload: () => void
  onError: (e: unknown) => void
}) {
  const question = state.question
  const total = state.question_count
  const index = state.current_index ?? 0
  // Sélection et confirmation rattachées à la question : une nouvelle question repart à vide.
  const [selection, setSelection] = useState<{ qid?: string; ids: string[]; text: string; confirm: boolean }>({ ids: [], text: '', confirm: false })
  const selected = selection.qid === question?.id ? selection.ids : []
  const typed = selection.qid === question?.id ? selection.text : ''
  const confirmLast = selection.qid === question?.id && selection.confirm
  const setSelected = (update: (prev: string[]) => string[]) =>
    setSelection({ qid: question?.id, ids: update(selected), text: typed, confirm: false })
  const setTyped = (text: string) => setSelection({ qid: question?.id, ids: selected, text, confirm: false })
  const setConfirmLast = (confirm: boolean) => setSelection({ qid: question?.id, ids: selected, text: typed, confirm })
  const isText = question?.type === 'text'
  const hasAnswer = isText ? typed.trim() !== '' : selected.length > 0
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ data: AnswerFeedback; question: PublicQuestion; next: PublicAttemptState } | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [netError, setNetError] = useState<string | null>(null)

  // Chrono : tick local, recalé sur l'horloge serveur. À 0, le serveur clôture
  // (avec sa marge réseau) : on recharge l'état juste après.
  const deadline = state.deadline ? new Date(state.deadline).getTime() : 0
  const remaining = deadline - (now + clockOffset)
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const timeUpHandled = useRef(false)
  useEffect(() => {
    if (remaining > 0 || timeUpHandled.current) return
    timeUpHandled.current = true
    const id = window.setTimeout(onReload, 11_000)
    return () => window.clearTimeout(id)
  }, [remaining, onReload])

  // Changement d'onglet / sortie de l'app : compté côté serveur (informatif).
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') reportTabSwitch(token).catch(() => {})
      else onReload()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [token, onReload])

  // Bouton retour du navigateur : on reste sur la question courante.
  useEffect(() => {
    window.history.pushState(null, '', window.location.href)
    const onPop = () => window.history.pushState(null, '', window.location.href)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const isLast = index === total - 1

  const submit = async (skip = false) => {
    if (!question) return
    if (isLast && !confirmLast && !skip) {
      setConfirmLast(true)
      return
    }
    setSubmitting(true)
    setNetError(null)
    try {
      const res = await answerPublicTest(token, question.id, selected, skip, isText ? typed : undefined)
      if (res.feedback) setFeedback({ data: res.feedback, question, next: res.state })
      else onState(res.state)
    } catch (err) {
      if (err instanceof PublicTestError && (err.code === 'wrong_question' || err.code === 'not_in_progress')) {
        // Réponse déjà enregistrée (double envoi, autre onglet) ou temps écoulé : on resynchronise.
        onReload()
      } else if (err instanceof PublicTestError) {
        onError(err)
      } else {
        // Réseau coupé : rien n'est perdu côté serveur, on propose de réessayer.
        setNetError('Connexion perdue. Vos réponses précédentes sont enregistrées : réessayez.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const toggle = (id: string) => {
    if (!question) return
    if (question.type === 'multiple') {
      setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    } else {
      setSelected(() => [id])
    }
  }

  const timerTone =
    remaining <= 60_000 ? 'text-[var(--ds-danger)] bg-[var(--ds-danger-bg)]'
      : remaining <= 5 * 60_000 ? 'text-[var(--ds-warning)] bg-[var(--ds-warning-bg)]'
        : 'text-[var(--ds-text)] bg-[var(--ds-surface-sunken)]'

  const shown = feedback?.question ?? question
  const shownIndex = feedback ? index : index
  const progress = Math.round(((feedback ? index + 1 : index) / Math.max(total, 1)) * 100)

  return (
    <Shell>
      <header className="sticky top-0 z-10 border-b border-[var(--ds-border)] bg-[var(--ds-surface)]/95 px-5 pb-3 pt-4 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[15px] font-bold text-[var(--ds-text)]">
            Question {Math.min(shownIndex + 1, total)} / {total}
          </p>
          <p className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[15px] font-bold tabular-nums ${timerTone}`} aria-label={`Temps restant ${formatRemaining(remaining)}`}>
            <IconClock width={16} height={16} aria-hidden="true" />
            {formatRemaining(remaining)}
          </p>
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--ds-surface-sunken)]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={feedback ? index + 1 : index}
          aria-label="Progression"
        >
          <div className="h-full rounded-full bg-[var(--ds-accent)] transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
      </header>

      {shown && (
        <main className="px-5 pb-36 pt-6">
          <h1 className="whitespace-pre-line text-[19px] font-bold leading-snug text-[var(--ds-text)]">{shown.text}</h1>
          <p className="mt-2 text-[13px] text-[var(--ds-text-subtle)]">
            {shown.type === 'text' ? 'Tapez votre réponse' : shown.type === 'multiple' ? 'Plusieurs réponses possibles' : 'Une seule réponse attendue'}
          </p>

          {shown.type === 'text' && (
            <div className="mt-5">
              <label htmlFor={`q-${shown.id}`} className="sr-only">Votre réponse</label>
              <input
                id={`q-${shown.id}`}
                type="text"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                maxLength={200}
                value={typed}
                disabled={!!feedback || submitting}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && hasAnswer && !submitting) submit(false) }}
                placeholder="Votre réponse"
                className={`h-14 w-full rounded-2xl border-2 bg-[var(--ds-surface)] px-4 text-[16px] text-[var(--ds-text)] outline-none focus:border-[var(--ds-accent)] ${
                  feedback ? (feedback.data.correct ? 'border-[var(--ds-success)]' : 'border-[var(--ds-danger)]') : 'border-[var(--ds-border)]'
                }`}
              />
              {feedback && !feedback.data.correct && feedback.data.accepted_answers && (
                <p className="mt-3 rounded-2xl bg-[var(--ds-success-bg)] p-4 text-[15px] text-[var(--ds-success)]">
                  Réponse attendue : <strong>{feedback.data.accepted_answers.join(' / ')}</strong>
                </p>
              )}
            </div>
          )}

          <fieldset className="mt-5 space-y-3" disabled={!!feedback || submitting}>
            <legend className="sr-only">Réponses</legend>
            {shown.choices.map((choice) => {
              const isSelected = selected.includes(choice.id)
              const isRight = feedback?.data.correct_choice_ids.includes(choice.id)
              const fbClass = feedback
                ? isRight
                  ? 'border-[var(--ds-success)] bg-[var(--ds-success-bg)]'
                  : isSelected
                    ? 'border-[var(--ds-danger)] bg-[var(--ds-danger-bg)]'
                    : 'border-[var(--ds-border)] opacity-60'
                : isSelected
                  ? 'border-[var(--ds-accent)] bg-[var(--ds-accent-soft)]'
                  : 'border-[var(--ds-border)] bg-[var(--ds-surface)]'
              return (
                <label
                  key={choice.id}
                  className={`flex min-h-[56px] cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-3 text-[16px] text-[var(--ds-text)] transition-colors ${fbClass}`}
                >
                  <input
                    type={shown.type === 'multiple' ? 'checkbox' : 'radio'}
                    name={`q-${shown.id}`}
                    className="h-5 w-5 shrink-0 accent-[var(--ds-accent)]"
                    checked={isSelected}
                    onChange={() => toggle(choice.id)}
                  />
                  <span className="flex-1">{choice.text}</span>
                  {feedback && isRight && <IconCheck width={20} height={20} className="text-[var(--ds-success)]" aria-label="Bonne réponse" />}
                </label>
              )
            })}
          </fieldset>

          <div aria-live="polite">
            {feedback && (
              <p
                className={`mt-5 flex items-center gap-2 rounded-2xl p-4 text-[15px] font-semibold ${
                  feedback.data.correct ? 'bg-[var(--ds-success-bg)] text-[var(--ds-success)]' : 'bg-[var(--ds-danger-bg)] text-[var(--ds-danger)]'
                }`}
              >
                {feedback.data.correct ? <IconCheckCircle width={22} height={22} /> : <IconErrorCircle width={22} height={22} />}
                {feedback.data.correct ? 'Correct' : shown?.type === 'text' ? 'Incorrect' : 'Incorrect — la bonne réponse est indiquée en vert'}
              </p>
            )}
            {confirmLast && !feedback && (
              <p className="mt-5 rounded-2xl bg-[var(--ds-accent-soft)] p-4 text-[14px] text-[var(--ds-text)]">
                C’est la dernière question : appuyez à nouveau pour terminer le test.
              </p>
            )}
            {netError && (
              <p className="mt-5 rounded-2xl bg-[var(--ds-warning-bg)] p-4 text-[14px] text-[var(--ds-warning)]" role="alert">{netError}</p>
            )}
          </div>
        </main>
      )}

      <BottomBar>
        {feedback ? (
          <PrimaryButton onClick={() => { const next = feedback.next; setFeedback(null); onState(next) }}>
            {feedback.next.status === 'completed' ? 'Voir mon résultat' : 'Question suivante'}
          </PrimaryButton>
        ) : (
          <div className="flex gap-3">
            {state.allow_skip && (
              <button
                type="button"
                onClick={() => submit(true)}
                disabled={submitting}
                className="h-14 shrink-0 rounded-2xl border border-[var(--ds-border)] px-5 text-[15px] font-semibold text-[var(--ds-text-muted)] disabled:opacity-50"
              >
                Passer
              </button>
            )}
            <PrimaryButton onClick={() => submit(false)} disabled={!hasAnswer || submitting} loading={submitting}>
              {isLast ? (confirmLast ? 'Terminer le test' : 'Valider') : 'Valider'}
            </PrimaryButton>
          </div>
        )}
      </BottomBar>
    </Shell>
  )
}

// ── Gabarit ──

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 bg-[var(--ds-surface-sunken)] pb-24">
      <div className="mx-auto min-h-screen max-w-xl bg-[var(--ds-surface)] sm:border-x sm:border-[var(--ds-border)]">{children}</div>
    </div>
  )
}

function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-[var(--ds-border)] bg-[var(--ds-surface)]/95 backdrop-blur">
      <div className="mx-auto max-w-xl px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">{children}</div>
    </div>
  )
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  loading,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  loading?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-14 flex-1 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--ds-accent)] text-[16px] font-bold text-[var(--ds-text-inverse)] disabled:opacity-50"
    >
      {loading && <IconLoader width={18} height={18} className="animate-spin" />}
      {children}
    </button>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[var(--ds-surface-sunken)] p-4">
      <dt className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ds-text-subtle)]">{label}</dt>
      <dd className="mt-1 text-[20px] font-extrabold text-[var(--ds-text)]">{value}</dd>
    </div>
  )
}

function Message({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      {icon}
      <h1 className="text-[20px] font-extrabold text-[var(--ds-text)]">{title}</h1>
      <p className="max-w-sm text-[15px] leading-relaxed text-[var(--ds-text-muted)]">{children}</p>
    </div>
  )
}

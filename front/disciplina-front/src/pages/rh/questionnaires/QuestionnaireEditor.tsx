import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, LoadingPanel, PageHeader } from '@/components/ui'
import {
  IconArrowLeft,
  IconChevronDown,
  IconChevronUp,
  IconCopy,
  IconLock,
  IconPlay,
  IconPlus,
  IconSave,
  IconTrash,
} from '@/components/ui/icons'
import {
  createQuestionnaire,
  duplicateQuestionnaire,
  fetchQuestionnaire,
  startTestRun,
  updateQuestionnaire,
} from '@/api/questionnaire'
import { toast } from '@/store/toastStore'
import { TitleProfessionalType } from '@/types/candidate'
import type { Questionnaire, QuestionnaireQuestion, QuestionType } from '@/types/questionnaire'
import { QUESTIONNAIRE_STATUS, QUESTION_TYPE_LABEL } from './labels'

type Draft = Pick<
  Questionnaire,
  'title' | 'description' | 'tp_types' | 'duration_minutes' | 'pass_threshold' | 'immediate_feedback' | 'allow_skip' | 'shuffle_choices' | 'questions'
>

const EMPTY: Draft = {
  title: '',
  description: '',
  tp_types: [],
  duration_minutes: 20,
  pass_threshold: 50,
  immediate_feedback: false,
  allow_skip: false,
  shuffle_choices: false,
  questions: [],
}

const uid = () => crypto.randomUUID()

function newQuestion(type: QuestionType = 'single'): QuestionnaireQuestion {
  if (type === 'text') {
    return { _id: uid(), type, text: '', points: 1, choices: [], accepted_answers: [''] }
  }
  if (type === 'true_false') {
    return {
      _id: uid(), type, text: '', points: 1,
      choices: [{ _id: uid(), text: 'Vrai', correct: true }, { _id: uid(), text: 'Faux', correct: false }],
    }
  }
  return {
    _id: uid(), type, text: '', points: 1,
    choices: [{ _id: uid(), text: '', correct: true }, { _id: uid(), text: '', correct: false }],
  }
}

/** Contrôles locaux (le serveur revalide tout) : on signale tôt les blocs incomplets. */
function questionIssues(q: QuestionnaireQuestion): string[] {
  const issues: string[] = []
  if (!q.text.trim()) issues.push('énoncé vide')
  if (q.type === 'text') {
    const accepted = q.accepted_answers ?? []
    if (accepted.length === 0) issues.push('aucune réponse acceptée')
    if (accepted.some((a) => !a.trim())) issues.push('réponse acceptée vide')
    return issues
  }
  if (q.choices.some((c) => !c.text.trim())) issues.push('choix vide')
  const correct = q.choices.filter((c) => c.correct).length
  if (correct === 0) issues.push('aucune bonne réponse')
  if (q.type !== 'multiple' && correct > 1) issues.push('une seule bonne réponse attendue')
  return issues
}

const inputClass =
  'w-full rounded-[10px] border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 py-2.5 text-sm text-[var(--ds-text)] outline-none focus:border-[var(--ds-accent)] disabled:opacity-60'

/** Une instance par questionnaire : passer de « nouveau » à l'id créé repart d'un état propre. */
export default function QuestionnaireEditorRoute() {
  const { id = 'nouveau' } = useParams()
  return <QuestionnaireEditor key={id} id={id} />
}

function QuestionnaireEditor({ id }: { id: string }) {
  const navigate = useNavigate()
  const isNew = id === 'nouveau'
  const [meta, setMeta] = useState<Questionnaire | null>(null)
  const [draft, setDraft] = useState<Draft | null>(isNew ? EMPTY : null)
  const [selected, setSelected] = useState(0)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (isNew) return
    fetchQuestionnaire(id)
      .then((q) => {
        setMeta(q)
        setDraft({
          title: q.title,
          description: q.description ?? '',
          tp_types: q.tp_types,
          duration_minutes: q.duration_minutes,
          pass_threshold: q.pass_threshold,
          immediate_feedback: q.immediate_feedback,
          allow_skip: q.allow_skip,
          shuffle_choices: q.shuffle_choices,
          questions: q.questions,
        })
      })
      .catch((err) => {
        toast.error(err, 'Questionnaire introuvable')
        navigate('/rh/questionnaires')
      })
  }, [id, isNew, navigate])

  if (!draft) return <LoadingPanel message="Chargement du questionnaire…" />

  const locked = meta?.locked ?? false
  const update = (patch: Partial<Draft>) => {
    setDraft({ ...draft, ...patch })
    setDirty(true)
  }
  const setQuestions = (questions: QuestionnaireQuestion[]) => update({ questions })
  const patchQuestion = (index: number, patch: Partial<QuestionnaireQuestion>) =>
    setQuestions(draft.questions.map((q, i) => (i === index ? { ...q, ...patch } : q)))

  const addQuestion = () => {
    setQuestions([...draft.questions, newQuestion()])
    setSelected(draft.questions.length)
  }
  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= draft.questions.length) return
    const next = [...draft.questions]
    ;[next[index], next[target]] = [next[target], next[index]]
    setQuestions(next)
    setSelected(target)
  }
  const duplicate = (index: number) => {
    const src = draft.questions[index]
    const copy = { ...src, _id: uid(), choices: src.choices.map((c) => ({ ...c, _id: uid() })) }
    const next = [...draft.questions]
    next.splice(index + 1, 0, copy)
    setQuestions(next)
    setSelected(index + 1)
  }
  const remove = (index: number) => {
    setQuestions(draft.questions.filter((_, i) => i !== index))
    setSelected(Math.max(0, Math.min(selected, draft.questions.length - 2)))
  }

  const save = async () => {
    setSaving(true)
    setServerError(null)
    try {
      if (isNew) {
        const created = await createQuestionnaire(draft)
        toast.success('Questionnaire créé', 'Il est en brouillon : testez-le puis activez-le.')
        setDirty(false)
        navigate(`/rh/questionnaires/${created._id}`, { replace: true })
      } else {
        const saved = await updateQuestionnaire(id, draft)
        setMeta(saved)
        setDirty(false)
        toast.success('Questionnaire enregistré')
      }
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Enregistrement impossible')
    } finally {
      setSaving(false)
    }
  }

  const testIt = async () => {
    try {
      const inv = await startTestRun(id)
      window.open(inv.url, '_blank', 'noopener')
    } catch (err) {
      toast.errorMessage('Test impossible', err instanceof Error ? err.message : undefined)
    }
  }

  const duplicateV2 = async () => {
    try {
      const copy = await duplicateQuestionnaire(id)
      navigate(`/rh/questionnaires/${copy._id}`)
    } catch (err) {
      toast.error(err)
    }
  }

  const q = draft.questions[selected]
  const totalPoints = draft.questions.reduce((s, x) => s + (Number(x.points) || 0), 0)
  const issueCount = draft.questions.filter((x) => questionIssues(x).length > 0).length

  return (
    <div className="mx-auto max-w-6xl">
      <button type="button" onClick={() => navigate('/rh/questionnaires')} className="mb-3 flex items-center gap-1.5 text-sm text-[var(--ds-text-subtle)] hover:text-[var(--ds-text)]">
        <IconArrowLeft width={15} height={15} /> Questionnaires
      </button>
      <PageHeader
        title={isNew ? 'Nouveau questionnaire' : draft.title || 'Sans titre'}
        description={
          meta ? (
            <span className="flex flex-wrap items-center gap-2">
              <Badge tone={QUESTIONNAIRE_STATUS[meta.status].tone}>{QUESTIONNAIRE_STATUS[meta.status].label}</Badge>
              <span>Version {meta.version}</span>
              {locked && <span className="inline-flex items-center gap-1"><IconLock width={13} height={13} /> Déjà passé : lecture seule</span>}
            </span>
          ) : 'Construisez le test bloc par bloc : une question par bloc.'
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {!isNew && meta?.status !== 'archived' && (
              <Button variant="secondary" leftIcon={<IconPlay width={16} height={16} />} onClick={testIt} disabled={dirty} title={dirty ? 'Enregistrez avant de tester' : undefined}>
                Tester
              </Button>
            )}
            {locked ? (
              <Button leftIcon={<IconCopy width={16} height={16} />} onClick={duplicateV2}>Dupliquer en v{(meta?.version ?? 1) + 1}</Button>
            ) : (
              <Button leftIcon={<IconSave width={16} height={16} />} onClick={save} isLoading={saving} disabled={!dirty && !isNew}>
                Enregistrer
              </Button>
            )}
          </div>
        }
      />

      {serverError && (
        <pre className="mb-4 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--ds-danger-bg)] p-3 text-xs text-[var(--ds-danger)]" role="alert">{serverError}</pre>
      )}

      <div className="space-y-6">
        {/* Paramètres */}
        <section className="rounded-[var(--radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-5">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-[var(--ds-text-subtle)]">Paramètres</h2>
          <fieldset disabled={locked} className="grid gap-4 md:grid-cols-2">
            <label className="md:col-span-2 text-sm font-medium text-[var(--ds-text-muted)]">
              Titre
              <input className={`${inputClass} mt-1`} value={draft.title} maxLength={200} onChange={(e) => update({ title: e.target.value })} placeholder="Positionnement NTC" />
            </label>
            <label className="md:col-span-2 text-sm font-medium text-[var(--ds-text-muted)]">
              Consigne affichée au candidat
              <textarea className={`${inputClass} mt-1 min-h-[80px]`} value={draft.description ?? ''} maxLength={2000} onChange={(e) => update({ description: e.target.value })} />
            </label>
            <label className="text-sm font-medium text-[var(--ds-text-muted)]">
              Durée (minutes)
              <input type="number" min={1} max={240} className={`${inputClass} mt-1`} value={draft.duration_minutes} onChange={(e) => update({ duration_minutes: Number(e.target.value) })} />
            </label>
            <label className="text-sm font-medium text-[var(--ds-text-muted)]">
              Seuil de réussite (%) — vu par le RH uniquement
              <input type="number" min={0} max={100} className={`${inputClass} mt-1`} value={draft.pass_threshold} onChange={(e) => update({ pass_threshold: Number(e.target.value) })} />
            </label>
            <div className="md:col-span-2">
              <p className="text-sm font-medium text-[var(--ds-text-muted)]">TP visé(s)</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.values(TitleProfessionalType).map((tp) => {
                  const on = draft.tp_types.includes(tp)
                  return (
                    <button key={tp} type="button" aria-pressed={on}
                      onClick={() => update({ tp_types: on ? draft.tp_types.filter((t) => t !== tp) : [...draft.tp_types, tp] })}
                      className={`min-h-[36px] rounded-full px-3 text-sm font-semibold ring-1 ${on ? 'bg-[var(--ds-accent-soft)] text-[var(--ds-accent)] ring-[var(--ds-accent)]' : 'text-[var(--ds-text-muted)] ring-[var(--ds-border)]'}`}>
                      {tp}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="md:col-span-2 grid gap-2 sm:grid-cols-3">
              <Toggle label="Feedback immédiat (correct / incorrect)" checked={draft.immediate_feedback} onChange={(v) => update({ immediate_feedback: v })} />
              <Toggle label="Autoriser à passer une question" checked={draft.allow_skip} onChange={(v) => update({ allow_skip: v })} />
              <Toggle label="Mélanger l’ordre des réponses" checked={draft.shuffle_choices} onChange={(v) => update({ shuffle_choices: v })} />
            </div>
          </fieldset>
        </section>

        {/* Éditeur par blocs */}
        <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="rounded-[var(--radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-3">
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="text-sm font-bold text-[var(--ds-text)]">{draft.questions.length} question(s) · {totalPoints} pt</h2>
            </div>
            {issueCount > 0 && <p className="mb-2 px-1 text-xs text-[var(--ds-warning)]">{issueCount} bloc(s) incomplet(s)</p>}
            <ol className="space-y-1">
              {draft.questions.map((x, i) => {
                const issues = questionIssues(x)
                return (
                  <li key={x._id}>
                    <button type="button" onClick={() => setSelected(i)}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm ${i === selected ? 'bg-[var(--ds-accent-soft)] text-[var(--ds-accent)]' : 'text-[var(--ds-text)] hover:bg-[var(--ds-surface-sunken)]'}`}>
                      <span className="font-semibold">{i + 1}.</span> {x.text.trim() ? x.text.slice(0, 60) : <em className="text-[var(--ds-text-subtle)]">Sans énoncé</em>}
                      {issues.length > 0 && <span className="ml-1 text-[var(--ds-warning)]" title={issues.join(', ')}>⚠</span>}
                    </button>
                  </li>
                )
              })}
            </ol>
            {!locked && (
              <Button className="mt-3 w-full" variant="subtle" leftIcon={<IconPlus width={16} height={16} />} onClick={addQuestion}>
                Ajouter une question
              </Button>
            )}
          </div>

          <fieldset disabled={locked} className="rounded-[var(--radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-5">
            {!q ? (
              <p className="py-12 text-center text-sm text-[var(--ds-text-subtle)]">Ajoutez une première question avec « + Ajouter une question ».</p>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-bold text-[var(--ds-text)]">Question {selected + 1}</h2>
                  {!locked && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" aria-label="Monter" onClick={() => move(selected, -1)} disabled={selected === 0}><IconChevronUp width={16} height={16} /></Button>
                      <Button size="sm" variant="ghost" aria-label="Descendre" onClick={() => move(selected, 1)} disabled={selected === draft.questions.length - 1}><IconChevronDown width={16} height={16} /></Button>
                      <Button size="sm" variant="ghost" aria-label="Dupliquer la question" onClick={() => duplicate(selected)}><IconCopy width={16} height={16} /></Button>
                      <Button size="sm" variant="ghost" aria-label="Supprimer la question" onClick={() => remove(selected)}><IconTrash width={16} height={16} /></Button>
                    </div>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
                  <label className="text-sm font-medium text-[var(--ds-text-muted)]">
                    Type
                    <select className={`${inputClass} mt-1`} value={q.type}
                      onChange={(e) => {
                        const type = e.target.value as QuestionType
                        const fresh = newQuestion(type)
                        // Changement de famille (vrai/faux, réponse libre) : on repart des réponses par défaut.
                        const reset = [type, q.type].some((t) => t === 'true_false' || t === 'text')
                        patchQuestion(selected, reset
                          ? { type, choices: fresh.choices, accepted_answers: fresh.accepted_answers }
                          : { type, choices: type === 'single' ? q.choices.map((c, i) => ({ ...c, correct: i === q.choices.findIndex((x) => x.correct) })) : q.choices })
                      }}>
                      {(Object.keys(QUESTION_TYPE_LABEL) as QuestionType[]).map((t) => <option key={t} value={t}>{QUESTION_TYPE_LABEL[t]}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-medium text-[var(--ds-text-muted)]">
                    Points
                    <input type="number" min={0.5} max={100} step={0.5} className={`${inputClass} mt-1`} value={q.points} onChange={(e) => patchQuestion(selected, { points: Number(e.target.value) })} />
                  </label>
                </div>
                <label className="block text-sm font-medium text-[var(--ds-text-muted)]">
                  Énoncé
                  <textarea className={`${inputClass} mt-1 min-h-[90px]`} value={q.text} maxLength={2000} onChange={(e) => patchQuestion(selected, { text: e.target.value })} />
                </label>
                {q.type === 'text' ? (
                  <AcceptedAnswers
                    answers={q.accepted_answers ?? []}
                    locked={locked}
                    onChange={(accepted_answers) => patchQuestion(selected, { accepted_answers })}
                  />
                ) : (
                <div>
                  <p className="text-sm font-medium text-[var(--ds-text-muted)]">
                    Réponses — cochez {q.type === 'multiple' ? 'la ou les bonnes réponses' : 'la bonne réponse'}
                  </p>
                  <ul className="mt-2 space-y-2">
                    {q.choices.map((c, ci) => (
                      <li key={c._id} className="flex items-center gap-2">
                        <input
                          type={q.type === 'multiple' ? 'checkbox' : 'radio'}
                          name={`correct-${q._id}`}
                          aria-label={`Bonne réponse : choix ${ci + 1}`}
                          className="h-5 w-5 shrink-0 accent-[var(--ds-success)]"
                          checked={c.correct}
                          onChange={() =>
                            patchQuestion(selected, {
                              choices: q.choices.map((x, xi) =>
                                q.type === 'multiple' ? (xi === ci ? { ...x, correct: !x.correct } : x) : { ...x, correct: xi === ci },
                              ),
                            })
                          }
                        />
                        <input className={inputClass} value={c.text} maxLength={500} disabled={locked || q.type === 'true_false'}
                          placeholder={`Choix ${ci + 1}`}
                          onChange={(e) => patchQuestion(selected, { choices: q.choices.map((x, xi) => (xi === ci ? { ...x, text: e.target.value } : x)) })} />
                        {q.type !== 'true_false' && !locked && q.choices.length > 2 && (
                          <Button size="sm" variant="ghost" aria-label={`Retirer le choix ${ci + 1}`} onClick={() => patchQuestion(selected, { choices: q.choices.filter((_, xi) => xi !== ci) })}>
                            <IconTrash width={14} height={14} />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {q.type !== 'true_false' && !locked && q.choices.length < 10 && (
                    <Button className="mt-2" size="sm" variant="ghost" leftIcon={<IconPlus width={14} height={14} />}
                      onClick={() => patchQuestion(selected, { choices: [...q.choices, { _id: uid(), text: '', correct: false }] })}>
                      Ajouter un choix
                    </Button>
                  )}
                </div>
                )}
                {questionIssues(q).length > 0 && (
                  <p className="text-xs text-[var(--ds-warning)]">À compléter : {questionIssues(q).join(', ')}</p>
                )}
              </div>
            )}
          </fieldset>
        </section>
      </div>
    </div>
  )
}

function AcceptedAnswers({ answers, locked, onChange }: { answers: string[]; locked: boolean; onChange: (answers: string[]) => void }) {
  return (
    <div>
      <p className="text-sm font-medium text-[var(--ds-text-muted)]">Réponses acceptées</p>
      <p className="mt-1 text-xs text-[var(--ds-text-subtle)]">
        Le candidat tape sa réponse. Majuscules, espaces en trop et ponctuation finale sont ignorés ; les accents comptent.
      </p>
      <ul className="mt-2 space-y-2">
        {answers.map((a, ai) => (
          <li key={ai} className="flex items-center gap-2">
            <input className={inputClass} value={a} maxLength={200} placeholder={`Réponse acceptée ${ai + 1}`}
              onChange={(e) => onChange(answers.map((x, xi) => (xi === ai ? e.target.value : x)))} />
            {!locked && answers.length > 1 && (
              <Button size="sm" variant="ghost" aria-label={`Retirer la réponse ${ai + 1}`} onClick={() => onChange(answers.filter((_, xi) => xi !== ai))}>
                <IconTrash width={14} height={14} />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {!locked && answers.length < 10 && (
        <Button className="mt-2" size="sm" variant="ghost" leftIcon={<IconPlus width={14} height={14} />} onClick={() => onChange([...answers, ''])}>
          Ajouter une variante
        </Button>
      )}
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--ds-text)] ring-1 ring-[var(--ds-border)]">
      <input type="checkbox" className="h-4 w-4 accent-[var(--ds-accent)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

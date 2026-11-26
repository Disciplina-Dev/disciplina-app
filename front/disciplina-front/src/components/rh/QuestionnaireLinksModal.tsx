import { useEffect, useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import {
  IconAlert,
  IconArrowLeft,
  IconCheck,
  IconClipboardCheck,
  IconClose,
  IconCopy,
  IconDownload,
  IconLoader,
  IconRefresh,
} from '@/components/ui/icons'
import Button from '@/components/ui/Button'
import { fetchActiveQuestionnaires, inviteCandidate } from '@/api/questionnaire'
import type { Invitation, QuestionnaireProgress, QuestionnaireSummary } from '@/types/questionnaire'

interface QuestionnaireLinksModalProps {
  open: boolean
  onClose: () => void
  candidateId: string
  candidateName: string
  /** Progression SSE de la fiche, pour afficher l'état du lien en direct. */
  live: Record<string, QuestionnaireProgress>
  /** Transition : accès aux anciens liens ClassMarker. */
  onOpenLegacy?: () => void
}

const LIVE_LABEL: Record<QuestionnaireProgress['status'], string> = {
  invited: 'Lien envoyé, pas encore commencé',
  in_progress: 'En cours',
  completed: 'Terminé — résultat sur la fiche',
  expired: 'Lien expiré',
  cancelled: 'Lien invalidé',
}

export default function QuestionnaireLinksModal({ open, onClose, candidateId, candidateName, live, onOpenLegacy }: QuestionnaireLinksModalProps) {
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<QuestionnaireSummary | null>(null)
  const [validity, setValidity] = useState(15)
  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)
  const qrRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    closeBtnRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    fetchActiveQuestionnaires()
      .then(setQuestionnaires)
      .catch((err) => setError(err instanceof Error ? err.message : 'Chargement impossible'))
  }, [open])

  useEffect(() => {
    if (!invitation) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [invitation])

  if (!open) return null

  const generate = async () => {
    if (!selected) return
    setGenerating(true)
    setError(null)
    try {
      setInvitation(await inviteCandidate(selected._id, candidateId, validity))
      setNow(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Génération impossible')
    } finally {
      setGenerating(false)
    }
  }

  const copy = async () => {
    if (!invitation) return
    try {
      await navigator.clipboard.writeText(invitation.url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch { setCopied(false) }
  }

  const downloadQr = () => {
    const canvas = qrRef.current?.querySelector('canvas')
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `qr-test-${candidateName.replace(/[^\p{L}\p{N}]+/gu, '_')}.png`
    a.click()
  }

  const liveState = invitation ? live[invitation.attempt_id] : undefined
  const remainingMs = invitation ? new Date(invitation.expires_at).getTime() - now : 0
  const linkUsable = invitation && remainingMs > 0 && (!liveState || liveState.status === 'invited')
  const mm = Math.max(0, Math.floor(remainingMs / 60000))
  const ss = Math.max(0, Math.floor((remainingMs % 60000) / 1000))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="q-modal-title">
      <div className="absolute inset-0 bg-[var(--ds-text)]/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-[var(--ds-surface)] shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--ds-border)] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: 'var(--color-purple-light)' }}>
              <IconClipboardCheck width={18} height={18} style={{ color: 'var(--color-purple)' }} />
            </div>
            <div>
              <h2 id="q-modal-title" className="text-lg font-bold text-[var(--ds-text)]">Envoyer un test</h2>
              <p className="mt-0.5 text-xs text-[var(--ds-text-subtle)]">{candidateName}</p>
            </div>
          </div>
          <button ref={closeBtnRef} onClick={onClose} className="rounded-full p-2 text-[var(--ds-text-subtle)] hover:bg-[var(--ds-surface-sunken)]" aria-label="Fermer">
            <IconClose width={20} height={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 flex items-start gap-3 rounded-lg bg-[var(--ds-danger-bg)] p-4 text-[var(--ds-danger)]" role="alert">
              <IconAlert width={18} height={18} className="mt-0.5 shrink-0" />
              <div className="text-sm">{error}</div>
            </div>
          )}

          {!selected ? (
            questionnaires === null ? (
              <div className="flex items-center justify-center gap-3 py-16 text-[var(--ds-text-subtle)]">
                <IconLoader width={20} height={20} className="animate-spin" /> <span className="text-sm">Chargement…</span>
              </div>
            ) : questionnaires.length === 0 ? (
              <p className="py-12 text-center text-sm text-[var(--ds-text-subtle)]">
                Aucun questionnaire actif. Créez-en un dans <strong>Questionnaires</strong>.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {questionnaires.map((q) => (
                  <button key={q._id} type="button" onClick={() => { setSelected(q); setInvitation(null) }}
                    className="rounded-xl border border-[var(--ds-border)] p-4 text-left transition-all hover:border-purple hover:shadow-md">
                    <p className="text-sm font-semibold text-[var(--ds-text)]">{q.title}</p>
                    <p className="mt-1 text-xs text-[var(--ds-text-subtle)]">
                      {q.question_count} questions · {q.duration_minutes} min{q.tp_types.length ? ` · ${q.tp_types.join(', ')}` : ''}
                    </p>
                  </button>
                ))}
              </div>
            )
          ) : (
            <div className="mx-auto max-w-md">
              <button type="button" onClick={() => { setSelected(null); setInvitation(null) }} className="mb-4 flex items-center gap-1.5 text-sm font-medium text-[var(--ds-text-subtle)] hover:text-[var(--ds-text)]">
                <IconArrowLeft width={15} height={15} /> Tous les tests
              </button>
              <h3 className="text-base font-bold text-[var(--ds-text)]">{selected.title}</h3>
              <p className="text-xs text-[var(--ds-text-subtle)]">{selected.question_count} questions · {selected.duration_minutes} min</p>

              {!invitation ? (
                <div className="mt-5 space-y-4">
                  <label className="block text-sm font-medium text-[var(--ds-text-muted)]">
                    Validité du lien avant de commencer (minutes)
                    <input type="number" min={1} max={10080} value={validity} onChange={(e) => setValidity(Number(e.target.value))}
                      className="mt-1 w-full rounded-[10px] border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 py-2.5 text-sm text-[var(--ds-text)] outline-none focus:border-purple" />
                  </label>
                  <Button onClick={generate} isLoading={generating} disabled={!Number.isInteger(validity) || validity < 1}>Générer le lien</Button>
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  <div className="flex items-center gap-4">
                    <div ref={qrRef} className={`shrink-0 rounded-md border border-[var(--ds-border)] bg-white p-2 ${linkUsable ? '' : 'opacity-30'}`}>
                      <QRCodeCanvas value={invitation.url} size={150} includeMargin={false} />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2 text-sm">
                      <p className="font-semibold text-[var(--ds-text)]">{liveState ? LIVE_LABEL[liveState.status] : LIVE_LABEL.invited}</p>
                      {liveState?.status === 'in_progress' && (
                        <p className="text-[var(--ds-text-muted)]">Question {liveState.current_index + 1} / {liveState.total}</p>
                      )}
                      {(!liveState || liveState.status === 'invited') && (
                        <p className={remainingMs > 0 ? 'text-[var(--ds-text-muted)]' : 'text-[var(--ds-danger)]'}>
                          {remainingMs > 0 ? `Expire dans ${mm} min ${String(ss).padStart(2, '0')} s` : 'Lien expiré'}
                        </p>
                      )}
                      <p className="text-xs text-[var(--ds-text-subtle)]">Usage unique, lié au premier appareil qui l’ouvre.</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={copy} disabled={!linkUsable}
                      leftIcon={copied ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}>
                      {copied ? 'Copié !' : 'Copier le lien'}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={downloadQr} disabled={!linkUsable} leftIcon={<IconDownload width={14} height={14} />}>QR PNG</Button>
                    <Button size="sm" variant="secondary" onClick={generate} isLoading={generating} leftIcon={<IconRefresh width={14} height={14} />}
                      title="Invalide le lien précédent et en crée un nouveau">
                      Régénérer
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {onOpenLegacy && (
          <div className="border-t border-[var(--ds-border)] px-6 py-3 text-xs text-[var(--ds-text-subtle)]">
            Période de transition :{' '}
            <button type="button" className="underline" onClick={onOpenLegacy}>utiliser un lien ClassMarker</button>
          </div>
        )}
      </div>
    </div>
  )
}

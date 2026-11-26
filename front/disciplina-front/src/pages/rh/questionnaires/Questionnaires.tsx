import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge, Button, EmptyState, LoadingPanel, PageHeader } from '@/components/ui'
import {
  IconClipboardCheck,
  IconCopy,
  IconDownload,
  IconLock,
  IconPlay,
  IconPlus,
  IconReports,
  IconTrash,
  IconUpload,
} from '@/components/ui/icons'
import {
  createQuestionnaire,
  deleteQuestionnaire,
  duplicateQuestionnaire,
  exportQuestionnaire,
  fetchQuestionnaires,
  setQuestionnaireStatus,
  startTestRun,
} from '@/api/questionnaire'
import { toast } from '@/store/toastStore'
import type { QuestionnaireSummary } from '@/types/questionnaire'
import { QUESTIONNAIRE_STATUS, downloadJson } from './labels'

const MAX_IMPORT_BYTES = 500 * 1024

export default function Questionnaires() {
  const navigate = useNavigate()
  const [items, setItems] = useState<QuestionnaireSummary[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [importPreview, setImportPreview] = useState<{ data: Record<string, unknown>; name: string } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const load = () => {
    fetchQuestionnaires()
      .then(setItems)
      .catch((err) => {
        toast.error(err, 'Chargement des questionnaires impossible')
        setItems([])
      })
  }
  useEffect(load, [])

  const run = async (id: string, action: () => Promise<void>) => {
    setBusy(id)
    try {
      await action()
    } catch (err) {
      toast.errorMessage('Action impossible', err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(null)
    }
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setImportError(null)
    if (file.size > MAX_IMPORT_BYTES) {
      setImportError('Fichier trop volumineux (500 Ko maximum).')
      return
    }
    try {
      const data = JSON.parse(await file.text())
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('objet attendu')
      setImportPreview({ data, name: file.name })
    } catch {
      setImportError('Ce fichier n’est pas un JSON valide.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const confirmImport = async () => {
    if (!importPreview) return
    setBusy('import')
    setImportError(null)
    try {
      const created = await createQuestionnaire(importPreview.data)
      setImportPreview(null)
      toast.success('Questionnaire importé', 'Il est en brouillon : vérifiez-le puis activez-le.')
      navigate(`/rh/questionnaires/${created._id}`)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import impossible')
    } finally {
      setBusy(null)
    }
  }

  const previewQuestions = Array.isArray(importPreview?.data.questions) ? (importPreview!.data.questions as unknown[]).length : 0

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Recrutement"
        title="Questionnaires"
        description="Tests de positionnement envoyés aux candidats par lien ou QR code. Remplace ClassMarker."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/rh/questionnaires/resultats">
              <Button variant="secondary" leftIcon={<IconReports width={16} height={16} />}>Résultats</Button>
            </Link>
            <Button variant="secondary" leftIcon={<IconUpload width={16} height={16} />} onClick={() => fileRef.current?.click()}>
              Importer JSON
            </Button>
            <Button leftIcon={<IconPlus width={16} height={16} />} onClick={() => navigate('/rh/questionnaires/nouveau')}>
              Nouveau
            </Button>
          </div>
        }
      />
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />

      {importError && !importPreview && (
        <p className="mb-4 whitespace-pre-line rounded-lg bg-[var(--ds-danger-bg)] p-3 text-sm text-[var(--ds-danger)]" role="alert">{importError}</p>
      )}

      {importPreview && (
        <section className="mb-6 rounded-[var(--radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-5" aria-labelledby="import-title">
          <h2 id="import-title" className="text-base font-bold text-[var(--ds-text)]">Aperçu de l’import — {importPreview.name}</h2>
          <p className="mt-2 text-sm text-[var(--ds-text-muted)]">
            <strong>{String(importPreview.data.title ?? 'Sans titre')}</strong> · {previewQuestions} question(s) ·{' '}
            {String(importPreview.data.duration_minutes ?? 20)} min
          </p>
          {importError && (
            <pre className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--ds-danger-bg)] p-3 text-xs text-[var(--ds-danger)]" role="alert">
              {importError}
            </pre>
          )}
          <div className="mt-4 flex gap-2">
            <Button onClick={confirmImport} isLoading={busy === 'import'}>Importer en brouillon</Button>
            <Button variant="ghost" onClick={() => { setImportPreview(null); setImportError(null) }}>Annuler</Button>
          </div>
        </section>
      )}

      {items === null ? (
        <LoadingPanel message="Chargement des questionnaires…" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<IconClipboardCheck width={22} height={22} />}
          title="Aucun questionnaire"
          description="Créez votre premier questionnaire bloc par bloc, ou importez un fichier JSON."
          action={<Button onClick={() => navigate('/rh/questionnaires/nouveau')}>Créer un questionnaire</Button>}
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)]">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-[var(--ds-border)] text-left text-xs uppercase tracking-wide text-[var(--ds-text-subtle)]">
                <th className="px-4 py-3 font-semibold">Titre</th>
                <th className="px-4 py-3 font-semibold">Questions</th>
                <th className="px-4 py-3 font-semibold">Durée</th>
                <th className="px-4 py-3 font-semibold">Statut</th>
                <th className="px-4 py-3 font-semibold">Passages</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((q) => (
                <tr key={q._id} className="border-b border-[var(--ds-border)] last:border-0">
                  <td className="px-4 py-3">
                    <Link to={`/rh/questionnaires/${q._id}`} className="font-semibold text-[var(--ds-text)] hover:underline">
                      {q.title}
                    </Link>
                    {q.locked && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs text-[var(--ds-text-subtle)]" title="Déjà passé : dupliquez pour modifier">
                        <IconLock width={12} height={12} /> verrouillé
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{q.question_count}</td>
                  <td className="px-4 py-3 tabular-nums">{q.duration_minutes} min</td>
                  <td className="px-4 py-3"><Badge tone={QUESTIONNAIRE_STATUS[q.status].tone}>{QUESTIONNAIRE_STATUS[q.status].label}</Badge></td>
                  <td className="px-4 py-3 tabular-nums">
                    <Link to={`/rh/questionnaires/resultats?questionnaireId=${q._id}`} className="hover:underline">{q.attempt_count ?? 0}</Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1">
                      {q.status !== 'archived' && (
                        <Button size="sm" variant="ghost" title="Passer le test soi-même, sans enregistrer de résultat" leftIcon={<IconPlay width={14} height={14} />}
                          disabled={busy === q._id || q.question_count === 0}
                          onClick={() => run(q._id, async () => { const inv = await startTestRun(q._id); window.open(inv.url, '_blank', 'noopener') })}>
                          Tester
                        </Button>
                      )}
                      {q.status === 'draft' && (
                        <Button size="sm" variant="subtle" disabled={busy === q._id}
                          onClick={() => run(q._id, async () => { await setQuestionnaireStatus(q._id, 'active'); toast.success('Questionnaire activé'); load() })}>
                          Activer
                        </Button>
                      )}
                      {q.status === 'active' && (
                        <Button size="sm" variant="ghost" disabled={busy === q._id}
                          onClick={() => run(q._id, async () => { await setQuestionnaireStatus(q._id, 'archived'); load() })}>
                          Archiver
                        </Button>
                      )}
                      {q.status === 'archived' && (
                        <Button size="sm" variant="ghost" disabled={busy === q._id}
                          onClick={() => run(q._id, async () => { await setQuestionnaireStatus(q._id, 'active'); load() })}>
                          Réactiver
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" aria-label="Dupliquer" title="Dupliquer" disabled={busy === q._id}
                        onClick={() => run(q._id, async () => { const c = await duplicateQuestionnaire(q._id); navigate(`/rh/questionnaires/${c._id}`) })}>
                        <IconCopy width={14} height={14} />
                      </Button>
                      <Button size="sm" variant="ghost" aria-label="Exporter en JSON" title="Exporter en JSON" disabled={busy === q._id}
                        onClick={() => run(q._id, async () => downloadJson(await exportQuestionnaire(q._id), `questionnaire-${q.title.replace(/[^\p{L}\p{N}]+/gu, '_')}.json`))}>
                        <IconDownload width={14} height={14} />
                      </Button>
                      {!q.locked && (
                        <Button size="sm" variant="ghost" aria-label="Supprimer" title="Supprimer" disabled={busy === q._id}
                          onClick={() => {
                            if (!window.confirm(`Supprimer définitivement « ${q.title} » ?`)) return
                            run(q._id, async () => { await deleteQuestionnaire(q._id); load() })
                          }}>
                          <IconTrash width={14} height={14} />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

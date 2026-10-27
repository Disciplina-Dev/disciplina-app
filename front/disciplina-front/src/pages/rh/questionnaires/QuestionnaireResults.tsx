import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Badge, Button, EmptyState, LoadingPanel, PageHeader } from '@/components/ui'
import { IconArrowLeft, IconDownload, IconReports } from '@/components/ui/icons'
import { fetchAttemptPdf, fetchAttempts, fetchQuestionnaires, type AttemptFilters } from '@/api/questionnaire'
import { toast } from '@/store/toastStore'
import type { AttemptListItem, AttemptStatus, QuestionnaireSummary } from '@/types/questionnaire'
import { ATTEMPT_STATUS, downloadBlob, formatDateTime, formatDuration } from './labels'

const selectClass =
  'rounded-[10px] border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 py-2 text-sm text-[var(--ds-text)] outline-none focus:border-[var(--ds-accent)]'

function toCsv(rows: AttemptListItem[]): string {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const header = ['Candidat', 'Questionnaire', 'Statut', 'Créé le', 'Terminé le', 'Durée', 'Score %', 'Points', 'Réussi', 'Sorties d’onglet']
  const lines = rows.map((r) => [
    r.candidate_name ?? '',
    r.questionnaire_title,
    ATTEMPT_STATUS[r.status].label,
    formatDateTime(r.created_at),
    formatDateTime(r.completed_at),
    formatDuration(r.started_at, r.completed_at),
    r.score?.percentage ?? '',
    r.score ? `${r.score.points_scored}/${r.score.points_available}` : '',
    r.score ? (r.score.passed ? 'oui' : 'non') : '',
    r.tab_switch_count,
  ].map(esc).join(';'))
  // BOM : Excel ouvre l'UTF-8 correctement.
  return '﻿' + [header.map(esc).join(';'), ...lines].join('\n')
}

export default function QuestionnaireResults() {
  const [params, setParams] = useSearchParams()
  const filters: AttemptFilters = {
    questionnaireId: params.get('questionnaireId') ?? '',
    status: (params.get('status') as AttemptStatus | null) ?? '',
    passed: (params.get('passed') as 'true' | 'false' | null) ?? '',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
    includeTestRuns: params.get('includeTestRuns') === 'true' ? 'true' : '',
    page: Number(params.get('page')) || 1,
  }
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireSummary[]>([])
  // Résultat associé à la clé de filtre qui l'a produit : chargement = clé différente.
  const [loaded, setLoaded] = useState<{ key: string; items: AttemptListItem[]; total: number; page_size: number } | null>(null)
  const [exporting, setExporting] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    fetchQuestionnaires().then(setQuestionnaires).catch(() => setQuestionnaires([]))
  }, [])

  const key = params.toString()
  const data = loaded?.key === key ? loaded : null
  useEffect(() => {
    fetchAttempts(filters)
      .then((res) => setLoaded({ key, ...res }))
      .catch((err) => {
        toast.error(err, 'Chargement des résultats impossible')
        setLoaded({ key, items: [], total: 0, page_size: 25 })
      })
    // Le filtre est entièrement porté par l'URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const setFilter = (name: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(name, value)
    else next.delete(name)
    if (name !== 'page') next.delete('page')
    setParams(next)
  }

  const exportCsv = async () => {
    setExporting(true)
    try {
      // Export de tous les résultats filtrés (pagination parcourue côté client, 100 par page).
      const all: AttemptListItem[] = []
      for (let page = 1; page <= 50; page++) {
         
        const res = await fetchAttempts({ ...filters, page, pageSize: 100 } as AttemptFilters)
        all.push(...res.items)
        if (all.length >= res.total || res.items.length === 0) break
      }
      const blob = new Blob([toCsv(all)], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `resultats-questionnaires-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(err, 'Export impossible')
    } finally {
      setExporting(false)
    }
  }

  const downloadPdf = async (id: string) => {
    setDownloading(id)
    try {
      const { blob, fileName } = await fetchAttemptPdf(id)
      downloadBlob(blob, fileName)
    } catch (err) {
      toast.error(err, 'Téléchargement du PDF impossible')
    } finally {
      setDownloading(null)
    }
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1

  return (
    <div className="mx-auto max-w-6xl">
      <Link to="/rh/questionnaires" className="mb-3 flex items-center gap-1.5 text-sm text-[var(--ds-text-subtle)] hover:text-[var(--ds-text)]">
        <IconArrowLeft width={15} height={15} /> Questionnaires
      </Link>
      <PageHeader
        eyebrow="Recrutement"
        title="Résultats des tests"
        description="Passages des questionnaires internes. Les anciens résultats ClassMarker restent visibles sur chaque fiche candidat."
        actions={
          <Button variant="secondary" leftIcon={<IconDownload width={16} height={16} />} onClick={exportCsv} isLoading={exporting} disabled={!data?.total}>
            Export CSV
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--ds-text-subtle)]">
          Questionnaire
          <select className={selectClass} value={filters.questionnaireId} onChange={(e) => setFilter('questionnaireId', e.target.value)}>
            <option value="">Tous</option>
            {questionnaires.map((q) => <option key={q._id} value={q._id}>{q.title}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--ds-text-subtle)]">
          Statut
          <select className={selectClass} value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
            <option value="">Tous</option>
            {(Object.keys(ATTEMPT_STATUS) as AttemptStatus[]).map((s) => <option key={s} value={s}>{ATTEMPT_STATUS[s].label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--ds-text-subtle)]">
          Résultat
          <select className={selectClass} value={filters.passed} onChange={(e) => setFilter('passed', e.target.value)}>
            <option value="">Tous</option>
            <option value="true">Au-dessus du seuil</option>
            <option value="false">Sous le seuil</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--ds-text-subtle)]">
          Du
          <input type="date" className={selectClass} value={filters.from} onChange={(e) => setFilter('from', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--ds-text-subtle)]">
          Au
          <input type="date" className={selectClass} value={filters.to} onChange={(e) => setFilter('to', e.target.value ? `${e.target.value}T23:59:59` : '')} />
        </label>
        <label className="flex items-center gap-2 py-2 text-sm text-[var(--ds-text)]">
          <input type="checkbox" checked={filters.includeTestRuns === 'true'} onChange={(e) => setFilter('includeTestRuns', e.target.checked ? 'true' : '')} />
          Inclure les passages de test
        </label>
      </div>

      {data === null ? (
        <LoadingPanel message="Chargement des résultats…" />
      ) : data.items.length === 0 ? (
        <EmptyState icon={<IconReports width={22} height={22} />} title="Aucun passage" description="Envoyez un test depuis une fiche candidat, ou élargissez les filtres." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)]">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-[var(--ds-border)] text-left text-xs uppercase tracking-wide text-[var(--ds-text-subtle)]">
                  <th className="px-4 py-3 font-semibold">Candidat</th>
                  <th className="px-4 py-3 font-semibold">Questionnaire</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Durée</th>
                  <th className="px-4 py-3 font-semibold">Score</th>
                  <th className="px-4 py-3 font-semibold">Statut</th>
                  <th className="px-4 py-3 font-semibold"><span className="sr-only">PDF</span></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((a) => (
                  <tr key={a._id} className="border-b border-[var(--ds-border)] last:border-0 hover:bg-[var(--ds-surface-sunken)]">
                    <td className="px-4 py-3">
                      {a.candidate_id ? (
                        <Link to={`/rh/candidats/${a.candidate_id}`} className="font-semibold text-[var(--ds-text)] hover:underline">{a.candidate_name || 'Candidat'}</Link>
                      ) : <span className="text-[var(--ds-text-subtle)]">{a.is_test_run ? 'Passage de test' : '—'}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/rh/questionnaires/resultats/${a._id}`} className="hover:underline">{a.questionnaire_title}</Link>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{formatDateTime(a.completed_at ?? a.created_at)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatDuration(a.started_at, a.completed_at)}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {a.score ? (
                        <span className="flex items-center gap-2">
                          <strong>{Math.round(a.score.percentage)} %</strong>
                          <Badge tone={a.score.passed ? 'success' : 'danger'}>{a.score.passed ? 'Réussi' : 'Échoué'}</Badge>
                        </span>
                      ) : a.status === 'in_progress' ? `Q ${a.current_index + 1}/${a.question_count}` : '—'}
                    </td>
                    <td className="px-4 py-3"><Badge tone={ATTEMPT_STATUS[a.status].tone}>{ATTEMPT_STATUS[a.status].label}</Badge></td>
                    <td className="px-4 py-3 text-right">
                      {a.status === 'completed' && (
                        <Button size="sm" variant="ghost" aria-label="Télécharger le PDF" title="Télécharger le PDF"
                          onClick={() => downloadPdf(a._id)} isLoading={downloading === a._id}>
                          <IconDownload width={16} height={16} />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <nav className="mt-4 flex items-center justify-end gap-2 text-sm" aria-label="Pagination">
              <Button size="sm" variant="secondary" disabled={(filters.page ?? 1) <= 1} onClick={() => setFilter('page', String((filters.page ?? 1) - 1))}>Précédent</Button>
              <span className="text-[var(--ds-text-subtle)]">Page {filters.page} / {pages}</span>
              <Button size="sm" variant="secondary" disabled={(filters.page ?? 1) >= pages} onClick={() => setFilter('page', String((filters.page ?? 1) + 1))}>Suivant</Button>
            </nav>
          )}
        </>
      )}
    </div>
  )
}

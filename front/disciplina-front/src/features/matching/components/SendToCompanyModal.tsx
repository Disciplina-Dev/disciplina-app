import { useState, useEffect } from 'react'
import { IconCheck, IconClose, IconCopy, IconExternalLink, IconFile, IconLoader, IconPlus, IconSend, IconSparkles, IconUserCheck, IconUserRemove } from '@/components/ui/icons'
import { apiFetch } from '@/api/httpClient'
import { useRhMailTemplatesStore } from '@/store/mailTemplatesStore'

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
  cvWebview?: string | null
  hasCv?: boolean
}

interface MatchJobResult {
  id: string
  companyName: string
  companyInfos?: { email?: string | null } | null
  referents?: {
    legalReferents?: { email?: string | null } | null
    recruitmentReferents?: { email?: string | null } | null
  } | null
}

interface SendToCompanyModalProps {
  job: MatchJobResult
  candidates: MatchedCandidate[]
  onClose: () => void
  onSubmit: (offerId: string, companyEmail: string, candidates: { id: string; description: string }[], templateId?: string, cc?: string[]) => Promise<string>
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_CC = 10

export default function SendToCompanyModal({ job, candidates, onClose, onSubmit }: SendToCompanyModalProps) {
  const { templates, load: loadTemplates } = useRhMailTemplatesStore()
  const [companyEmail, setCompanyEmail] = useState(
    job.referents?.recruitmentReferents?.email ?? job.companyInfos?.email ?? '',
  )
  const [ccList, setCcList] = useState<string[]>([])
  const [ccInput, setCcInput] = useState('')
  const [ccError, setCcError] = useState<string | null>(null)
  const [templateId, setTemplateId] = useState<string>('')
  const [descriptions, setDescriptions] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const c of candidates) {
      initial[c.id] = c.description || c.identityDescription || ''
    }
    return initial
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ signature: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [aiLoading, setAiLoading] = useState<Set<string>>(new Set())
  const [aiErrors, setAiErrors] = useState<Record<string, string>>({})
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set())

  useEffect(() => { loadTemplates() }, [loadTemplates])

  // Par défaut : le modèle système « Proposition de candidats ».
  useEffect(() => {
    if (templateId) return
    const system = templates.find((t) => t.kind === 'proposition_candidat')
    setTemplateId(system?.id ?? templates[0]?.id ?? '')
  }, [templates]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDescriptionChange = (candidateId: string, value: string) => {
    setDescriptions((prev) => ({ ...prev, [candidateId]: value }))
  }

  const toggleExcluded = (candidateId: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev)
      if (next.has(candidateId)) next.delete(candidateId)
      else next.add(candidateId)
      return next
    })
  }

  const handleAddCc = () => {
    const addr = ccInput.trim().toLowerCase()
    if (!addr) return
    if (!EMAIL_RE.test(addr)) {
      setCcError('Adresse email invalide')
      return
    }
    if (addr === companyEmail.trim().toLowerCase()) {
      setCcError('Cette adresse est déjà le destinataire principal')
      return
    }
    if (ccList.includes(addr)) {
      setCcError('Cette adresse est déjà en copie')
      return
    }
    if (ccList.length >= MAX_CC) {
      setCcError(`Maximum ${MAX_CC} adresses en copie`)
      return
    }
    setCcList((prev) => [...prev, addr])
    setCcInput('')
    setCcError(null)
  }

  const handleRemoveCc = (addr: string) => {
    setCcList((prev) => prev.filter((c) => c !== addr))
    setCcError(null)
  }

  const handleGenerateAiSummary = async (candidateId: string) => {
    setAiLoading((prev) => new Set(prev).add(candidateId))
    setAiErrors((prev) => { const n = { ...prev }; delete n[candidateId]; return n })
    try {
      const res = await apiFetch(`/api/candidates/${candidateId}/generate-summary`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erreur serveur' }))
        throw new Error(err.error || `Échec (${res.status})`)
      }
      const data = await res.json()
      setDescriptions((prev) => ({ ...prev, [candidateId]: data.summary }))
    } catch (err) {
      setAiErrors((prev) => ({ ...prev, [candidateId]: err instanceof Error ? err.message : 'Erreur inconnue' }))
    } finally {
      setAiLoading((prev) => { const n = new Set(prev); n.delete(candidateId); return n })
    }
  }

  const handleSubmit = async () => {
    if (!companyEmail.trim()) {
      setError('Veuillez entrer l\'email de l\'entreprise')
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      const proposedCandidates = candidates.filter((c) => !excludedIds.has(c.id))
      const signature = await onSubmit(
        job.id,
        companyEmail.trim(),
        proposedCandidates.map((c) => ({
          id: c.id,
          description: descriptions[c.id] ?? '',
        })),
        templateId || undefined,
        ccList.length ? ccList : undefined,
      )
      setSuccess({ signature })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création de la session')
    } finally {
      setIsSubmitting(false)
    }
  }

  const matchLink = success
    ? `${window.location.origin}/external/authenticate?sig=${success.signature}`
    : null

  const proposedCount = candidates.filter((c) => !excludedIds.has(c.id)).length
  const excludedCount = candidates.length - proposedCount

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-[var(--ds-surface)] shadow-xl">
          <div className="flex items-center justify-between border-b border-[var(--ds-border)] p-5">
            <h2 className="text-base font-bold text-[var(--ds-text)]">Session de matching créée</h2>
            <button onClick={onClose} className="rounded-lg p-1 text-[var(--ds-text-subtle)] hover:bg-[var(--ds-surface-sunken)]">
              <IconClose width={18} height={18} />
            </button>
          </div>
          <div className="p-5 space-y-4">
            <div className="rounded-xl bg-[var(--ds-success-bg)] p-4 text-sm text-[var(--ds-success)]">
              Les candidats ont été proposés à l'entreprise. Un email avec le lien d'accès a été envoyé.
            </div>

            <div className="rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-sunken)] p-4 space-y-3">
              <p className="text-xs font-semibold text-[var(--ds-text-muted)]">Lien de la session</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={matchLink ?? ''}
                  className="flex-1 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 py-2 text-sm text-[var(--ds-text-muted)] outline-none"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(matchLink ?? '')
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 py-2 text-sm font-medium text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-sunken)] transition-colors"
                >
                  {copied ? <IconCheck width={14} height={14} className="text-[var(--ds-success)]" /> : <IconCopy width={14} height={14} />}
                  {copied ? 'Copié' : 'Copier'}
                </button>
              </div>
              <a
                href={matchLink ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue hover:underline"
              >
                <IconExternalLink width={12} height={12} />
                Ouvrir le lien
              </a>
            </div>

            <div className="rounded-lg border border-[var(--ds-warning)] bg-[var(--ds-warning-bg)] p-3">
              <p className="text-xs text-[var(--ds-warning)]">
                Ce lien reste valable sans limite de durée, sans code : l'entreprise accède directement à la sélection, jusqu'à sa clôture.
              </p>
            </div>
          </div>
          <div className="flex justify-end border-t border-[var(--ds-border)] p-4">
            <button
              onClick={onClose}
              className="rounded-lg bg-blue px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 transition-colors"
            >
              Terminé
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-[var(--ds-surface)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--ds-border)] p-5">
          <div>
            <h2 className="text-base font-bold text-[var(--ds-text)]">Proposer les candidats à l'entreprise</h2>
            <p className="text-xs text-[var(--ds-text-subtle)] mt-0.5">{job.companyName}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-[var(--ds-text-subtle)] hover:bg-[var(--ds-surface-sunken)]">
            <IconClose width={18} height={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div>
            <label className="text-xs font-semibold text-[var(--ds-text-muted)] mb-1.5 block">
              Email de l'entreprise <span className="text-[var(--ds-danger)]">*</span>
            </label>
            <input
              type="email"
              value={companyEmail}
              onChange={(e) => setCompanyEmail(e.target.value)}
              placeholder="contact@entreprise.fr"
              className="w-full rounded-lg border border-[var(--ds-border)] px-3 py-2.5 text-sm outline-none focus:border-blue focus:ring-1 focus:ring-blue/20 transition-colors"
            />
            <p className="text-xs text-[var(--ds-text-subtle)] mt-1">
              L'invitation à la session de matching sera envoyée à cette adresse.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--ds-text-muted)] mb-1.5 block">
              Copie (Cc) <span className="font-normal text-[var(--ds-text-subtle)]">— optionnel</span>
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={ccInput}
                onChange={(e) => { setCcInput(e.target.value); setCcError(null) }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCc() } }}
                placeholder="collegue@entreprise.fr"
                disabled={ccList.length >= MAX_CC}
                className="flex-1 rounded-lg border border-[var(--ds-border)] px-3 py-2.5 text-sm outline-none focus:border-blue focus:ring-1 focus:ring-blue/20 transition-colors disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleAddCc}
                disabled={!ccInput.trim() || ccList.length >= MAX_CC}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 py-2 text-sm font-medium text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-sunken)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <IconPlus width={14} height={14} />
                Ajouter
              </button>
            </div>
            {ccError && (
              <p className="text-xs text-[var(--ds-danger)] mt-1">{ccError}</p>
            )}
            {ccList.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {ccList.map((addr) => (
                  <span
                    key={addr}
                    className="inline-flex items-center gap-1 rounded-full bg-blue-light px-2.5 py-1 text-xs font-medium text-blue"
                  >
                    {addr}
                    <button
                      type="button"
                      onClick={() => handleRemoveCc(addr)}
                      className="rounded-full p-0.5 hover:bg-blue/10 transition-colors"
                      title={`Retirer ${addr}`}
                    >
                      <IconClose width={12} height={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-[var(--ds-text-subtle)] mt-1">
              Ces adresses recevront le mail en copie visible des autres destinataires.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--ds-text-muted)] mb-1.5 block">
              Modèle de mail d'invitation
            </label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 py-2.5 text-sm outline-none focus:border-blue focus:ring-1 focus:ring-blue/20 transition-colors"
            >
              {templates.length === 0 && <option value="">Modèle par défaut</option>}
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.kind === 'proposition_candidat' ? 'Proposition de candidats' : t.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-[var(--ds-text-subtle)] mt-1">
              Les modèles RH sont modifiables dans « Modèles mail ».
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-[var(--ds-text-muted)] mb-3">
              Candidats à proposer ({proposedCount})
              {excludedCount > 0 && (
                <span className="text-[var(--ds-text-subtle)]"> / {candidates.length} · {excludedCount} exclu{excludedCount > 1 ? 's' : ''}</span>
              )}
            </p>
            <div className="flex flex-col gap-4">
              {candidates.map((candidate) => {
                const isExcluded = excludedIds.has(candidate.id)
                return (
                  <div
                    key={candidate.id}
                    className={[
                      'rounded-xl border overflow-hidden transition-all duration-200',
                      isExcluded ? 'border-[var(--ds-border)] bg-[var(--ds-surface-sunken)] opacity-60' : 'border-[var(--ds-border)] bg-[var(--ds-surface-sunken)]',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-3 p-3 pb-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[var(--ds-text)] truncate">
                          {candidate.fullName}
                        </p>
                        {!candidate.hasCv && (
                          <span className="mt-0.5 inline-block rounded-full bg-[var(--ds-warning-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--ds-warning)]">
                            Aucun CV disponible
                          </span>
                        )}
                        <p className="text-xs text-[var(--ds-text-subtle)] mt-0.5">
                          {candidate.age} ans · {candidate.city ?? 'Ville non renseignée'} · {candidate.email}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleExcluded(candidate.id)}
                          className={[
                            'flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                            isExcluded
                              ? 'border-blue/20 text-blue hover:bg-blue-light'
                              : 'border-[var(--ds-border)] bg-[var(--ds-surface)] text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-sunken)]',
                          ].join(' ')}
                          title={isExcluded ? 'Remettre ce candidat dans la liste' : 'Ne pas proposer ce candidat'}
                        >
                          {isExcluded ? <IconUserCheck width={12} height={12} /> : <IconUserRemove width={12} height={12} />}
                          {isExcluded ? 'Re-proposer' : 'Ne pas proposer'}
                        </button>
                        {candidate.cvWebview && (
                          <a
                            href={candidate.cvWebview}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-sunken)] transition-colors"
                          >
                            <IconFile width={12} height={12} />
                            CV
                          </a>
                        )}
                      </div>
                    </div>

                    {candidate.cvWebview && (
                      <div className="px-3 pb-1">
                        <iframe
                          src={candidate.cvWebview}
                          className="w-full rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface)]"
                          style={{ height: 200 }}
                          title={`CV de ${candidate.fullName}`}
                        />
                      </div>
                    )}

                    <div className="px-3 pb-3">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ds-text-subtle)]">
                          Description pour l'entreprise
                        </label>
                        <button
                          type="button"
                          onClick={() => handleGenerateAiSummary(candidate.id)}
                          disabled={aiLoading.has(candidate.id)}
                          className="flex items-center gap-1 text-[11px] font-semibold text-purple hover:underline disabled:opacity-40 transition-opacity"
                        >
                          {aiLoading.has(candidate.id) ? (
                            <IconLoader width={11} height={11} className="animate-spin" />
                          ) : (
                            <IconSparkles width={11} height={11} />
                          )}
                          {aiLoading.has(candidate.id) ? 'IA…' : 'Résumé IA'}
                        </button>
                      </div>
                      <textarea
                        value={descriptions[candidate.id] ?? ''}
                        onChange={(e) => handleDescriptionChange(candidate.id, e.target.value)}
                        placeholder="Points forts, compétences clés, disponibilité..."
                        rows={2}
                        className="w-full rounded-lg border border-[var(--ds-border)] px-3 py-2 text-xs outline-none focus:border-blue focus:ring-1 focus:ring-blue/20 transition-colors resize-none"
                      />
                      {aiErrors[candidate.id] && (
                        <p className="mt-1 text-[11px] text-[var(--ds-danger)]">{aiErrors[candidate.id]}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-[var(--ds-danger-bg)] px-4 py-3 text-sm text-[var(--ds-danger)]">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center gap-2 border-t border-[var(--ds-border)] p-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--ds-border)] px-4 py-2 text-sm font-semibold text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-sunken)] transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !companyEmail.trim() || proposedCount === 0}
            className="flex items-center gap-2 rounded-lg bg-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {isSubmitting ? (
              <IconLoader width={16} height={16} className="animate-spin" />
            ) : (
              <IconSend width={16} height={16} />
            )}
            {isSubmitting ? 'Création en cours...' : 'Lancer la session de matching'}
          </button>
        </div>
      </div>
    </div>
  )
}

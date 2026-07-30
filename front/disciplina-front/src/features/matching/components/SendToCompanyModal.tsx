import { useState } from 'react'
import { X, Loader2, Send, ExternalLink, FileText, Copy, Check, Sparkles } from 'lucide-react'
import { apiFetch } from '@/api/httpClient'

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
}

interface MatchJobResult {
  id: string
  companyName: string
}

interface SendToCompanyModalProps {
  job: MatchJobResult
  candidates: MatchedCandidate[]
  onClose: () => void
  onSubmit: (offerId: string, companyEmail: string, candidates: { id: string; description: string }[]) => Promise<string>
}

export default function SendToCompanyModal({ job, candidates, onClose, onSubmit }: SendToCompanyModalProps) {
  console.log(candidates);
  const [companyEmail, setCompanyEmail] = useState('')
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

  const handleDescriptionChange = (candidateId: string, value: string) => {
    setDescriptions((prev) => ({ ...prev, [candidateId]: value }))
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
      const signature = await onSubmit(
        job.id,
        companyEmail.trim(),
        candidates.map((c) => ({
          id: c.id,
          description: descriptions[c.id] ?? '',
        })),
      )
      setSuccess({ signature })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création de la session')
    } finally {
      setIsSubmitting(false)
    }
  }

  const matchLink = success
    ? `${window.location.origin}/public/match?sig=${success.signature}`
    : null

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 p-5">
            <h2 className="text-base font-bold text-gray-900">Session de matching créée</h2>
            <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-50">
              <X size={18} />
            </button>
          </div>
          <div className="p-5 space-y-4">
            <div className="rounded-xl bg-success-bg p-4 text-sm text-success">
              Les candidats ont été proposés à l'entreprise. Un email avec le lien d'accès a été envoyé.
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-700">Lien de la session</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={matchLink ?? ''}
                  className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(matchLink ?? '')
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                  {copied ? 'Copié' : 'Copier'}
                </button>
              </div>
              <a
                href={matchLink ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue hover:underline"
              >
                <ExternalLink size={12} />
                Ouvrir le lien
              </a>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs text-amber-700">
                Ce lien expire dans 24h. L'entreprise pourra se connecter avec l'identifiant et le code reçus par email.
              </p>
            </div>
          </div>
          <div className="flex justify-end border-t border-gray-100 p-4">
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
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <div>
            <h2 className="text-base font-bold text-gray-900">Proposer les candidats à l'entreprise</h2>
            <p className="text-xs text-gray-400 mt-0.5">{job.companyName}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-50">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
              Email de l'entreprise <span className="text-danger">*</span>
            </label>
            <input
              type="email"
              value={companyEmail}
              onChange={(e) => setCompanyEmail(e.target.value)}
              placeholder="contact@entreprise.fr"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue focus:ring-1 focus:ring-blue/20 transition-colors"
            />
            <p className="text-xs text-gray-400 mt-1">
              L'invitation à la session de matching sera envoyée à cette adresse.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-700 mb-3">
              Candidats à proposer ({candidates.length})
            </p>
            <div className="flex flex-col gap-4">
              {candidates.map((candidate) => (
                <div
                  key={candidate.id}
                  className="rounded-xl border border-gray-100 bg-gray-50/50 overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-3 p-3 pb-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {candidate.fullName}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {candidate.age} ans · {candidate.city ?? 'Ville non renseignée'} · {candidate.email}
                      </p>
                    </div>
                    {candidate.cvWebview && (
                      <a
                        href={candidate.cvWebview}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        <FileText size={12} />
                        CV
                      </a>
                    )}
                  </div>

                  {candidate.cvWebview && (
                    <div className="px-3 pb-1">
                      <iframe
                        src={candidate.cvWebview}
                        className="w-full rounded-lg border border-gray-200 bg-white"
                        style={{ height: 200 }}
                        title={`CV de ${candidate.fullName}`}
                      />
                    </div>
                  )}

                  <div className="px-3 pb-3">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                        Description pour l'entreprise
                      </label>
                      <button
                        type="button"
                        onClick={() => handleGenerateAiSummary(candidate.id)}
                        disabled={aiLoading.has(candidate.id)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-purple hover:underline disabled:opacity-40 transition-opacity"
                      >
                        {aiLoading.has(candidate.id) ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Sparkles size={11} />
                        )}
                        {aiLoading.has(candidate.id) ? 'IA…' : 'Résumé IA'}
                      </button>
                    </div>
                    <textarea
                      value={descriptions[candidate.id] ?? ''}
                      onChange={(e) => handleDescriptionChange(candidate.id, e.target.value)}
                      placeholder="Points forts, compétences clés, disponibilité..."
                      rows={2}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none focus:border-blue focus:ring-1 focus:ring-blue/20 transition-colors resize-none"
                    />
                    {aiErrors[candidate.id] && (
                      <p className="mt-1 text-[11px] text-red-500">{aiErrors[candidate.id]}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center gap-2 border-t border-gray-100 p-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !companyEmail.trim()}
            className="flex items-center gap-2 rounded-lg bg-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {isSubmitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
            {isSubmitting ? 'Création en cours...' : 'Lancer la session de matching'}
          </button>
        </div>
      </div>
    </div>
  )
}

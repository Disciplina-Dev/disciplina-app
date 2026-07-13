import { useEffect, useMemo, useState } from 'react'
import { Send, CheckCircle, XCircle, Mail, Users, Clock, MapPin } from 'lucide-react'
import Button from '@/components/ui/Button'
import { useCandidates } from '@/graphql/hooks'
import { CandidateStatus, TrainingSite, TitleProfessionalType } from '@/types/candidate'
import type { Candidate } from '@/types/candidate'
import { useAuthStore } from '@/store/authStore'
import { useRhMailTemplatesStore } from '@/store/mailTemplatesStore'
import { CANDIDATE_STATUS_LABELS, CANDIDATE_STATUS_ORDER } from '@/constants/candidateStatus'

interface SendResult {
  sent: number
  errors: number
  total: number
}

// Type d'envoi : relance de disponibilité (Oui/Non codée en dur) ou un modèle RH.
const AVAILABILITY = 'availability'

// Zones géographiques dérivées du site de formation du candidat.
type ZoneKey = 'NORD' | 'OUEST' | 'SUD' | 'AUTRE'

const ZONE_LABEL: Record<ZoneKey, string> = {
  NORD: 'Nord',
  OUEST: 'Ouest',
  SUD: 'Sud',
  AUTRE: 'Non renseigné',
}

function zoneOf(candidate: Candidate): ZoneKey {
  switch (candidate.training_site) {
    case TrainingSite.NORD_SAINTE_MARIE:
      return 'NORD'
    case TrainingSite.OUEST_SAINT_PAUL:
      return 'OUEST'
    case TrainingSite.SUD_SAINT_PIERRE:
      return 'SUD'
    default:
      return 'AUTRE'
  }
}

// Libellés + couleurs des titres professionnels (types métier).
const TP_LABEL: Record<TitleProfessionalType, string> = {
  [TitleProfessionalType.AD]: 'Assistante de Direction',
  [TitleProfessionalType.CC]: 'Conseiller Commercial',
  [TitleProfessionalType.NTC]: 'Négociateur technico-commercial',
  [TitleProfessionalType.REM]: "Responsable d'établissement Marchand",
  [TitleProfessionalType.SA]: 'SA',
}

function tpColors(tp: TitleProfessionalType): string {
  switch (tp) {
    case TitleProfessionalType.AD:
      return 'bg-[#CCFBF1] text-[#0F766E] ring-[#0F766E]/20'
    case TitleProfessionalType.CC:
      return 'bg-[#E0E7FF] text-[#4338CA] ring-[#4338CA]/20'
    case TitleProfessionalType.NTC:
      return 'bg-[#FAE8FF] text-[#A21CAF] ring-[#A21CAF]/20'
    case TitleProfessionalType.REM:
      return 'bg-[#ECFCCB] text-[#4D7C0F] ring-[#4D7C0F]/20'
    case TitleProfessionalType.SA:
      return 'bg-[#F1F5F9] text-[#334155] ring-[#334155]/20'
    default:
      return 'bg-gray-100 text-gray-500 ring-gray-200'
  }
}

/** Les titres professionnels d'un candidat (multi, avec repli sur le legacy). */
function tpsOf(candidate: Candidate): TitleProfessionalType[] {
  if (candidate.tp_types?.length) return candidate.tp_types
  return candidate.tp_type ? [candidate.tp_type] : []
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
function formatDate(iso?: string): string | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : dateFmt.format(d)
}

/** Réponse « à jour » : postérieure (ou égale) à la dernière relance envoyée. */
function hasFreshResponse(c: Candidate): boolean {
  if (!c.relance_response_at) return false
  if (!c.last_relance_at) return true
  return new Date(c.relance_response_at).getTime() >= new Date(c.last_relance_at).getTime()
}

export default function Relance() {
  const { candidates, loading } = useCandidates()
  const token = useAuthStore((s) => s.token)
  const templates = useRhMailTemplatesStore((s) => s.templates)
  const loadTemplates = useRhMailTemplatesStore((s) => s.load)

  const [sendType, setSendType] = useState<string>(AVAILABILITY)
  const [statusFilter, setStatusFilter] = useState<CandidateStatus | 'ALL'>(CandidateStatus.SEEKING)
  const [tpFilter, setTpFilter] = useState<Set<TitleProfessionalType>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<SendResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  const selectedTemplate = templates.find((t) => t.id === sendType) ?? null

  // Candidats ciblables : email renseigné + filtre statut + filtre type métier.
  const targets = useMemo(
    () =>
      candidates.filter((c) => {
        if (!c.identity.email) return false
        if (statusFilter !== 'ALL' && c.status !== statusFilter) return false
        if (tpFilter.size > 0 && !tpsOf(c).some((tp) => tpFilter.has(tp))) return false
        return true
      }),
    [candidates, statusFilter, tpFilter],
  )

  // Nettoie la sélection quand le filtre change (des candidats disparaissent de la liste).
  useEffect(() => {
    const validIds = new Set(targets.map((c) => c._id))
    setSelected((prev) => new Set([...prev].filter((id) => validIds.has(id))))
    setResult(null)
    setError(null)
  }, [targets])

  const selectedIds = useMemo(() => [...selected], [selected])

  function toggleTp(tp: TitleProfessionalType) {
    setTpFilter((prev) => {
      const next = new Set(prev)
      next.has(tp) ? next.delete(tp) : next.add(tp)
      return next
    })
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    const ids = targets.map((c) => c._id)
    const allSelected = ids.length > 0 && ids.every((id) => selected.has(id))
    setSelected(allSelected ? new Set() : new Set(ids))
  }

  async function handleSend() {
    if (selectedIds.length === 0 || sending) return
    if (sendType !== AVAILABILITY && !selectedTemplate) {
      setError('Modèle introuvable — recharge la page')
      return
    }
    setSending(true)
    setResult(null)
    setError(null)
    try {
      const url =
        sendType === AVAILABILITY
          ? `${import.meta.env.VITE_API_URL}/api/relance/send`
          : `${import.meta.env.VITE_API_URL}/api/relance/bulk`
      const body =
        sendType === AVAILABILITY ? { ids: selectedIds } : { ids: selectedIds, templateId: sendType }
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur serveur')
      setResult(data)
      setSelected(new Set())
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  const selectAllChecked = targets.length > 0 && targets.every((c) => selected.has(c._id))
  const respondedCount = useMemo(() => targets.filter(hasFreshResponse).length, [targets])
  const pendingCount = targets.length - respondedCount

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 flex flex-col gap-6 pb-28">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-purple-light flex items-center justify-center shrink-0">
          <Mail size={20} className="text-purple" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Relance candidats</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Choisis un type d'envoi, filtre par statut et métier, sélectionne les destinataires.
          </p>
        </div>
      </div>

      {/* Barre de configuration */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-2xl border border-gray-100 bg-white p-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="send-type" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Type d'envoi
          </label>
          <select
            id="send-type"
            value={sendType}
            onChange={(e) => setSendType(e.target.value)}
            className="w-full rounded-[10px] border border-gray-100 bg-white py-2.5 px-3 text-sm text-gray-900 outline-none focus:border-purple transition-colors"
          >
            <option value={AVAILABILITY}>Relance disponibilité (Oui / Non)</option>
            {templates.length > 0 && (
              <optgroup label="Modèles de mail">
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status-filter" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Statut des candidats
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CandidateStatus | 'ALL')}
            className="w-full rounded-[10px] border border-gray-100 bg-white py-2.5 px-3 text-sm text-gray-900 outline-none focus:border-purple transition-colors"
          >
            <option value="ALL">Tous les statuts</option>
            {CANDIDATE_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {CANDIDATE_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        {/* Filtre par type métier (titre professionnel) */}
        <div className="sm:col-span-2 flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Type métier</span>
          <div className="flex flex-wrap gap-2">
            {Object.values(TitleProfessionalType).map((tp) => {
              const active = tpFilter.has(tp)
              return (
                <button
                  key={tp}
                  type="button"
                  onClick={() => toggleTp(tp)}
                  title={TP_LABEL[tp]}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-all ${
                    active ? tpColors(tp) : 'bg-white text-gray-400 ring-gray-200 hover:ring-gray-300'
                  }`}
                >
                  {tp}
                </button>
              )
            })}
            {tpFilter.size > 0 && (
              <button
                type="button"
                onClick={() => setTpFilter(new Set())}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-600"
              >
                Réinitialiser
              </button>
            )}
          </div>
        </div>

        {/* Aperçu du type d'envoi */}
        <div className="sm:col-span-2 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-sm text-gray-600">
          {sendType === AVAILABILITY ? (
            <span>
              Mail « Êtes-vous toujours en recherche ? » avec boutons <strong>Oui / Non</strong> — le
              statut du candidat est mis à jour automatiquement à sa réponse.
            </span>
          ) : selectedTemplate ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-400">
                Objet : <strong className="text-gray-700">{selectedTemplate.subject}</strong>
                {selectedTemplate.attachment ? ` · PJ : ${selectedTemplate.attachment.filename}` : ''}
              </span>
              <div
                className="prose prose-sm max-w-none text-gray-700 line-clamp-4"
                dangerouslySetInnerHTML={{ __html: selectedTemplate.body }}
              />
            </div>
          ) : (
            <span className="text-gray-400">Modèle introuvable.</span>
          )}
        </div>
      </div>

      {/* Résultat / erreur */}
      {result && (
        <div className="rounded-xl border border-green-100 bg-green-50 px-5 py-3 flex items-center gap-6">
          <div className="flex items-center gap-2 text-sm text-green-700">
            <CheckCircle size={16} />
            <span>
              <strong>{result.sent}</strong> mail{result.sent > 1 ? 's' : ''} envoyé
              {result.sent > 1 ? 's' : ''}
            </span>
          </div>
          {result.errors > 0 && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <XCircle size={16} />
              <span>
                <strong>{result.errors}</strong> erreur{result.errors > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-5 py-3 text-sm text-red-600">{error}</div>
      )}

      {/* Liste des candidats en bento grid */}
      {loading ? (
        <p className="text-sm text-gray-400">Chargement...</p>
      ) : targets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-sm text-gray-400">
          Aucun candidat avec un email pour ce filtre
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Barre de sélection + compteurs */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <label className="flex items-center gap-2.5 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={selectAllChecked}
                onChange={toggleAll}
                className="h-4 w-4 rounded accent-purple cursor-pointer"
              />
              <span className="font-medium text-gray-600">
                {selectAllChecked ? 'Tout désélectionner' : 'Tout sélectionner'}
              </span>
            </label>
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <Users size={13} /> {selected.size} / {targets.length} sélectionné{selected.size > 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-green-600">
              <CheckCircle size={13} /> {respondedCount} répondu{respondedCount > 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-amber-600">
              <Clock size={13} /> {pendingCount} en attente
            </span>
          </div>

          {/* Bento grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {targets.map((c) => {
              const isSelected = selected.has(c._id)
              const responded = hasFreshResponse(c)
              const relanceDate = formatDate(c.last_relance_at)
              const responseDate = responded ? formatDate(c.relance_response_at) : null
              const zone = ZONE_LABEL[zoneOf(c)]
              return (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => toggle(c._id)}
                  className={`text-left rounded-2xl border p-4 flex flex-col gap-3 transition-all ${
                    isSelected
                      ? 'border-purple ring-2 ring-purple/20 bg-purple-light/30'
                      : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
                  }`}
                >
                  {/* Ligne titre + checkbox */}
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(c._id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 mt-0.5 rounded accent-purple cursor-pointer shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{c.identity.full_name}</p>
                      <p className="text-xs text-gray-400 truncate">{c.identity.email}</p>
                    </div>
                  </div>

                  {/* Badges métier + zone */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {tpsOf(c).map((tp) => (
                      <span
                        key={tp}
                        title={TP_LABEL[tp]}
                        className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ${tpColors(tp)}`}
                      >
                        {tp}
                      </span>
                    ))}
                    <span className="flex items-center gap-1 text-[11px] text-gray-400">
                      <MapPin size={11} /> {zone}
                    </span>
                    <span className="ml-auto rounded-md bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                      {CANDIDATE_STATUS_LABELS[c.status as CandidateStatus] ?? c.status}
                    </span>
                  </div>

                  {/* Dates relance / réponse */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-50">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wide text-gray-400">Relancé le</span>
                      <span className="text-xs font-medium text-gray-700">{relanceDate ?? '—'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wide text-gray-400">Répondu le</span>
                      {responseDate ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                          <CheckCircle size={11} /> {responseDate}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-medium text-amber-500">
                          <Clock size={11} /> En attente
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Barre d'action fixe */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-100 bg-white/95 backdrop-blur px-4 py-3">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-4">
          <span className="text-sm text-gray-500">
            {selected.size > 0 ? (
              <>
                <strong className="text-gray-900">{selected.size}</strong> candidat
                {selected.size > 1 ? 's' : ''} sélectionné{selected.size > 1 ? 's' : ''}
              </>
            ) : (
              'Aucun candidat sélectionné'
            )}
          </span>
          <Button
            leftIcon={<Send size={16} />}
            disabled={selected.size === 0}
            isLoading={sending}
            onClick={handleSend}
            className="bg-purple hover:bg-purple-dark text-white"
          >
            Envoyer{selected.size > 0 ? ` (${selected.size})` : ''}
          </Button>
        </div>
      </div>
    </div>
  )
}

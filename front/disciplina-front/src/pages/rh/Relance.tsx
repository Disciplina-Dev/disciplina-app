import { useEffect, useMemo, useState } from 'react'
import { IconCheckCircle, IconClock, IconErrorCircle, IconMail, IconMapPin, IconSend, IconUsers } from '@/components/ui/icons'
import Button from '@/components/ui/Button'
import { useCandidates } from '@/graphql/hooks'
import { CandidateStatus, TitleProfessionalType } from '@/types/candidate'
import type { Candidate } from '@/types/candidate'
import { apiJson } from '@/api/httpClient'
import { useRhMailTemplatesStore } from '@/store/mailTemplatesStore'
import { CANDIDATE_STATUS_LABELS, CANDIDATE_STATUS_ORDER } from '@/constants/candidateStatus'
import { cleanHtml } from '@/services/sanitizeHtml'
import { SECTEUR_LABELS, secteurKeyOfTrainingSite } from '@/constants/secteurs'

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
  ...SECTEUR_LABELS,
  AUTRE: 'Non renseigné',
}

function zoneOf(candidate: Candidate): ZoneKey {
  return secteurKeyOfTrainingSite(candidate.training_site) ?? 'AUTRE'
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
      return 'bg-[var(--ds-surface-sunken)] text-[var(--ds-text-subtle)] ring-[var(--ds-border)]'
  }
}

/** Les titres professionnels d'un candidat (multi). */
function tpsOf(candidate: Candidate): TitleProfessionalType[] {
  return candidate.tp_types ?? []
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
  const templates = useRhMailTemplatesStore((s) => s.templates)
  const loadTemplates = useRhMailTemplatesStore((s) => s.load)

  const [sendType, setSendType] = useState<string>(AVAILABILITY)
  const [statusFilter, setStatusFilter] = useState<CandidateStatus | 'ALL'>(CandidateStatus.SEEKING)
  const [tpFilter, setTpFilter] = useState<Set<TitleProfessionalType>>(new Set())
  const [zoneFilter, setZoneFilter] = useState<Set<ZoneKey>>(new Set())
  const [showRelanced, setShowRelanced] = useState(false)
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
        if (zoneFilter.size > 0 && !zoneFilter.has(zoneOf(c))) return false
        if (!showRelanced && (c.last_relance_at || hasFreshResponse(c))) return false
        return true
      }),
    [candidates, statusFilter, tpFilter, zoneFilter, showRelanced],
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
      if (next.has(tp)) next.delete(tp)
      else next.add(tp)
      return next
    })
  }

  function toggleZone(zone: ZoneKey) {
    setZoneFilter((prev) => {
      const next = new Set(prev)
      if (next.has(zone)) next.delete(zone)
      else next.add(zone)
      return next
    })
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
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
      const path = sendType === AVAILABILITY ? '/api/relance/send' : '/api/relance/bulk'
      const body =
        sendType === AVAILABILITY ? { ids: selectedIds } : { ids: selectedIds, templateId: sendType }
      const data = await apiJson<SendResult>(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
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
    <div className="mx-auto max-w-6xl px-4 py-8 flex flex-col gap-6">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-purple-light flex items-center justify-center shrink-0">
          <IconMail width={20} height={20} className="text-purple" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--ds-text)]">Relance candidats</h1>
          <p className="text-sm text-[var(--ds-text-subtle)] mt-0.5">
            Choisis un type d'envoi, filtre par statut et métier, sélectionne les destinataires.
          </p>
        </div>
      </div>

      {/* Barre de configuration */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="send-type" className="text-xs font-semibold text-[var(--ds-text-subtle)] uppercase tracking-wide">
            Type d'envoi
          </label>
          <select
            id="send-type"
            value={sendType}
            onChange={(e) => setSendType(e.target.value)}
            className="w-full rounded-[10px] border border-[var(--ds-border)] bg-[var(--ds-surface)] py-2.5 px-3 text-sm text-[var(--ds-text)] outline-none focus:border-purple transition-colors"
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
          <label htmlFor="status-filter" className="text-xs font-semibold text-[var(--ds-text-subtle)] uppercase tracking-wide">
            Statut des candidats
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CandidateStatus | 'ALL')}
            className="w-full rounded-[10px] border border-[var(--ds-border)] bg-[var(--ds-surface)] py-2.5 px-3 text-sm text-[var(--ds-text)] outline-none focus:border-purple transition-colors"
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
          <span className="text-xs font-semibold text-[var(--ds-text-subtle)] uppercase tracking-wide">Type métier</span>
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
                    active ? tpColors(tp) : 'bg-[var(--ds-surface)] text-[var(--ds-text-subtle)] ring-[var(--ds-border)] hover:ring-[var(--ds-border-strong)]'
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
                className="rounded-full px-3 py-1.5 text-xs font-medium text-[var(--ds-text-subtle)] hover:text-[var(--ds-text-muted)]"
              >
                Réinitialiser
              </button>
            )}
          </div>
        </div>

        {/* Filtre par zone géographique */}
        <div className="sm:col-span-2 flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-[var(--ds-text-subtle)] uppercase tracking-wide">Zone géographique</span>
          <div className="flex flex-wrap gap-2">
            {Object.entries(ZONE_LABEL).map(([key, label]) => {
              const k = key as ZoneKey
              const active = zoneFilter.has(k)
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggleZone(k)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-all ${
                    active
                      ? 'bg-[#E0E7FF] text-[#4338CA] ring-[#4338CA]/20'
                      : 'bg-[var(--ds-surface)] text-[var(--ds-text-subtle)] ring-[var(--ds-border)] hover:ring-[var(--ds-border-strong)]'
                  }`}
                >
                  {label}
                </button>
              )
            })}
            {zoneFilter.size > 0 && (
              <button
                type="button"
                onClick={() => setZoneFilter(new Set())}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-[var(--ds-text-subtle)] hover:text-[var(--ds-text-muted)]"
              >
                Réinitialiser
              </button>
            )}
          </div>
        </div>

        {/* Exclure les déjà relancés */}
        <div className="sm:col-span-2 flex items-center gap-2">
          <input
            id="show-relanced"
            type="checkbox"
            checked={showRelanced}
            onChange={() => setShowRelanced((v) => !v)}
            className="h-4 w-4 rounded accent-purple cursor-pointer"
          />
          <label htmlFor="show-relanced" className="text-xs font-semibold text-[var(--ds-text-subtle)] uppercase tracking-wide cursor-pointer">
            Inclure les déjà relancés
          </label>
        </div>

        {/* Aperçu du type d'envoi */}
        <div className="sm:col-span-2 rounded-xl bg-[var(--ds-surface-sunken)] border border-[var(--ds-border)] px-4 py-3 text-sm text-[var(--ds-text-muted)]">
          {sendType === AVAILABILITY ? (
            <span>
              IconMail « Êtes-vous toujours en recherche ? » avec boutons <strong>Oui / Non</strong> — le
              statut du candidat est mis à jour automatiquement à sa réponse.
            </span>
          ) : selectedTemplate ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-[var(--ds-text-subtle)]">
                Objet : <strong className="text-[var(--ds-text-muted)]">{selectedTemplate.subject}</strong>
                {selectedTemplate.attachment ? ` · PJ : ${selectedTemplate.attachment.filename}` : ''}
              </span>
              <div
                className="prose prose-sm max-w-none text-[var(--ds-text-muted)] line-clamp-4"
                dangerouslySetInnerHTML={{ __html: cleanHtml(selectedTemplate.body) }}
              />
            </div>
          ) : (
            <span className="text-[var(--ds-text-subtle)]">Modèle introuvable.</span>
          )}
        </div>
      </div>

      {/* Résultat / erreur */}
      {result && (
        <div className="rounded-xl border border-green-100 bg-[var(--ds-success-bg)] px-5 py-3 flex items-center gap-6">
          <div className="flex items-center gap-2 text-sm text-[var(--ds-success)]">
            <IconCheckCircle width={16} height={16} />
            <span>
              <strong>{result.sent}</strong> mail{result.sent > 1 ? 's' : ''} envoyé
              {result.sent > 1 ? 's' : ''}
            </span>
          </div>
          {result.errors > 0 && (
            <div className="flex items-center gap-2 text-sm text-[var(--ds-danger)]">
              <IconErrorCircle width={16} height={16} />
              <span>
                <strong>{result.errors}</strong> erreur{result.errors > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-[var(--ds-danger)] bg-[var(--ds-danger-bg)] px-5 py-3 text-sm text-[var(--ds-danger)]">{error}</div>
      )}

      {/* Liste des candidats en bento grid */}
      {loading ? (
        <p className="text-sm text-[var(--ds-text-subtle)]">Chargement...</p>
      ) : targets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--ds-border)] py-16 text-center text-sm text-[var(--ds-text-subtle)]">
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
              <span className="font-medium text-[var(--ds-text-muted)]">
                {selectAllChecked ? 'Tout désélectionner' : 'Tout sélectionner'}
              </span>
            </label>
            <span className="flex items-center gap-1.5 text-xs text-[var(--ds-text-subtle)]">
              <IconUsers width={13} height={13} /> {selected.size} / {targets.length} sélectionné{selected.size > 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-[var(--ds-success)]">
              <IconCheckCircle width={13} height={13} /> {respondedCount} répondu{respondedCount > 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-[var(--ds-warning)]">
              <IconClock width={13} height={13} /> {pendingCount} en attente
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
                      : 'border-[var(--ds-border)] bg-[var(--ds-surface)] hover:border-[var(--ds-border)] hover:shadow-sm'
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
                      <p className="text-sm font-semibold text-[var(--ds-text)] truncate">{c.identity.full_name}</p>
                      <p className="text-xs text-[var(--ds-text-subtle)] truncate">{c.identity.email}</p>
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
                    <span className="flex items-center gap-1 text-[11px] text-[var(--ds-text-subtle)]">
                      <IconMapPin width={11} height={11} /> {zone}
                    </span>
                    <span className="ml-auto rounded-md bg-[var(--ds-surface-sunken)] px-2 py-0.5 text-[11px] font-medium text-[var(--ds-text-subtle)]">
                      {CANDIDATE_STATUS_LABELS[c.status as CandidateStatus] ?? c.status}
                    </span>
                  </div>

                  {/* Dates relance / réponse */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[var(--ds-border)]">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wide text-[var(--ds-text-subtle)]">Relancé le</span>
                      <span className="text-xs font-medium text-[var(--ds-text-muted)]">{relanceDate ?? '—'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wide text-[var(--ds-text-subtle)]">Répondu le</span>
                      {responseDate ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-[var(--ds-success)]">
                          <IconCheckCircle width={11} height={11} /> {responseDate}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-medium text-amber-500">
                          <IconClock width={11} height={11} /> En attente
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

      {/* Barre d'action collée en bas de la zone qui défile : reste au-dessus du pied de page. */}
      <div className="sticky bottom-4 z-30 ds-glass-strong rounded-2xl px-4 py-3 shadow-[var(--shadow-sm)]">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <span className="text-sm text-[var(--ds-text-subtle)]">
            {selected.size > 0 ? (
              <>
                <strong className="text-[var(--ds-text)]">{selected.size}</strong> candidat
                {selected.size > 1 ? 's' : ''} sélectionné{selected.size > 1 ? 's' : ''}
              </>
            ) : (
              'Aucun candidat sélectionné'
            )}
          </span>
          <Button
            leftIcon={<IconSend width={16} height={16} />}
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

import { useEffect, useMemo, useState } from 'react'
import { Send, CheckCircle, XCircle, Mail, Users } from 'lucide-react'
import Button from '@/components/ui/Button'
import { useCandidates } from '@/graphql/hooks'
import { CandidateStatus, TrainingSite } from '@/types/candidate'
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

const ZONES: { key: ZoneKey; label: string }[] = [
  { key: 'NORD', label: 'Nord' },
  { key: 'OUEST', label: 'Ouest' },
  { key: 'SUD', label: 'Sud' },
  { key: 'AUTRE', label: 'Non renseigné' },
]

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

export default function Relance() {
  const { candidates, loading } = useCandidates()
  const token = useAuthStore((s) => s.token)
  const templates = useRhMailTemplatesStore((s) => s.templates)
  const loadTemplates = useRhMailTemplatesStore((s) => s.load)

  const [sendType, setSendType] = useState<string>(AVAILABILITY)
  const [statusFilter, setStatusFilter] = useState<CandidateStatus | 'ALL'>(CandidateStatus.SEEKING)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<SendResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  const selectedTemplate = templates.find((t) => t.id === sendType) ?? null

  // Candidats ciblables : email renseigné + filtre statut.
  const targets = useMemo(
    () =>
      candidates.filter(
        (c) => c.identity.email && (statusFilter === 'ALL' || c.status === statusFilter),
      ),
    [candidates, statusFilter],
  )

  // Regroupe les cibles par zone géographique.
  const byZone = useMemo(() => {
    const acc: Record<ZoneKey, Candidate[]> = { NORD: [], OUEST: [], SUD: [], AUTRE: [] }
    for (const c of targets) acc[zoneOf(c)].push(c)
    return acc
  }, [targets])

  // Nettoie la sélection quand le filtre change (des candidats disparaissent de la liste).
  useEffect(() => {
    const validIds = new Set(targets.map((c) => c._id))
    setSelected((prev) => new Set([...prev].filter((id) => validIds.has(id))))
    setResult(null)
    setError(null)
  }, [targets])

  const selectedIds = useMemo(() => [...selected], [selected])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleZone(zoneCandidates: Candidate[]) {
    const ids = zoneCandidates.map((c) => c._id)
    const allSelected = ids.length > 0 && ids.every((id) => selected.has(id))
    setSelected((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)))
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
        sendType === AVAILABILITY
          ? { ids: selectedIds }
          : { ids: selectedIds, templateId: sendType }
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 flex flex-col gap-6 pb-28">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-purple-light flex items-center justify-center shrink-0">
          <Mail size={20} className="text-purple" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Relance candidats</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Choisis un type d'envoi, filtre par statut, sélectionne les destinataires.
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

      {/* Liste des candidats */}
      {loading ? (
        <p className="text-sm text-gray-400">Chargement...</p>
      ) : targets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-sm text-gray-400">
          Aucun candidat avec un email pour ce filtre
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Tout sélectionner (global) */}
          <label className="flex items-center gap-3 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={selectAllChecked}
              onChange={toggleAll}
              className="h-4 w-4 rounded accent-purple cursor-pointer"
            />
            <span className="font-medium text-gray-600">
              {selectAllChecked ? 'Tout désélectionner' : 'Tout sélectionner'}
            </span>
            <span className="ml-auto flex items-center gap-1.5 text-xs text-gray-400">
              <Users size={13} />
              {selected.size} / {targets.length}
            </span>
          </label>

          {ZONES.map(({ key, label }) => {
            const zoneCandidates = byZone[key]
            if (zoneCandidates.length === 0) return null
            const ids = zoneCandidates.map((c) => c._id)
            const allSelected = ids.every((id) => selected.has(id))
            const zoneSelected = ids.filter((id) => selected.has(id)).length

            return (
              <div key={key} className="rounded-xl border border-gray-100 bg-white overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => toggleZone(zoneCandidates)}
                    className="h-4 w-4 rounded accent-purple cursor-pointer"
                  />
                  <span className="text-sm font-semibold text-gray-700">
                    {label}
                    <span className="ml-2 text-xs font-normal text-gray-400">({zoneCandidates.length})</span>
                  </span>
                  <span className="ml-auto text-xs text-gray-400">
                    {zoneSelected} sélectionné{zoneSelected > 1 ? 's' : ''}
                  </span>
                </div>

                {zoneCandidates.map((c) => (
                  <label
                    key={c._id}
                    className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(c._id)}
                      onChange={() => toggle(c._id)}
                      className="h-4 w-4 rounded accent-purple cursor-pointer shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{c.identity.full_name}</p>
                      <p className="text-xs text-gray-400 truncate">{c.identity.email}</p>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      {CANDIDATE_STATUS_LABELS[c.status as CandidateStatus] ?? c.status}
                    </span>
                  </label>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* Barre d'action fixe */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-100 bg-white/95 backdrop-blur px-4 py-3">
        <div className="mx-auto max-w-3xl flex items-center justify-between gap-4">
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

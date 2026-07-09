import { useState } from 'react'
import { Send, CheckCircle, XCircle } from 'lucide-react'
import Button from '@/components/ui/Button'
import { useCandidates } from '@/graphql/hooks'
import { CandidateStatus, TrainingSite } from '@/types/candidate'
import type { Candidate } from '@/types/candidate'
import { useAuthStore } from '@/store/authStore'

interface SendResult {
  sent: number
  errors: number
  total: number
}

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
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sendingZone, setSendingZone] = useState<ZoneKey | null>(null)
  const [results, setResults] = useState<Partial<Record<ZoneKey, SendResult>>>({})
  const [errors, setErrors] = useState<Partial<Record<ZoneKey, string>>>({})

  const seekingCandidates = candidates.filter(
    (c) => c.status === CandidateStatus.SEEKING && c.identity.email,
  )

  // Regroupe les candidats en recherche par zone géographique.
  const byZone: Record<ZoneKey, Candidate[]> = {
    NORD: [],
    OUEST: [],
    SUD: [],
    AUTRE: [],
  }
  for (const c of seekingCandidates) {
    byZone[zoneOf(c)].push(c)
  }

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
      if (allSelected) {
        ids.forEach((id) => next.delete(id))
      } else {
        ids.forEach((id) => next.add(id))
      }
      return next
    })
  }

  async function handleSend(zone: ZoneKey, zoneCandidates: Candidate[]) {
    const ids = zoneCandidates.map((c) => c._id).filter((id) => selected.has(id))
    if (ids.length === 0) return
    setSendingZone(zone)
    setResults((prev) => ({ ...prev, [zone]: undefined }))
    setErrors((prev) => ({ ...prev, [zone]: undefined }))
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/relance/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ids }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur serveur')
      setResults((prev) => ({ ...prev, [zone]: data }))
      setSelected((prev) => {
        const next = new Set(prev)
        ids.forEach((id) => next.delete(id))
        return next
      })
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, [zone]: err.message }))
    } finally {
      setSendingZone(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Relance candidats</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Sélectionne les candidats à relancer par zone géographique — ils recevront un mail pour
          confirmer leur disponibilité
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Chargement...</p>
      ) : seekingCandidates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-sm text-gray-400">
          Aucun candidat en recherche avec un email renseigné
        </div>
      ) : (
        ZONES.map(({ key, label }) => {
          const zoneCandidates = byZone[key]
          if (zoneCandidates.length === 0) return null

          const ids = zoneCandidates.map((c) => c._id)
          const allSelected = ids.every((id) => selected.has(id))
          const zoneSelectedCount = ids.filter((id) => selected.has(id)).length
          const result = results[key]
          const error = errors[key]

          return (
            <div key={key} className="flex flex-col gap-3">
              {/* En-tête de zone */}
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">
                  {label}
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    ({zoneCandidates.length})
                  </span>
                </h2>
                <Button
                  size="sm"
                  leftIcon={<Send size={14} />}
                  disabled={sendingZone !== null || zoneSelectedCount === 0}
                  isLoading={sendingZone === key}
                  onClick={() => handleSend(key, zoneCandidates)}
                >
                  Envoyer{zoneSelectedCount > 0 ? ` (${zoneSelectedCount})` : ''}
                </Button>
              </div>

              {/* Résultat / erreur de zone */}
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
                <div className="rounded-xl border border-red-100 bg-red-50 px-5 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              {/* Liste de la zone */}
              <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => toggleZone(zoneCandidates)}
                    className="h-4 w-4 rounded accent-purple cursor-pointer"
                  />
                  <span className="text-sm font-medium text-gray-600">
                    {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                  </span>
                  <span className="ml-auto text-xs text-gray-400">
                    {zoneSelectedCount} / {zoneCandidates.length} sélectionné
                    {zoneSelectedCount > 1 ? 's' : ''}
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
                    {c.training_site && (
                      <span className="text-xs text-gray-400 shrink-0">{c.training_site}</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

import { useState } from 'react'
import { Send, CheckCircle, XCircle } from 'lucide-react'
import Button from '@/components/ui/Button'
import { useCandidates } from '@/graphql/hooks'
import { CandidateStatus } from '@/types/candidate'
import { useAuthStore } from '@/store/authStore'

interface SendResult {
  sent: number
  errors: number
  total: number
}

export default function Relance() {
  const { candidates, loading } = useCandidates()
  const token = useAuthStore((s) => s.token)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<SendResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const seekingCandidates = candidates.filter(
    (c) => c.status === CandidateStatus.SEEKING && c.identity.email,
  )

  const allSelected = seekingCandidates.length > 0 && selected.size === seekingCandidates.length

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(seekingCandidates.map((c) => c._id)))
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleSend() {
    if (selected.size === 0) return
    setSending(true)
    setResult(null)
    setError(null)
    try {
      const res = await fetch('http://localhost:4000/api/relance/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ids: Array.from(selected) }),
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Relance candidats</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Sélectionne les candidats à relancer — ils recevront un mail pour confirmer leur disponibilité
          </p>
        </div>
        <Button
          leftIcon={<Send size={15} />}
          disabled={sending || selected.size === 0}
          isLoading={sending}
          onClick={handleSend}
        >
          Envoyer{selected.size > 0 ? ` (${selected.size})` : ''}
        </Button>
      </div>

      {/* Résultat */}
      {result && (
        <div className="rounded-xl border border-green-100 bg-green-50 px-5 py-4 flex items-center gap-6">
          <div className="flex items-center gap-2 text-sm text-green-700">
            <CheckCircle size={16} />
            <span><strong>{result.sent}</strong> mail{result.sent > 1 ? 's' : ''} envoyé{result.sent > 1 ? 's' : ''}</span>
          </div>
          {result.errors > 0 && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <XCircle size={16} />
              <span><strong>{result.errors}</strong> erreur{result.errors > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <p className="text-sm text-gray-400">Chargement...</p>
      ) : seekingCandidates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-sm text-gray-400">
          Aucun candidat en recherche avec un email renseigné
        </div>
      ) : (
        <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
          {/* Header avec tout sélectionner */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="h-4 w-4 rounded accent-purple cursor-pointer"
            />
            <span className="text-sm font-medium text-gray-600">
              {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
            </span>
            <span className="ml-auto text-xs text-gray-400">
              {selected.size} / {seekingCandidates.length} sélectionné{selected.size > 1 ? 's' : ''}
            </span>
          </div>

          {/* Candidats */}
          {seekingCandidates.map((c) => (
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
      )}
    </div>
  )
}

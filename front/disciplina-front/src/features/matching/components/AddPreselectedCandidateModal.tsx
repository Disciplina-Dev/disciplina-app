import { useState, useRef, useEffect } from 'react'
import { Search, X, Loader2 } from 'lucide-react'
import { candidateGraphqlClient } from '@/graphql/client'
import { GET_CANDIDATES_PAGE } from '@/graphql/queries'

interface AddPreselectedCandidateModalProps {
  job: {
    id: string
    desiredTP?: string | null
    matchedCandidate?: Array<{ id: string }>
  }
  onSubmit: (candidateId: string, candidateName: string, hasAccepted: boolean) => void
  onClose: () => void
}

export default function AddPreselectedCandidateModal({ job, onSubmit, onClose }: AddPreselectedCandidateModalProps) {
  const [candidateSearch, setCandidateSearch] = useState('')
  const [selectedCandidate, setSelectedCandidate] = useState<{ id: string; fullName: string } | null>(null)
  const [candidates, setCandidates] = useState<Array<{ id: string; fullName?: string; tpType: string }>>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [hasAccepted, setHasAccepted] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const matchedIds = new Set((job.matchedCandidate ?? []).map((c) => c.id))

    if (candidateSearch.length === 0) {
      setCandidates([])
      return
    }

    setIsSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const filters = job.desiredTP ? { tpType: job.desiredTP } : undefined
        const result = await candidateGraphqlClient
          .query(GET_CANDIDATES_PAGE, { first: 20, search: candidateSearch, filters })
          .toPromise()
        if (result.error) {
          setSearchError('Erreur lors de la recherche')
          setCandidates([])
        } else {
          type CandidateNode = { _id: string; identity: { fullName: string }; tpType: string }
          const nodes: CandidateNode[] = (result.data?.candidatesPage?.edges ?? []).map(
            (edge: { node: Record<string, unknown> }) => edge.node as CandidateNode,
          )
          console.log(nodes);
          setCandidates(
            nodes
              .filter((c) => !matchedIds.has(c._id))
              .map((c) => ({ id: c._id, fullName: c.identity.fullName, tpType: c.tpType })),
          )
          setSearchError('')
        }
      } catch {
        setSearchError('Erreur lors de la recherche')
        setCandidates([])
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [candidateSearch, job.desiredTP, job.matchedCandidate])

  const handleSubmit = () => {
    if (!selectedCandidate) return
    onSubmit(selectedCandidate.id, selectedCandidate.fullName, hasAccepted)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <h2 className="text-base font-bold text-gray-900">Ajouter un candidat pré-sélectionné</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-50">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
            <Search size={16} className="text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un candidat..."
              value={candidateSearch}
              onChange={(e) => setCandidateSearch(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm"
            />
          </div>

          {job.desiredTP && (
            <p className="mb-3 text-xs text-gray-400">
              Candidats filtrés par type de TP : <span className="font-semibold">{job.desiredTP}</span>
            </p>
          )}

          {searchError && <p className="mb-3 text-xs text-danger">{searchError}</p>}

          <div className="flex flex-col gap-2">
            {isSearching && candidateSearch.length > 0 && (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-blue" />
              </div>
            )}

            {candidates.length === 0 && !isSearching && candidateSearch.length > 0 && (
              <p className="text-center py-4 text-xs text-gray-400">Aucun candidat trouvé</p>
            )}

            {candidates.map((c) => (
              <button
                key={c.id}
                onClick={() =>
                  setSelectedCandidate(selectedCandidate?.id === c.id ? null : { id: c.id, fullName: c.fullName ?? '' })
                }
                className={`rounded-lg border px-4 py-2.5 text-left text-sm transition-colors ${
                  selectedCandidate?.id === c.id
                    ? 'border-blue bg-blue-light/30 ring-1 ring-blue/20'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <p className="font-medium text-gray-900">
                  {c.fullName}, {c.tpType}
                </p>
              </button>
            ))}
          </div>

          {selectedCandidate && (
            <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50/50 p-3">
              <p className="text-xs font-semibold text-gray-800 mb-1">Candidat sélectionné</p>
              <p className="text-sm text-gray-600 mb-3">{selectedCandidate.fullName}</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasAccepted}
                  onChange={(e) => setHasAccepted(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue focus:ring-blue"
                />
                <span className="text-sm text-gray-700">Le candidat a accepté</span>
              </label>
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2 border-t border-gray-100 p-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedCandidate}
            className="rounded-lg bg-blue px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Ajouter
          </button>
        </div>
      </div>
    </div>
  )
}

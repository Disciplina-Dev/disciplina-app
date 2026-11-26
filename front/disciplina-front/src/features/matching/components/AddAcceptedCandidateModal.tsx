import { useState, useRef, useEffect } from 'react'
import { IconClose, IconLoader, IconSearch } from '@/components/ui/icons'
import { candidateGraphqlClient } from '@/graphql/client'
import { GET_CANDIDATES_PAGE } from '@/graphql/queries'
import TpFilterDropdown from './TpFilterDropdown'

interface AddAcceptedCandidateModalProps {
  job: {
    id: string
    desiredTp?: Array<{ tpType?: string | null }>
    matchedCandidate?: Array<{ id: string }>
  }
  onSubmit: (candidateId: string, candidateName: string) => void
  onClose: () => void
}

export default function AddAcceptedCandidateModal({ job, onSubmit, onClose }: AddAcceptedCandidateModalProps) {
  const offerTps = (job.desiredTp ?? []).map(tp => tp.tpType).filter(Boolean) as string[]
  const [selectedTps, setSelectedTps] = useState<string[]>(offerTps)
  const [candidateSearch, setCandidateSearch] = useState('')
  const [selectedCandidate, setSelectedCandidate] = useState<{ id: string; fullName: string } | null>(null)
  const [candidates, setCandidates] = useState<Array<{ id: string; fullName?: string; tpType: string }>>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

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
        const filters = selectedTps.length ? { tpType: selectedTps } : undefined
        const result = await candidateGraphqlClient
          .query(GET_CANDIDATES_PAGE, { first: 20, search: candidateSearch, filters })
          .toPromise()
        if (result.error) {
          setSearchError('Erreur lors de la recherche')
          setCandidates([])
        } else {
          type CandidateNode = { id: string; identity: { fullName: string }; tpType: string }
          const nodes: CandidateNode[] = (result.data?.candidatesPage?.edges ?? []).map(
            (edge: { node: Record<string, unknown> }) => edge.node as CandidateNode,
          )
          setCandidates(
            nodes
              .filter((c) => !matchedIds.has(c.id))
              .map((c) => ({ id: c.id, fullName: c.identity.fullName, tpType: c.tpType })),
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
  }, [candidateSearch, selectedTps, job.matchedCandidate])

  const handleSubmit = () => {
    if (!selectedCandidate) return
    onSubmit(selectedCandidate.id, selectedCandidate.fullName)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-[var(--ds-surface)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--ds-border)] p-5">
          <h2 className="text-base font-bold text-[var(--ds-text)]">Ajouter un candidat accepté</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-[var(--ds-text-subtle)] hover:bg-[var(--ds-surface-sunken)]">
            <IconClose width={18} height={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-[var(--ds-text-muted)]">Type de TP</label>
            <TpFilterDropdown value={selectedTps} onChange={setSelectedTps} />
          </div>

          <div className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--ds-border)] px-3 py-2">
            <IconSearch width={16} height={16} className="text-[var(--ds-text-subtle)]" />
            <input
              type="text"
              placeholder="Rechercher un candidat..."
              value={candidateSearch}
              onChange={(e) => setCandidateSearch(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm"
            />
          </div>

          {searchError && <p className="mb-3 text-xs text-[var(--ds-danger)]">{searchError}</p>}

          <div className="flex flex-col gap-2">
            {isSearching && candidateSearch.length > 0 && (
              <div className="flex items-center justify-center py-8">
                <IconLoader width={20} height={20} className="animate-spin text-blue" />
              </div>
            )}

            {candidates.length === 0 && !isSearching && candidateSearch.length > 0 && (
              <p className="text-center py-4 text-xs text-[var(--ds-text-subtle)]">Aucun candidat trouvé</p>
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
                    : 'border-[var(--ds-border)] hover:bg-[var(--ds-surface-sunken)]'
                }`}
              >
                <p className="font-medium text-[var(--ds-text)]">
                  {c.fullName}, {c.tpType}
                </p>
              </button>
            ))}
          </div>

          {selectedCandidate && (
            <div className="mt-4 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-sunken)] p-3">
              <p className="text-xs font-semibold text-[var(--ds-text)] mb-1">Candidat sélectionné</p>
              <p className="text-sm text-[var(--ds-text-muted)]">{selectedCandidate.fullName}</p>
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2 border-t border-[var(--ds-border)] p-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--ds-border)] px-4 py-2 text-sm font-semibold text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-sunken)]"
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

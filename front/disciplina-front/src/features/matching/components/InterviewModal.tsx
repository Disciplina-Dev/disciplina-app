import { useState, useRef, useEffect } from 'react'
import { Search, X, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { candidateGraphqlClient } from '@/graphql/client'
import { GET_CANDIDATES_PAGE } from '@/graphql/queries'
import type { Candidate } from '@/types/candidate'

interface InterviewModalProps {
  job: {
    id: string
    companyName?: string
    matchedCandidate?: Array<{ id: string; fullName?: string; tpType?: string }>
  }
  onSubmit: (candidateId: string, location: string, date: string, hour: string) => void
  onClose: () => void
}

export default function InterviewModal({ job, onSubmit, onClose }: InterviewModalProps) {
  const token = useAuthStore((s) => s.token)
  const matchedCandidates = job.matchedCandidate ?? []

  const [step, setStep] = useState<'candidate' | 'details'>('candidate')
  const [candidateSearch, setCandidateSearch] = useState('')
  const [selectedCandidate, setSelectedCandidate] = useState<{ id: string; fullName: string; } | null>(null)
  const [allCandidates, setAllCandidates] = useState<Array<{ id: string; fullName?: string; tpType: string }>>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  const [location, setLocation] = useState('')
  const [locationSearch, setLocationSearch] = useState('')
  const [locationResults, setLocationResults] = useState<string[]>([])
  const [locationError, setLocationError] = useState('')
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationKO, setLocationKO] = useState(false)

  const [date, setDate] = useState('')
  const [hour, setHour] = useState('')

  const debounceCandidateRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const debounceLocationRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Filter matched candidates by name
  const matchedFiltered = matchedCandidates.filter(
    (c) => c.fullName?.toLowerCase().includes(candidateSearch.toLowerCase() || ''),
  )

  // Debounced candidate search in all candidates
  useEffect(() => {
    if (debounceCandidateRef.current) clearTimeout(debounceCandidateRef.current)

    if (candidateSearch.length === 0) {
      setAllCandidates([])
      return
    }

    if (matchedCandidates.some((c) => c.fullName?.toLowerCase().includes(candidateSearch.toLowerCase() || ''))) {
      return
    }

    setIsSearching(true)
    debounceCandidateRef.current = setTimeout(async () => {
      try {
        const result = await candidateGraphqlClient.query(GET_CANDIDATES_PAGE, { first: 20, search: candidateSearch }).toPromise()
        if (result.error) {
          setSearchError('Erreur lors de la recherche')
          setAllCandidates([])
        } else {
          const candidates: Candidate[] = (result.data?.candidatesPage?.edges ?? []).map((edge: { node: Record<string, unknown> }) => edge.node)
          setAllCandidates(candidates.map((e: Candidate) => ({ id: e._id, fullName: e.identity.full_name, tpType: e.tp_type})) ?? [])
          setSearchError('')
        }
      } catch {
        setSearchError('Erreur lors de la recherche')
        setAllCandidates([])
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => {
      if (debounceCandidateRef.current) clearTimeout(debounceCandidateRef.current)
    }
  }, [candidateSearch, matchedCandidates])

  // Debounced location search
  useEffect(() => {
    if (debounceLocationRef.current) clearTimeout(debounceLocationRef.current)

    if (locationSearch.length < 10) {
      setLocationResults([])
      setLocationError('')
      return
    }

    setLocationLoading(true)
    debounceLocationRef.current = setTimeout(async () => {
      try {
        const url = `${import.meta.env.VITE_API_URL}/api/sourcing/completion?input=${encodeURIComponent(locationSearch)}`;
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await response.json()

        if (data.status === 'KO') {
          setLocationKO(true)
          setLocationResults([])
          setLocationError('Service d\'autocomplétion est KO, rentrez manuellement l\'adresse')
        } else if (data.status === 'OK') {
          setLocationKO(false)
          if (data.results?.length === 0) {
            setLocationError('Aucune localisation ne correspond à votre entrée')
          } else {
            setLocationError('')
          }
          setLocationResults(data.results ?? [])
        }
      } catch {
        setLocationKO(true)
        setLocationResults([])
        setLocationError('Service d\'autocomplétion est KO, rentrez manuellement l\'adresse')
      } finally {
        setLocationLoading(false)
      }
    }, 300)

    return () => {
      if (debounceLocationRef.current) clearTimeout(debounceLocationRef.current)
    }
  }, [locationSearch, token])

  const candidateCombined = [...matchedFiltered, ...allCandidates.filter((c) => !matchedCandidates.some((m) => m.id === c.id))]

  const handleCandidateSelect = (id: string, name?: string) => {
    setSelectedCandidate({ id, fullName: name ?? '' })
    setStep('details')
  }

  const handleSubmit = () => {
    if (!selectedCandidate || !location || !date || !hour) return
    onSubmit(selectedCandidate.id, location, date, hour)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <h2 className="text-base font-bold text-gray-900">
            {step === 'candidate' ? 'Sélectionner un candidat' : 'Planifier l\'entretien'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-50">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {step === 'candidate' ? (
            <div>
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

              {searchError && <p className="mb-3 text-xs text-danger">{searchError}</p>}

              <div className="flex flex-col gap-2">
                {isSearching && candidateSearch.length > 0 && matchedFiltered.length === 0 && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={20} className="animate-spin text-blue" />
                  </div>
                )}

                {candidateCombined.length === 0 && !isSearching && candidateSearch.length > 0 && (
                  <p className="text-center py-4 text-xs text-gray-400">Aucun candidat trouvé</p>
                )}

                {candidateCombined.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleCandidateSelect(c.id, c.fullName)}
                    className="rounded-lg border border-gray-200 px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors"
                  >
                    <p className="font-medium text-gray-900">{c.fullName}, {c.tpType}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <p className="mb-2 text-sm font-semibold text-gray-800">Candidat sélectionné</p>
                <p className="text-sm text-gray-600">{selectedCandidate?.fullName}</p>
              </div>

              <div>
                <label className="block mb-2 text-sm font-semibold text-gray-800">Localisation</label>
                <div className="relative">
                  <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
                    <Search size={16} className="text-gray-400" />
                    <input
                      type="text"
                      placeholder="Rechercher une adresse..."
                      value={locationKO ? location : locationSearch}
                      onChange={(e) => {
                        if (!locationKO) {
                          setLocationSearch(e.target.value)
                        } else {
                          setLocation(e.target.value)
                        }
                      }}
                      disabled={locationKO}
                      className="flex-1 bg-transparent outline-none text-sm disabled:text-gray-400"
                    />
                    {locationLoading && <Loader2 size={14} className="animate-spin text-gray-400" />}
                  </div>

                  {locationError && <p className="mt-1 text-xs text-danger">{locationError}</p>}

                  {locationResults.length > 0 && !locationKO && (
                    <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-gray-200 bg-white shadow-sm z-10">
                      {locationResults.map((loc, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setLocation(loc)
                            setLocationSearch(loc)
                            setLocationResults([])
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                        >
                          {loc}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block mb-2 text-sm font-semibold text-gray-800">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue"
                />
              </div>

              <div>
                <label className="block mb-2 text-sm font-semibold text-gray-800">Heure</label>
                <input
                  type="time"
                  value={hour}
                  onChange={(e) => setHour(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2 border-t border-gray-100 p-4">
          <button
            onClick={() => (step === 'details' ? setStep('candidate') : onClose())}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            {step === 'details' ? 'Retour' : 'Annuler'}
          </button>
          {step === 'details' && (
            <button
              onClick={handleSubmit}
              disabled={!selectedCandidate || !location || !date || !hour}
              className="rounded-lg bg-blue px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirmer
            </button>
          )}
          {step === 'candidate' && (
            <button
              onClick={() => handleCandidateSelect(selectedCandidate?.id ?? '', selectedCandidate?.fullName)}
              disabled={!selectedCandidate}
              className="rounded-lg bg-blue px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Suivant
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

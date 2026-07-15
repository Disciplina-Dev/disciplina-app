import { useState, useRef, useEffect } from 'react'
import { Search, X, Loader2, Calendar, Clock } from 'lucide-react'
import { candidateGraphqlClient } from '@/graphql/client'
import { GET_CANDIDATES_PAGE } from '@/graphql/queries'
import LocationAutocompleteInput from './LocationAutocompleteInput'

interface InterviewModalProps {
  job: {
    id: string
    companyName?: string
    matchedCandidate?: Array<{ id: string; fullName?: string; tpType?: string; email?: string }>
  }
  defaultLocation?: string
  onSubmit: (
    candidateId: string,
    location: string,
    dateOrStartDate: string,
    hourOrEndDate: string,
    type: 'interview' | 'immersion',
    email: string,
    candidateName: string,
  ) => void
  onClose: () => void
}

export default function InterviewModal({ job, defaultLocation, onSubmit, onClose }: InterviewModalProps) {
  const matchedCandidates = job.matchedCandidate ?? []

  const [step, setStep] = useState<'candidate' | 'type' | 'details'>('candidate')
  const [candidateSearch, setCandidateSearch] = useState('')
  const [selectedCandidate, setSelectedCandidate] = useState<{ id: string; fullName: string; email: string } | null>(null)
  const [allCandidates, setAllCandidates] = useState<Array<{ id: string; fullName?: string; tpType: string; email: string }>>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  const [selectedType, setSelectedType] = useState<'interview' | 'immersion' | null>(null)
  const [location, setLocation] = useState('')
  const [date, setDate] = useState('')
  const [hour, setHour] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const debounceCandidateRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const matchedFiltered = matchedCandidates.filter(
    (c) => c.fullName?.toLowerCase().includes(candidateSearch.toLowerCase() || ''),
  )

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
          type CandidateNode = { id: string; identity: { fullName: string; email: string }; tpType: string }
          const nodes: CandidateNode[] = (result.data?.candidatesPage?.edges ?? []).map(
            (edge: { node: Record<string, unknown> }) => edge.node as CandidateNode,
          )
          setAllCandidates(nodes.map((e) => ({ id: e.id, fullName: e.identity.fullName, tpType: e.tpType, email: e.identity.email })) ?? [])
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

  useEffect(() => {
    if (step === 'details' && defaultLocation && !location) {
      setLocation(defaultLocation)
    }
  }, [step, defaultLocation, location])

  const candidateCombined = [...matchedFiltered, ...allCandidates.filter((c) => !matchedCandidates.some((m) => m.id === c.id))]

  const handleCandidateSelect = (id: string, name?: string) => {
    const found = candidateCombined.find((c) => c.id === id)
    setSelectedCandidate({ id, fullName: name ?? '', email: found?.email ?? '' })
    setStep('type')
  }

  const handleTypeSelect = (type: 'interview' | 'immersion') => {
    setSelectedType(type)
    setStep('details')
  }

  const handleSubmit = () => {
    if (!selectedCandidate || !location) return
    if (selectedType === 'interview') {
      if (!date || !hour) return
      onSubmit(selectedCandidate.id, location, date, hour, 'interview', selectedCandidate.email, selectedCandidate.fullName)
    } else {
      if (!startDate || !endDate) return
      onSubmit(selectedCandidate.id, location, startDate, endDate, 'immersion', selectedCandidate.email, selectedCandidate.fullName)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <h2 className="text-base font-bold text-gray-900">
            {step === 'candidate' && 'Sélectionner un candidat'}
            {step === 'type' && 'Choisir le type de proposition'}
            {step === 'details' && (selectedType === 'interview' ? "Planifier l'entretien" : "Planifier l'immersion")}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-50">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {step === 'candidate' && (
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
          )}

          {step === 'type' && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="mb-2 text-sm font-semibold text-gray-800">Candidat sélectionné</p>
                <p className="text-sm text-gray-600">{selectedCandidate?.fullName}</p>
              </div>
              <p className="text-sm text-gray-500">Choisissez comment proposer ce candidat à l'entreprise :</p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => handleTypeSelect('interview')}
                  className="flex items-center gap-4 rounded-xl border border-blue/20 bg-blue-light/10 p-4 text-left hover:bg-blue-light/20 transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue/10">
                    <Calendar size={20} className="text-blue" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Entretien</p>
                    <p className="text-xs text-gray-500">Planifier un entretien avec date, heure et localisation</p>
                  </div>
                </button>
                <button
                  onClick={() => handleTypeSelect('immersion')}
                  className="flex items-center gap-4 rounded-xl border border-purple/20 bg-purple/5 p-4 text-left hover:bg-purple/10 transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple/10">
                    <Clock size={20} className="text-purple" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Immersion</p>
                    <p className="text-xs text-gray-500">Proposer une immersion avec dates de début et de fin</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {step === 'details' && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="mb-2 text-sm font-semibold text-gray-800">Candidat sélectionné</p>
                <p className="text-sm text-gray-600">{selectedCandidate?.fullName}</p>
              </div>

              <LocationAutocompleteInput label="Localisation" value={location} onChange={setLocation} />

              {selectedType === 'interview' ? (
                <>
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
                </>
              ) : (
                <>
                  <div>
                    <label className="block mb-2 text-sm font-semibold text-gray-800">Date de début</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue"
                    />
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-semibold text-gray-800">Date de fin</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue"
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2 border-t border-gray-100 p-4">
          <button
            onClick={() => {
              if (step === 'type') setStep('candidate')
              else if (step === 'details') setStep('type')
              else onClose()
            }}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            {step === 'candidate' ? 'Annuler' : 'Retour'}
          </button>
          {step === 'details' && (
            <button
              onClick={handleSubmit}
              disabled={
                !selectedCandidate ||
                !location ||
                (selectedType === 'interview' && (!date || !hour)) ||
                (selectedType === 'immersion' && (!startDate || !endDate))
              }
              className="rounded-lg bg-blue px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirmer
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

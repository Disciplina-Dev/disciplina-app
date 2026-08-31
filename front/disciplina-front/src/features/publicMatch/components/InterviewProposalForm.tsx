import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, Loader2, Search } from 'lucide-react'
import { getMatchAddressCompletion } from '@/api/match'

const ADDRESS_SEARCH_MIN_LENGTH = 10

function formatSlotPreview(iso: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Indian/Reunion',
  })
}

export default function InterviewProposalForm({
  slots,
  onChange,
  location,
  onLocationChange,
  signature,
}: {
  slots: string[]
  onChange: (slots: string[]) => void
  location: string
  onLocationChange: (location: string) => void
  signature: string
}) {
  const [locationSearch, setLocationSearch] = useState(location)
  const [locationResults, setLocationResults] = useState<string[]>([])
  const [locationError, setLocationError] = useState('')
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationKO, setLocationKO] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (locationKO || locationSearch.length < ADDRESS_SEARCH_MIN_LENGTH) {
      setLocationResults([])
      setLocationError('')
      return
    }

    setLocationLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await getMatchAddressCompletion(signature, locationSearch)
        if (data.status === 'KO') {
          setLocationKO(true)
          setLocationResults([])
          setLocationError("Service d'autocomplétion temporairement indisponible, saisissez l'adresse manuellement.")
        } else {
          setLocationResults(data.results ?? [])
          setLocationError(data.results?.length ? '' : 'Adresse non trouvée.')
        }
      } catch {
        setLocationKO(true)
        setLocationResults([])
        setLocationError("Service d'autocomplétion temporairement indisponible, saisissez l'adresse manuellement.")
      } finally {
        setLocationLoading(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [locationSearch, locationKO, signature])

  const updateSlot = (index: number, localValue: string) => {
    const next = [...slots]
    next[index] = localValue ? new Date(`${localValue}:00+04:00`).toISOString() : ''
    onChange(next)
  }

  const toLocalInput = (iso: string): string => {
    if (!iso) return ''
    const parts = new Date(iso).toLocaleString('en-CA', {
      timeZone: 'Indian/Reunion',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    // en-CA gives "2026-08-20, 10:30"
    const [datePart, timePart] = parts.split(', ')
    return `${datePart}T${timePart}`
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-[13px] font-bold text-gray-800">Adresse de l'entretien</p>
        <div className="relative">
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
            <Search size={15} className="text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher une adresse..."
              value={locationKO ? location : locationSearch}
              onChange={(e) => {
                if (locationKO) {
                  onLocationChange(e.target.value)
                } else {
                  setLocationSearch(e.target.value)
                  onLocationChange(e.target.value)
                }
              }}
              className="flex-1 bg-transparent text-[13px] outline-none"
            />
            {locationLoading && <Loader2 size={14} className="animate-spin text-gray-400" />}
          </div>

          {locationError && <p className="mt-1 text-[12px] text-danger">{locationError}</p>}

          {locationResults.length > 0 && !locationKO && (
            <div className="absolute top-full left-0 right-0 z-10 mt-1 rounded-lg border border-gray-200 bg-white shadow-sm">
              {locationResults.map((loc, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    onLocationChange(loc)
                    setLocationSearch(loc)
                    setLocationResults([])
                  }}
                  className="w-full px-3 py-2 text-left text-[13px] text-gray-700 first:rounded-t-lg last:rounded-b-lg hover:bg-gray-50"
                >
                  {loc}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-[13px] font-bold text-gray-800">Créneaux d'entretien proposés</p>
        {slots.map((slot, index) => (
          <div key={index} className="flex items-center gap-2">
            <div className="flex flex-1 flex-col gap-1">
              <input
                type="datetime-local"
                value={toLocalInput(slot)}
                onChange={(e) => updateSlot(index, e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-purple"
              />
              {slot && <p className="text-[12px] text-gray-500">{formatSlotPreview(slot)}</p>}
            </div>
            <button
              onClick={() => onChange(slots.filter((_, i) => i !== index))}
              className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:border-danger hover:text-danger"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        <button
          onClick={() => onChange([...slots, ''])}
          className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-[13px] font-bold text-gray-600 hover:border-purple hover:text-purple"
        >
          <Plus size={15} /> Ajouter un créneau
        </button>
      </div>
    </div>
  )
}

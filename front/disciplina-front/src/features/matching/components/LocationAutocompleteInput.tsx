import { useState, useRef, useEffect } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { apiJson } from '@/api/httpClient'

interface LocationAutocompleteInputProps {
  label: string
  value: string
  onChange: (value: string) => void
}

export default function LocationAutocompleteInput({ label, value, onChange }: LocationAutocompleteInputProps) {
  const [locationSearch, setLocationSearch] = useState('')
  const [locationResults, setLocationResults] = useState<string[]>([])
  const [locationError, setLocationError] = useState('')
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationKO, setLocationKO] = useState(false)

  const debounceLocationRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
        const data = await apiJson<{ status: string; results?: string[] }>(
          `/api/sourcing/completion?input=${encodeURIComponent(locationSearch)}`,
        )

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
  }, [locationSearch])

  return (
    <div>
      <label className="block mb-2 text-sm font-semibold text-gray-800">{label}</label>
      <div className="relative">
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
          <Search size={16} className="text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher une adresse..."
            value={locationKO ? value : locationSearch}
            onChange={(e) => {
              if (!locationKO) {
                setLocationSearch(e.target.value)
              } else {
                onChange(e.target.value)
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
                  onChange(loc)
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
  )
}

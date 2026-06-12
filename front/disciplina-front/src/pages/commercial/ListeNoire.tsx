import { Search, ShieldOff, X } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useCurrentUser } from '@/store/authStore'
import { useBlacklistStore } from '@/store/blacklistStore'
import { useInitializeBlacklist } from '@/graphql/useInitializeBlacklist'
import BlacklistedCompanyCard from '@/features/blacklist/components/BlacklistedCompanyCard'

const PAGE_SIZE = 25

export default function ListeNoire() {
  const currentUser = useCurrentUser()
  const companies = useBlacklistStore((s) => s.companies)

  const [afterCursor, setAfterCursor] = useState<string | undefined>(undefined)
  const [cursorHistory, setCursorHistory] = useState<(string | undefined)[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchInput)
      if (searchInput) {
        setAfterCursor(undefined)
        setCursorHistory([])
      }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchInput])

  const { loading, pageInfo } = useInitializeBlacklist(PAGE_SIZE, afterCursor, debouncedSearch || undefined)

  const loadNextPage = () => {
    if (!pageInfo?.hasNextPage || !pageInfo?.endCursor) return
    setCursorHistory((h) => [...h, afterCursor])
    setAfterCursor(pageInfo.endCursor)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const loadPrevPage = () => {
    if (cursorHistory.length === 0) return
    const prev = cursorHistory[cursorHistory.length - 1]
    setCursorHistory((h) => h.slice(0, -1))
    setAfterCursor(prev)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const hidePagination = !!debouncedSearch

  if (loading && companies.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-background)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-blue border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Chargement des données...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="mx-auto max-w-screen-xl px-4 py-8 sm:px-6 lg:px-8">

        <div className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-1">
                CRM Commercial
              </p>
              <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-gray-900">
                Liste noire
              </h1>
              <p className="mt-1.5 text-[13px] text-gray-400">
                {companies.length.toLocaleString('fr-FR')}{' '}
                entreprise{companies.length !== 1 ? 's' : ''} blacklistée{companies.length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute inset-y-0 left-3.5 my-auto h-4 w-4 text-gray-300" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Recherche par nom ou SIRET…"
                className={[
                  'w-64 rounded-xl border bg-white py-2.5 pl-10 pr-8 text-[13px] text-gray-900',
                  'placeholder:text-gray-300 outline-none transition-all duration-150',
                  searchInput ? 'border-blue/30' : 'border-gray-100',
                  'focus:border-blue focus:shadow-[0_0_0_3px_rgba(17,48,167,0.06)]',
                  'shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]',
                ].join(' ')}
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput('')}
                  className="absolute inset-y-0 right-3 my-auto flex h-5 w-5 items-center justify-center rounded-full text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {companies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-light border border-blue/10">
              <ShieldOff className="h-7 w-7 text-blue" />
            </div>
            <div className="text-center">
              <p className="text-[15px] font-semibold text-gray-900">
                Aucune entreprise blacklistée
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {companies.map((e) => (
              <BlacklistedCompanyCard key={e.id} entreprise={e} currentUser={currentUser!} />
            ))}
          </div>
        )}

        {!hidePagination && (
          <div className="mt-8 flex items-center justify-between rounded-xl bg-white border border-gray-100 px-5 py-4 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)]">
            <button
              type="button"
              onClick={loadPrevPage}
              disabled={cursorHistory.length === 0 || loading}
              className="px-4 py-2 border border-gray-200 text-gray-700 font-semibold text-[13px] rounded-[8px] hover:border-gray-300 bg-white cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Page précédente
            </button>
            <button
              type="button"
              onClick={loadNextPage}
              disabled={!pageInfo?.hasNextPage || loading}
              className="px-4 py-2 border border-gray-200 text-gray-700 font-semibold text-[13px] rounded-[8px] hover:border-gray-300 bg-white cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Page suivante →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

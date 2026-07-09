import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { PageInfo } from '@/types/pagination'

const URL_PARAM = 'v'
const SEARCH_DEBOUNCE_MS = 300

interface ListViewState<TFilters> {
  afterCursor: string | undefined
  cursorHistory: (string | undefined)[]
  search: string
  filters: TFilters
}

interface UrlViewState<TFilters> {
  afterCursor: string | undefined
  search: string
  filters: TFilters
}

function readStoredState<TFilters>(storageKey: string): ListViewState<TFilters> | null {
  try {
    const raw = sessionStorage.getItem(storageKey)
    if (!raw) return null
    return JSON.parse(raw) as ListViewState<TFilters>
  } catch {
    return null
  }
}

function readUrlState<TFilters>(searchParams: URLSearchParams): UrlViewState<TFilters> | null {
  try {
    const raw = searchParams.get(URL_PARAM)
    if (!raw) return null
    return JSON.parse(raw) as UrlViewState<TFilters>
  } catch {
    return null
  }
}

function isSamePosition<TFilters>(url: UrlViewState<TFilters>, stored: ListViewState<TFilters>): boolean {
  return (
    url.afterCursor === stored.afterCursor &&
    url.search === stored.search &&
    JSON.stringify(url.filters) === JSON.stringify(stored.filters)
  )
}

// L'URL ne porte que la position courante (afterCursor/search/filters), pas cursorHistory
// qui grossit sans limite au fil des pages — seul sessionStorage la conserve. Quand l'URL
// et sessionStorage décrivent la même position (refresh dans le même onglet), on récupère
// l'historique complet depuis sessionStorage ; sinon (lien partagé/modifié) on repart sans
// pile "page précédente", faute de pouvoir la reconstruire pour un point d'entrée externe.
function resolveInitialState<TFilters>(
  storageKey: string,
  searchParams: URLSearchParams,
  defaultFilters: TFilters,
): ListViewState<TFilters> {
  const stored = readStoredState<TFilters>(storageKey)
  const fromUrl = readUrlState<TFilters>(searchParams)

  // Fusion avec les défauts : un état persisté antérieur à l'ajout d'un filtre
  // n'a pas ses clés → on les complète pour éviter un `undefined` côté consommateur.
  const withDefaults = (filters: TFilters): TFilters => ({ ...defaultFilters, ...filters })

  if (fromUrl && stored && isSamePosition(fromUrl, stored))
    return { ...stored, filters: withDefaults(stored.filters) }
  if (stored) return { ...stored, filters: withDefaults(stored.filters) }
  if (fromUrl) return { afterCursor: fromUrl.afterCursor, cursorHistory: [], search: fromUrl.search, filters: withDefaults(fromUrl.filters) }
  return { afterCursor: undefined, cursorHistory: [], search: '', filters: defaultFilters }
}

/**
 * Pagination par curseur (relay-style) + recherche + filtres, persistés côté client
 * pour survivre à une navigation vers une page de détail (retour) ou un rechargement.
 */
export function usePersistedListView<TFilters>(storageKey: string, defaultFilters: TFilters) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [initial] = useState(() => resolveInitialState(storageKey, searchParams, defaultFilters))

  const [afterCursor, setAfterCursor] = useState<string | undefined>(initial.afterCursor)
  const [cursorHistory, setCursorHistory] = useState<(string | undefined)[]>(initial.cursorHistory)
  const [searchInput, setSearchInput] = useState(initial.search)
  const [debouncedSearch, setDebouncedSearch] = useState(initial.search)
  const [filters, setFiltersState] = useState<TFilters>(initial.filters)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Réinitialise le curseur uniquement quand la recherche change réellement (comparaison de
  // valeur, pas un flag "premier passage") : au montage searchInput === debouncedSearch déjà,
  // donc même rejoué plusieurs fois (StrictMode double-invoque les effects au montage), ce
  // callback ne touche jamais au curseur restauré.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch((prevDebounced) => {
        if (prevDebounced === searchInput) return prevDebounced
        setAfterCursor(undefined)
        setCursorHistory([])
        return searchInput
      })
    }, SEARCH_DEBOUNCE_MS)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchInput])

  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify({ afterCursor, cursorHistory, search: debouncedSearch, filters }))
    setSearchParams((prev) => {
      prev.set(URL_PARAM, JSON.stringify({ afterCursor, search: debouncedSearch, filters }))
      return prev
    }, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setSearchParams volontairement exclu (référence stable côté react-router, l'inclure ne changerait rien)
  }, [afterCursor, cursorHistory, debouncedSearch, filters, storageKey])

  const setFilters = (next: TFilters) => {
    setFiltersState(next)
    setAfterCursor(undefined)
    setCursorHistory([])
  }

  const loadNextPage = (pageInfo: PageInfo | undefined) => {
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

  return {
    searchInput,
    setSearchInput,
    debouncedSearch,
    filters,
    setFilters,
    afterCursor,
    cursorHistory,
    loadNextPage,
    loadPrevPage,
  }
}

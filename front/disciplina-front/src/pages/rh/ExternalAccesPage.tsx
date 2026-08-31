import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Search, AlertCircle, Filter, X } from 'lucide-react'
import { listExternalAccess, type ExternalAccessConnection, type ExternalAccessType } from '@/api/externalAccess'
import { fetchStaffDirectory, type DirectoryEntry } from '@/api/directory'
import { EXTERNAL_ACCESS_TABS } from '@/constants/externalAccess'
import ExternalAccessRow from '@/features/external/components/ExternalAccessRow'
import Button from '@/components/ui/Button'

const PAGE_SIZE = 20

export default function ExternalAccesPage() {
  const navigate = useNavigate()

  // Filtres affichés
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [activeTab, setActiveTab] = useState<string>('tous')
  const [typeFilter, setTypeFilter] = useState<'' | ExternalAccessType>('')
  const [creatorFilter, setCreatorFilter] = useState<number | ''>('')

  // Pagination (curseur)
  const [connection, setConnection] = useState<ExternalAccessConnection | null>(null)
  const [afterCursor, setAfterCursor] = useState<string | null>(null)
  const [cursorHistory, setCursorHistory] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Annuaire pour le filtre « créé par »
  const [directors, setDirectors] = useState<DirectoryEntry[]>([])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    fetchStaffDirectory().then(setDirectors).catch(() => {})
  }, [])

  // Charge une page (curseur) selon les filtres courants.
  const load = async (after: string | null) => {
    const tab = EXTERNAL_ACCESS_TABS.find((t) => t.key === activeTab)
    setLoading(true)
    setError(null)
    try {
      const res = await listExternalAccess({
        first: PAGE_SIZE,
        after,
        search: debouncedSearch || undefined,
        type: typeFilter || undefined,
        status: tab && tab.statuses ? tab.statuses.join(',') : undefined,
        userId: creatorFilter !== '' ? creatorFilter : undefined,
      })
      setConnection(res)
      setAfterCursor(res.pageInfo.endCursor)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement des accès externes")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setCursorHistory([])
    setAfterCursor(null)
    load(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, activeTab, typeFilter, creatorFilter])

  const loadNext = () => {
    if (!connection?.pageInfo.hasNextPage) return
    setCursorHistory((h) => [...h, afterCursor!])
    load(afterCursor)
  }

  const loadPrev = () => {
    if (cursorHistory.length === 0) return
    const prev = cursorHistory[cursorHistory.length - 1]
    setCursorHistory((h) => h.slice(0, -1))
    load(prev)
  }

  const refresh = () => {
    setCursorHistory([])
    setAfterCursor(null)
    load(null)
  }

  const resetFilters = () => {
    setSearch('')
    setDebouncedSearch('')
    setActiveTab('tous')
    setTypeFilter('')
    setCreatorFilter('')
  }

  const hasFilters = Boolean(debouncedSearch || typeFilter || creatorFilter !== '')
  const rows = connection?.edges ?? []

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 flex flex-col gap-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            aria-label="Retour"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">Accès externes</h1>
            <p className="text-sm text-gray-400 mt-0.5">Gestion des liens envoyés aux entreprises et candidats</p>
          </div>
        </div>
      </div>

      {/* ── Recherche + filtres ── */}
      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm flex flex-col gap-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom (entreprise / candidat)…"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-8 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue focus:outline-none focus:ring-2 focus:ring-blue/20"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Effacer la recherche"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Onglets de statut */}
        <div className="flex gap-1 rounded-xl bg-gray-50 border border-gray-100 p-1">
          {EXTERNAL_ACCESS_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                activeTab === t.key
                  ? 'bg-white text-purple shadow-sm'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-white/60'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Filtres fins */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 text-xs font-semibold text-gray-400">
            <Filter size={13} /> Filtres
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as '' | ExternalAccessType)}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700 focus:border-blue focus:outline-none"
          >
            <option value="">Type : tous</option>
            <option value="COMPANY">Entreprise</option>
            <option value="CANDIDATE">Candidat</option>
          </select>
          <select
            value={creatorFilter}
            onChange={(e) => setCreatorFilter(e.target.value === '' ? '' : Number(e.target.value))}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700 focus:border-blue focus:outline-none"
          >
            <option value="">Créé par : tous</option>
            {directors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.firstName} {d.lastName}
              </option>
            ))}
          </select>
          {hasFilters && (
            <button
              onClick={resetFilters}
              className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800"
            >
              <X size={13} /> Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* ── Résultats ── */}
      {loading && !connection ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
          <Loader2 size={24} className="animate-spin" />
          <p className="text-sm">Chargement des accès externes…</p>
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          <AlertCircle size={16} />
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white px-4 py-16 text-center text-sm text-gray-400">
          Aucun accès externe ne correspond à ces critères.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((edge) => (
            <ExternalAccessRow key={edge.node.signature} access={edge.node} onChanged={refresh} />
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {!loading && !error && rows.length > 0 && (
        <div className="mt-2 flex items-center justify-between rounded-xl bg-white border border-gray-100 px-5 py-4 shadow-sm">
          <Button variant="secondary" size="sm" onClick={loadPrev} disabled={cursorHistory.length === 0 || loading}>
            ← Page précédente
          </Button>
          <span className="text-sm text-gray-500">
            {rows.length} accès sur cette page
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={loadNext}
            disabled={!connection?.pageInfo.hasNextPage || loading}
          >
            Page suivante →
          </Button>
        </div>
      )}
    </div>
  )
}

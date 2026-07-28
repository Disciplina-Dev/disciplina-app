import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Loader2, Search, X, Plus } from 'lucide-react'
import { usePersistedListView } from '@/hooks/usePersistedListView'
import { useNeedsAnalysesPage } from '@/graphql/hooks'
import { useCurrentUser, Permission } from '@/store/authStore'
import NeedsAnalysisCard from '@/features/matching/components/NeedsAnalysisCard'
import { JobFilters } from '@/features/matching/components/JobFilters'
import { CompanySearchModal } from '@/features/matching/components/CompanySearchModal'
import { EMPTY_JOB_FILTERS, toOfferFilterInput } from '@/features/matching/services/jobFilters'
import type { JobFilters as JobFiltersType } from '@/features/matching/services/jobFilters'
import Matching from '@/pages/rh/Matching'

const PAGE_SIZE = 25

// Route `/rh/matching` : liste des AB, sauf si une AB est sélectionnée (?needsAnalysis)
// où l'on rend le matching existant. Le branchement se fait avant le hook de liste
// pour ne pas manipuler l'URL (param `v`) pendant la vue matching.
export default function NeedsAnalysisList() {
  const [searchParams] = useSearchParams()
  if (searchParams.get('needsAnalysis')) return <Matching />
  return <AbListView />
}

function AbListView() {
  const navigate = useNavigate()
  const currentUser = useCurrentUser()
  const [showCompanySearch, setShowCompanySearch] = useState(false)
  const canAddCompany =
    currentUser?.permission === Permission.RESPONSABLE || currentUser?.permission === Permission.ADMIN
  const {
    searchInput,
    setSearchInput,
    debouncedSearch,
    filters,
    setFilters,
    afterCursor,
    cursorHistory,
    loadNextPage,
    loadPrevPage,
  } = usePersistedListView<JobFiltersType>('disciplina:list-view:ab', EMPTY_JOB_FILTERS)

  const offerFilter = toOfferFilterInput(filters, debouncedSearch)
  const { items, pageInfo, loading, error } = useNeedsAnalysesPage(PAGE_SIZE, afterCursor, offerFilter)

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">Analyses de besoin</h1>
        {canAddCompany && (
          <button
            onClick={() => setShowCompanySearch(true)}
            className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-500 transition hover:border-gray-400 hover:text-gray-700"
          >
            <Plus size={16} />
            Ajouter des entreprises
          </button>
        )}
      </div>

      <div className="mb-6 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par entreprise..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-lg border border-gray-100 py-2 pl-9 pr-9 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <JobFilters hideSearch filters={filters} onChange={setFilters} />
      </div>

      {loading && items.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <Loader2 size={28} className="animate-spin text-blue" />
          <p className="text-sm text-gray-400">Chargement des analyses de besoin…</p>
        </div>
      ) : error ? (
        <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-danger">
          Erreur lors du chargement des analyses de besoin.
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white px-6 py-16 text-center text-sm text-gray-400">
          Aucune analyse de besoin.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((analysis) => (
            <NeedsAnalysisCard
              key={analysis.id}
              analysis={analysis}
              onClick={() => navigate(`/rh/matching?needsAnalysis=${analysis.id}`)}
            />
          ))}
        </div>
      )}

      <div className="mt-8 flex items-center justify-between rounded-xl border border-gray-100 bg-white px-5 py-4 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)]">
        <button
          type="button"
          onClick={loadPrevPage}
          disabled={cursorHistory.length === 0 || loading}
          className="cursor-pointer rounded-[8px] border border-gray-200 bg-white px-4 py-2 text-[13px] font-semibold text-gray-700 transition-all hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Page précédente
        </button>
        <button
          type="button"
          onClick={() => loadNextPage(pageInfo)}
          disabled={!pageInfo?.hasNextPage || loading}
          className="cursor-pointer rounded-[8px] border border-gray-200 bg-white px-4 py-2 text-[13px] font-semibold text-gray-700 transition-all hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Page suivante →
        </button>
      </div>

      <CompanySearchModal
        open={showCompanySearch}
        onClose={() => setShowCompanySearch(false)}
        currentUser={currentUser}
      />
    </div>
  )
}

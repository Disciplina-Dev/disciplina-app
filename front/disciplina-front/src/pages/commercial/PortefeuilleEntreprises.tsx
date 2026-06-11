import {
  Search,
  Plus,
  Building2,
  X,
  SlidersHorizontal,
} from 'lucide-react'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { parseISO } from 'date-fns'
import type { Entreprise, EntrepriseFilters } from '@/types/entreprise'
import { useCurrentUser } from '@/store/authStore'
import { usePortefeuilleStore } from '@/store/portefeuilleStore'
import { useInitializePortfolio } from '@/graphql/useInitializePortfolio'
import EntrepriseCard from '@/features/portefeuille/components/EntrepriseCard'
import CreateEditModal from '@/features/portefeuille/components/CreateEditModal'
import FilterPanel, { EMPTY_FILTERS } from '@/features/portefeuille/components/FilterPanel'
import Button from '@/components/ui/Button'
import { useCreateCompany } from '@/graphql/hooks'
import { toSlug } from '@/utils/slug'
import { toCompany } from '@/types/companyMapper'
import { formatErrorMessage } from '@/utils/companyErrors'

const PAGE_SIZE = 25

// ─── Helpers ──────────────────────────────────────────────────────────────────
function countActiveFilters(f: EntrepriseFilters): number {
  let n = 0
  if (f.status.length) n++
  if (f.commercial) n++
  if (f.secteur) n++
  if (f.relance_proche) n++
  if (f.unassigned_only) n++
  if (f.date_insertion_from) n++
  if (f.date_insertion_to) n++
  return n
}

function normalise(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PortefeuilleEntreprises() {
  const currentUser = useCurrentUser()
  const navigate = useNavigate()
  const companies = usePortefeuilleStore((s) => s.companies)
  const { createCompany } = useCreateCompany();
  const updateCompany = usePortefeuilleStore((s) => s.updateCompany)

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

  const { loading, pageInfo } = useInitializePortfolio(PAGE_SIZE, afterCursor, debouncedSearch || undefined)

  const [filters, setFilters] = useState<EntrepriseFilters>(EMPTY_FILTERS)
  const [createOpen, setCreateOpen] = useState(false)
  const [prefillSiret, setPrefillSiret] = useState<string | undefined>()

  const allEntreprises = companies

  const secteurs = useMemo(() => {
    const raw = new Set(allEntreprises.map((e) => e.secteur).filter(Boolean) as string[])
    return Array.from(raw).sort((a, b) => a.localeCompare(b, 'fr'))
  }, [allEntreprises])

  const filtered = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return companies.filter((e) => {
      if (filters.status.length && !filters.status.includes(e.status)) return false
      if (filters.commercial && normalise(e.commercial ?? '') !== normalise(filters.commercial)) return false
      if (filters.secteur && normalise(e.secteur ?? '') !== normalise(filters.secteur)) return false
      if (filters.relance_proche) {
        if (!e.date_relance) return false
        try {
          const relance = parseISO(e.date_relance)
          const diffMs = relance.getTime() - today.getTime()
          const diffDays = diffMs / 86400000
          if (diffDays < -2 || diffDays > 2) return false
        } catch { return false }
      }
      if (filters.unassigned_only && e.proprietaire_id) return false
      if (filters.date_insertion_from && e.date_insertion) {
        try { if (parseISO(e.date_insertion) < new Date(filters.date_insertion_from)) return false }
        catch { /* skip */ }
      }
      if (filters.date_insertion_to && e.date_insertion) {
        try {
          const to = new Date(filters.date_insertion_to)
          to.setHours(23, 59, 59, 999)
          if (parseISO(e.date_insertion) > to) return false
        } catch { /* skip */ }
      }
      return true
    })
  }, [companies, filters])

  const handleFilterChange = (f: EntrepriseFilters) => {
    setFilters(f)
    setAfterCursor(undefined)
    setCursorHistory([])
  }

  const handleCreate = async (data: Partial<Entreprise>) => {
    const company = toCompany(data);
    try {
      const response = await createCompany(company);
      if (response.error) {
        const friendlyMsg = formatErrorMessage(response.error.message, data.siret);
        alert(`Erreur lors de la création : ${friendlyMsg}`);
        return;
      }
      setCreateOpen(false)
      setPrefillSiret(undefined)
    } catch (err: any) {
      console.error(err);
      alert(`Erreur lors de la création : ${err.message || err}`);
    }
  }

  const handleClaim = (id: string, userId: number, userName: string) => {
    updateCompany(id, { proprietaire_id: userId, commercial: userName })
  }

  const openCreate = (siret?: string) => {
    setPrefillSiret(siret)
    setCreateOpen(true)
  }

  const activeFilterCount = countActiveFilters(filters)

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

        {/* ─── Page header ─────────────────────────────────────────── */}
        <div className="mb-8">
          {/* Top row: title + actions */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-1">
                CRM Commercial
              </p>
              <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-gray-900">
                Portefeuille entreprises
              </h1>
              <p className="mt-1.5 text-[13px] text-gray-400">
                {filtered.length.toLocaleString('fr-FR')}{' '}
                entreprise{filtered.length !== 1 ? 's' : ''}
                {activeFilterCount > 0 && (
                  <span className="ml-1 text-blue font-medium">— vue filtrée</span>
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
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
              <Button
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => openCreate()}
                className="rounded-xl shadow-[0_2px_8px_-2px_rgba(17,48,167,0.30)]"
              >
                Nouvelle fiche
              </Button>
            </div>
          </div>

          {/* Filter toolbar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtres
            </div>
            <div className="h-4 w-px bg-gray-200" />
            <FilterPanel
              filters={filters}
              secteurs={secteurs}
              onChange={handleFilterChange}
              onReset={() => handleFilterChange(EMPTY_FILTERS)}
              activeCount={activeFilterCount}
            />
          </div>
        </div>

        {/* ─── Cards grid ──────────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-light border border-blue/10">
              <Building2 className="h-7 w-7 text-blue" />
            </div>
            <div className="text-center">
              <p className="text-[15px] font-semibold text-gray-900">
                Aucune entreprise trouvée
              </p>
              <p className="text-[13px] text-gray-400 mt-1 max-w-xs">
                {activeFilterCount > 0
                  ? 'Essayez de modifier ou supprimer vos filtres actifs.'
                  : 'Commencez par créer une première fiche entreprise.'}
              </p>
            </div>
            {activeFilterCount > 0 ? (
              <Button variant="secondary" size="sm" onClick={() => handleFilterChange(EMPTY_FILTERS)}>
                Effacer les filtres
              </Button>
            ) : (
              <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => openCreate()}>
                Créer une fiche
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filtered.map((e) => (
              <EntrepriseCard
                key={e.id}
                entreprise={e}
                currentUser={currentUser!}
                onClick={() => navigate(`/commercial/portefeuille/${toSlug(e.nom_commercial ?? e.id)}`, { state: { entreprise: e } })}
                onClaim={() => handleClaim(e.id, Number(currentUser!.id), currentUser!.name)}
              />
            ))}
          </div>
        )}

        {/* ─── Pagination ──────────────────────────────────────────── */}
        {!debouncedSearch && <div className="mt-8 flex items-center justify-between rounded-xl bg-white border border-gray-100 px-5 py-4 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)]">
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
        </div>}
      </div>

      {/* ─── Modals ──────────────────────────────────────────────── */}
      {createOpen && (
        <CreateEditModal
          mode="create"
          prefillSiret={prefillSiret}
          currentUser={currentUser!}
          onSave={handleCreate}
          onClose={() => { setCreateOpen(false); setPrefillSiret(undefined) }}
        />
      )}
    </div>
  )
}

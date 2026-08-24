import {
  Search,
  Plus,
  Building2,
  X,
  SlidersHorizontal,
} from 'lucide-react'
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { EntrepriseFilters } from '@/types/entreprise'
import { useCurrentUser } from '@/store/authStore'
import { usePortefeuilleStore } from '@/store/portefeuilleStore'
import { useInitializePortfolio, type ServerFilters } from '@/graphql/useInitializePortfolio'
import { useInitializePortfolioBySiren } from '@/graphql/useInitializePortfolioBySiren'
import { usePersistedListView } from '@/hooks/usePersistedListView'
import EntrepriseCard from '@/features/portefeuille/components/EntrepriseCard'
import { SirenGroupCard } from '@/features/portefeuille/components/SirenGroupCard'
import CreateEditModal from '@/features/portefeuille/components/CreateEditModal'
import FilterPanel, { EMPTY_FILTERS } from '@/features/portefeuille/components/FilterPanel'
import Button from '@/components/ui/Button'
import { useCreateCompany, useDeleteCompany } from '@/graphql/hooks'
import DeleteCompanyModal from '@/features/portefeuille/components/DeleteCompanyModal'
import { toSlug } from '@/utils/slug'
import { toCompany } from '@/types/companyMapper'
import { formatErrorMessage } from '@/utils/companyErrors'
import type { Entreprise } from '@/types/entreprise'
import { SECTEUR_VALUES, STATUS_VALUES } from '@/types/entreprise'

const PAGE_SIZE = 20

// ─── Tabs ─────────────────────────────────────────────────────────────────────
type CompanyTab = 'all' | 'oui' | 'aRelancer' | 'ferme'

const TAB_STATUS_MAP: Record<Exclude<CompanyTab, 'all'>, string[]> = {
  oui: ['Oui', 'Oui OF'],
  aRelancer: ['Non', 'À Réfléchir', 'Relance', 'Réponds pas'],
  ferme: ['Fermé'],
}

const TAB_LABELS: Record<CompanyTab, string> = {
  all: 'Tous',
  oui: 'Oui',
  aRelancer: 'À Relancer',
  ferme: 'Fermé',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function countActiveFilters(f: EntrepriseFilters): number {
  let n = 0
  if (f.status.length) n++
  if (f.commercial_id != null) n++
  if (f.secteur) n++
  if (f.relance) n++
  if (f.unassigned_only) n++
  if (f.date_insertion_from) n++
  if (f.date_insertion_to) n++
  return n
}

function toServerFilters(f: EntrepriseFilters, tab: CompanyTab): ServerFilters | undefined {
  const status = tab !== 'all'
    ? TAB_STATUS_MAP[tab]
    : f.status.length > 0 ? f.status : undefined
  if (!status && countActiveFilters(f) === 0) return undefined
  return {
    status,
    userID: f.commercial_id ?? undefined,
    sector: f.secteur || undefined,
    relance: f.relance || undefined,
    unassigned: f.unassigned_only || undefined,
    createdFrom: f.date_insertion_from || undefined,
    createdTo: f.date_insertion_to || undefined,
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PortefeuilleEntreprises() {
  const currentUser = useCurrentUser()
  const navigate = useNavigate()
  const companies = usePortefeuilleStore((s) => s.companies)
  const sirenGroups = usePortefeuilleStore((s) => s.sirenGroups)
  const salePersons = usePortefeuilleStore((s) => s.salePersons)
  const { createCompany } = useCreateCompany()
  const { deleteCompany, result: deleteResult } = useDeleteCompany()
  const updateCompany = usePortefeuilleStore((s) => s.updateCompany)

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
  } = usePersistedListView<EntrepriseFilters>('disciplina:list-view:portefeuille', EMPTY_FILTERS, {
    status: STATUS_VALUES,
    relance: ['', 'today', 'past', 'future'],
  })

  const [createOpen, setCreateOpen] = useState(false)
  const [prefillSiret, setPrefillSiret] = useState<string | undefined>()
  const [createError, setCreateError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Entreprise | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<CompanyTab>('all')

  // Un seul filtre de statut actif à la fois : un onglet écrase la sélection
  // manuelle, une sélection manuelle ramène sur « Tous ».
  const handleTabChange = (tab: CompanyTab) => {
    setActiveTab(tab)
    if (tab !== 'all' && filters.status.length > 0) {
      setFilters({ ...filters, status: [] })
    }
  }

  const handlePanelChange = (next: EntrepriseFilters) => {
    const statusChanged =
      next.status.length !== filters.status.length ||
      next.status.some((s) => !filters.status.includes(s))
    if (statusChanged) setActiveTab('all')
    setFilters(next)
  }

  const resetAll = () => {
    setActiveTab('all')
    setFilters(EMPTY_FILTERS)
  }

  const serverFilters = useMemo(() => toServerFilters(filters, activeTab), [filters, activeTab])
  const isRelanceMode = !!filters.relance

  // Vue à plat en recherche/relance (la query groupée ne les gère pas), sinon groupée par SIREN.
  const isFlatMode = !!debouncedSearch || isRelanceMode
  const flat = useInitializePortfolio(PAGE_SIZE, afterCursor, debouncedSearch || undefined, serverFilters, !isFlatMode)
  const grouped = useInitializePortfolioBySiren(PAGE_SIZE, afterCursor, serverFilters, isFlatMode)

  const loading = isFlatMode ? flat.loading : grouped.loading
  const pageInfo = isFlatMode ? flat.pageInfo : grouped.pageInfo
  const isEmpty = isFlatMode ? companies.length === 0 : sirenGroups.length === 0

  const secteurs = SECTEUR_VALUES as unknown as string[]

  const handleCreate = async (data: Partial<Entreprise>) => {
    const company = toCompany(data)
    setCreateError(null)
    try {
      const response = await createCompany(company)
      if (response.error) {
        setCreateError(formatErrorMessage(response.error.message, data.siret))
        return
      }
      setCreateOpen(false)
      setPrefillSiret(undefined)
    } catch (err: any) {
      setCreateError(err.message || String(err))
    }
  }

  const handleClaim = (id: string, userId: number, userName: string) => {
    updateCompany(id, { proprietaire_id: userId, commercial: userName })
  }

  const openCreate = (siret?: string) => {
    setPrefillSiret(siret)
    setCreateOpen(true)
  }

  const handleDeleteRequest = (entreprise: Entreprise) => {
    setDeleteTarget(entreprise)
    setDeleteError(null)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleteError(null)
    const response = await deleteCompany(Number(deleteTarget.id))
    if (response.error) {
      setDeleteError(response.error.message)
      return
    }
    setDeleteTarget(null)
  }

  const renderCard = (e: Entreprise) => (
    <EntrepriseCard
      key={e.id}
      entreprise={e}
      currentUser={currentUser!}
      onClick={() => navigate(`/commercial/portefeuille/${toSlug(e.nom_commercial ?? e.id)}`, { state: { entreprise: e } })}
      onClaim={() => handleClaim(e.id, Number(currentUser!.id), `${currentUser!.firstName ?? ''} ${currentUser!.lastName ?? ''}`.trim())}
      onDelete={handleDeleteRequest}
    />
  )

  const activeFilterCount = countActiveFilters(filters)

  const hidePagination = debouncedSearch || isRelanceMode

  // « X trouvés sur Y » : X = entrées affichées sur la page, Y = total correspondant
  // à la recherche + filtres actifs (calculé côté serveur).
  const shownCompanies = isFlatMode
    ? companies.length
    : sirenGroups.reduce((sum, g) => sum + g.entreprises.length, 0)
  const shownSirens = isFlatMode ? 0 : sirenGroups.length
  const totalCount = isFlatMode ? flat.totalCount : grouped.totalCount

  if (loading && isEmpty) {
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
                {isFlatMode ? (
                  <>
                    {shownCompanies.toLocaleString('fr-FR')} entreprise{shownCompanies !== 1 ? 's' : ''} trouvée{shownCompanies !== 1 ? 's' : ''} sur {totalCount.toLocaleString('fr-FR')}
                  </>
                ) : (
                  <>
                    {shownSirens.toLocaleString('fr-FR')} SIREN trouvé{shownSirens !== 1 ? 's' : ''} sur {totalCount.toLocaleString('fr-FR')}
                    {shownCompanies > 0 && (
                      <span className="text-gray-400"> — {shownCompanies.toLocaleString('fr-FR')} entreprise{shownCompanies !== 1 ? 's' : ''}</span>
                    )}
                  </>
                )}
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
              salePersons={salePersons}
              onChange={handlePanelChange}
              onReset={resetAll}
              activeCount={activeFilterCount}
            />
          </div>
        </div>

        {/* ─── Status tabs ─────────────────────────────────────────── */}
        <div className="mb-6 flex gap-1 rounded-xl bg-white border border-gray-100 p-1 shadow-sm">
          {(Object.keys(TAB_LABELS) as CompanyTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                activeTab === tab ? 'bg-blue text-white shadow-sm' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* ─── Cards grid ──────────────────────────────────────────── */}
        {isEmpty ? (
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
              <Button variant="secondary" size="sm" onClick={resetAll}>
                Effacer les filtres
              </Button>
            ) : activeTab !== 'all' ? (
              <Button variant="secondary" size="sm" onClick={() => handleTabChange('all')}>
                Voir toutes les entreprises
              </Button>
            ) : (
              <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => openCreate()}>
                Créer une fiche
              </Button>
            )}
          </div>
        ) : isFlatMode ? (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {companies.map(renderCard)}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {sirenGroups.map((group) => (
              <SirenGroupCard
                key={group.siren}
                group={group}
                currentUser={currentUser!}
                onOpen={(e) => navigate(`/commercial/portefeuille/${toSlug(e.nom_commercial ?? e.id)}`, { state: { entreprise: e } })}
                onClaim={(e) => handleClaim(e.id, Number(currentUser!.id), `${currentUser!.firstName ?? ''} ${currentUser!.lastName ?? ''}`.trim())}
                onDelete={handleDeleteRequest}
              />
            ))}
          </div>
        )}

        {/* ─── Pagination ──────────────────────────────────────────── */}
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
              onClick={() => loadNextPage(pageInfo)}
              disabled={!pageInfo?.hasNextPage || loading}
              className="px-4 py-2 border border-gray-200 text-gray-700 font-semibold text-[13px] rounded-[8px] hover:border-gray-300 bg-white cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Page suivante →
            </button>
          </div>
        )}
      </div>

      {/* ─── Modals ──────────────────────────────────────────────── */}
      {createOpen && (
        <CreateEditModal
          mode="create"
          prefillSiret={prefillSiret}
          currentUser={currentUser!}
          onSave={handleCreate}
          submitError={createError}
          onClose={() => { setCreateOpen(false); setPrefillSiret(undefined); setCreateError(null) }}
        />
      )}
      {deleteTarget && (
        <DeleteCompanyModal
          entreprise={deleteTarget}
          onClose={() => { setDeleteTarget(null); setDeleteError(null) }}
          onConfirm={handleDeleteConfirm}
          loading={deleteResult.fetching}
          error={deleteError}
        />
      )}
    </div>
  )
}

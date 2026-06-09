import {
  Search,
  Plus,
  Building2,
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle,
  SlidersHorizontal,
} from 'lucide-react'
import { useState, useMemo, useCallback } from 'react'
import { isSameDay, parseISO } from 'date-fns'
import type { Entreprise, EntrepriseFilters } from '@/types/entreprise'
import { useAuthStore, useCurrentUser, USERS } from '@/store/authStore'
import { usePortefeuilleStore } from '@/store/portefeuilleStore'
import { useInitializePortfolio } from '@/graphql/useInitializePortfolio'
import EntrepriseCard from '@/features/portefeuille/components/EntrepriseCard'
import DetailModal from '@/features/portefeuille/components/DetailModal'
import CreateEditModal from '@/features/portefeuille/components/CreateEditModal'
import NeedsAnalysisModal from '@/features/abEntreprise/components/NeedsAnalysisModal'
import FilterPanel, { EMPTY_FILTERS } from '@/features/portefeuille/components/FilterPanel'
import Button from '@/components/ui/Button'
import { useUpdateCompany, useCreateCompany } from '@/graphql/hooks'
import { toCompany } from '@/types/companyMapper'

const PAGE_SIZE = 25

// ─── User switcher ────────────────────────────────────────────────────────────
function UserSwitcher() {
  const currentUserId = useAuthStore((s) => s.user?.id)
  const setUser = useAuthStore((s) => s.setUser)
  const user = USERS[currentUserId!]

  return (
    <div className="flex items-center gap-2.5">
      <span className="hidden sm:block text-[11px] font-medium text-gray-400 uppercase tracking-wider">
        Session
      </span>
      <div className="flex items-center rounded-xl border border-gray-100 bg-white overflow-hidden shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]">
        {Object.values(USERS).map((u) => (
          <button
            key={u.id}
            onClick={() => setUser(USERS[u.id])}
            title={`${u.name} — ${u.role}`}
            className={[
              'relative flex items-center gap-2 px-3.5 py-2.5 text-[12px] font-medium transition-all duration-150',
              'border-r border-gray-100 last:border-r-0',
              u.id === user.id ? 'text-white' : 'text-gray-500 hover:bg-gray-50',
            ].join(' ')}
            style={u.id === user.id ? { backgroundColor: u.color } : undefined}
          >
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full text-white text-[9px] font-bold shrink-0"
              style={{
                backgroundColor:
                  u.id === user.id ? 'rgba(255,255,255,0.25)' : u.color,
              }}
            >
              {u.initials}
            </span>
            <span className="hidden md:block">{u.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── SIRET Search ─────────────────────────────────────────────────────────────
interface SiretSearchProps {
  onFound: (e: Entreprise) => void
  onNotFound: (siret: string) => void
}

function SiretSearch({ onFound, onNotFound }: SiretSearchProps) {
  const [value, setValue] = useState('')
  const [result, setResult] = useState<'found' | 'not_found' | null>(null)
  const [foundEntry, setFoundEntry] = useState<Entreprise | null>(null)
  const getCompanyBySiret = usePortefeuilleStore((s) => s.getCompanyBySiret)

  const handleSearch = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed) return
    const entry = getCompanyBySiret(trimmed)
    if (entry) {
      setResult('found')
      setFoundEntry(entry)
    } else {
      setResult('not_found')
      setFoundEntry(null)
    }
  }, [value, getCompanyBySiret])

  const clear = () => {
    setValue('')
    setResult(null)
    setFoundEntry(null)
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute inset-y-0 left-3.5 my-auto h-4 w-4 text-gray-300" />
          <input
            type="text"
            value={value}
            onChange={(e) => { setValue(e.target.value); setResult(null) }}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Recherche par SIRET (14 chiffres)…"
            className={[
              'w-full rounded-xl border bg-white py-2.5 pl-10 pr-4 text-[13px] text-gray-900',
              'placeholder:text-gray-300 outline-none transition-all duration-150',
              result === 'found' ? 'border-success/40' : result === 'not_found' ? 'border-warning/40' : 'border-gray-100',
              'focus:border-blue focus:shadow-[0_0_0_3px_rgba(17,48,167,0.06)]',
              'shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]',
            ].join(' ')}
          />
          {result && (
            <button
              onClick={clear}
              className="absolute inset-y-0 right-3 my-auto flex h-5 w-5 items-center justify-center rounded-full text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button
          onClick={handleSearch}
          size="sm"
          disabled={!value.trim()}
          className="rounded-xl px-4"
        >
          Rechercher
        </Button>
      </div>

      {result === 'found' && foundEntry && (
        <div className="flex items-center justify-between rounded-xl border border-success/20 bg-success-bg px-4 py-2.5 animate-[fadeIn_0.15s_ease-out]">
          <div className="flex items-center gap-2.5">
            <Building2 className="h-4 w-4 text-success shrink-0" />
            <div>
              <span className="text-[13px] font-semibold text-success">
                {foundEntry.nom_commercial}
              </span>
              {foundEntry.commercial && (
                <span className="text-[12px] text-success/70 ml-2">
                  {foundEntry.commercial}
                </span>
              )}
            </div>
          </div>
          <Button size="sm" variant="secondary" onClick={() => onFound(foundEntry)}>
            Voir la fiche
          </Button>
        </div>
      )}

      {result === 'not_found' && (
        <div className="flex items-center justify-between rounded-xl border border-warning/20 bg-warning-bg px-4 py-2.5 animate-[fadeIn_0.15s_ease-out]">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 text-warning shrink-0" />
            <span className="text-[13px] text-warning font-medium">
              SIRET introuvable dans le portefeuille
            </span>
          </div>
          <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => onNotFound(value.trim())}>
            Créer une fiche
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Pagination ───────────────────────────────────────────────────────────────
interface PaginationProps {
  page: number
  totalPages: number
  total: number
  onChange: (p: number) => void
}

function Pagination({ page, totalPages, total, onChange }: PaginationProps) {
  if (totalPages <= 1) return null

  const start = (page - 1) * PAGE_SIZE + 1
  const end = Math.min(page * PAGE_SIZE, total)

  const pages: (number | '…')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('…')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('…')
    pages.push(totalPages)
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
      <p className="text-[13px] text-gray-400">
        <span className="font-medium text-gray-700">{start}–{end}</span>
        {' '}sur{' '}
        <span className="font-semibold text-gray-900">{total.toLocaleString('fr-FR')}</span>
        {' '}entreprises
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-white hover:border hover:border-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span
              key={`ell-${i}`}
              className="flex h-8 w-8 items-center justify-center text-[12px] text-gray-300"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p as number)}
              className={[
                'flex h-8 w-8 items-center justify-center rounded-lg text-[13px] font-medium transition-all',
                p === page
                  ? 'bg-blue text-white shadow-[0_2px_8px_-2px_rgba(17,48,167,0.40)]'
                  : 'text-gray-500 hover:bg-white hover:border hover:border-gray-100 hover:text-gray-900',
              ].join(' ')}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-white hover:border hover:border-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function countActiveFilters(f: EntrepriseFilters): number {
  let n = 0
  if (f.status.length) n++
  if (f.commercial) n++
  if (f.secteur) n++
  if (f.relance_today) n++
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
  const companies = usePortefeuilleStore((s) => s.companies)
  const { update } = useUpdateCompany();
  const { createCompany } = useCreateCompany();
  const updateCompany = usePortefeuilleStore((s) => s.updateCompany)

  const { loading } = useInitializePortfolio()

  const [filters, setFilters] = useState<EntrepriseFilters>(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [detailEntry, setDetailEntry] = useState<Entreprise | null>(null)
  const [editEntry, setEditEntry] = useState<Entreprise | null>(null)
  const [abEntry, setAbEntry] = useState<Entreprise | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [prefillSiret, setPrefillSiret] = useState<string | undefined>()
  const [showSearch, setShowSearch] = useState(false)

  const allEntreprises = companies

  const secteurs = useMemo(() => {
    const raw = new Set(allEntreprises.map((e) => e.secteur).filter(Boolean) as string[])
    return Array.from(raw).sort((a, b) => a.localeCompare(b, 'fr'))
  }, [allEntreprises])

  const filtered = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return allEntreprises.filter((e) => {
      if (filters.status.length && !filters.status.includes(e.status)) return false
      if (filters.commercial && normalise(e.commercial ?? '') !== normalise(filters.commercial)) return false
      if (filters.secteur && normalise(e.secteur ?? '') !== normalise(filters.secteur)) return false
      if (filters.relance_today && e.date_relance) {
        try { if (!isSameDay(parseISO(e.date_relance), today)) return false }
        catch { return false }
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
  }, [allEntreprises, filters])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageEntries = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const handleFilterChange = (f: EntrepriseFilters) => { setFilters(f); setPage(1) }

  const formatErrorMessage = (errorMsg: string, siret?: string | null): string => {
    if (errorMsg.includes("Duplicate entry") && errorMsg.includes("companies.siret")) {
      const extractedSiret = siret || errorMsg.match(/'(\d+)'/)?.[1] || "";
      return `Cette entreprise (SIRET ${extractedSiret}) existe déjà dans le portefeuille. Vous pouvez la retrouver en utilisant la barre de "Recherche SIRET" en haut à droite de la page.`;
    }
    if (errorMsg.includes("siret must be 14 characters") || errorMsg.includes("SIRET must be 14 characters")) {
      return "Le SIRET doit faire exactement 14 chiffres.";
    }
    if (errorMsg.includes("Unauthorized") || errorMsg.includes("Forbidden")) {
      return "Session expirée ou droits insuffisants. Veuillez vous reconnecter.";
    }
    return errorMsg;
  }

  const handleSaveEdit = async (data: Partial<Entreprise>) => {
    if (!editEntry) return
    const company = toCompany(data);
    try {
      const response = await update(Number(data.id), company);
      if (response.error) {
        const friendlyMsg = formatErrorMessage(response.error.message, data.siret);
        alert(`Erreur lors de la modification : ${friendlyMsg}`);
        return;
      }
      setEditEntry(null)
      if (detailEntry?.id === editEntry.id) setDetailEntry({ ...detailEntry, ...data } as Entreprise)
    } catch (err: any) {
      console.error(err);
      alert(`Erreur lors de la modification : ${err.message || err}`);
    }
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

  if (loading) {
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
              <UserSwitcher />
              <div className="h-6 w-px bg-gray-200 hidden sm:block" />
              <button
                onClick={() => setShowSearch((v) => !v)}
                className={[
                  'flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[12px] font-medium transition-all duration-150',
                  'shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]',
                  showSearch
                    ? 'border-blue/30 bg-blue-light text-blue'
                    : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200',
                ].join(' ')}
              >
                <Search className="h-4 w-4" />
                <span className="hidden sm:block">Recherche SIRET</span>
              </button>
              <Button
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => openCreate()}
                className="rounded-xl shadow-[0_2px_8px_-2px_rgba(17,48,167,0.30)]"
              >
                Nouvelle fiche
              </Button>
            </div>
          </div>

          {/* SIRET search (collapsible) */}
          {showSearch && (
            <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)]">
              <SiretSearch
                onFound={(e) => { setDetailEntry(e); setShowSearch(false) }}
                onNotFound={(siret) => { openCreate(siret); setShowSearch(false) }}
              />
            </div>
          )}

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
        {pageEntries.length === 0 ? (
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
            {pageEntries.map((e) => (
              <EntrepriseCard
                key={e.id}
                entreprise={e}
                currentUser={currentUser!}
                onClick={() => setDetailEntry(e)}
                onClaim={() => handleClaim(e.id, Number(currentUser!.id), currentUser!.name)}
              />
            ))}
          </div>
        )}

        {/* ─── Pagination ──────────────────────────────────────────── */}
        {filtered.length > PAGE_SIZE && (
          <div className="mt-8 rounded-xl bg-white border border-gray-100 px-5 py-4 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)]">
            <Pagination
              page={safePage}
              totalPages={totalPages}
              total={filtered.length}
              onChange={(p) => {
                setPage(p)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            />
          </div>
        )}
      </div>

      {/* ─── Modals ──────────────────────────────────────────────── */}
      {detailEntry && !editEntry && (
        <DetailModal
          entreprise={detailEntry}
          currentUser={currentUser!}
          onClose={() => setDetailEntry(null)}
          onEdit={() => setEditEntry(detailEntry)}
          onCreateAB={() => { setAbEntry(detailEntry); setDetailEntry(null) }}
        />
      )}
      {abEntry && (
        <NeedsAnalysisModal
          entreprise={abEntry}
          currentUser={currentUser!}
          onClose={() => setAbEntry(null)}
          onSuccess={() => setAbEntry(null)}
        />
      )}
      {editEntry && (
        <CreateEditModal
          mode="edit"
          initial={editEntry}
          currentUser={currentUser!}
          onSave={handleSaveEdit}
          onClose={() => setEditEntry(null)}
        />
      )}
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

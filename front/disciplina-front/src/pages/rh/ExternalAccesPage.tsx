import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconAlert, IconArrowLeft, IconClose, IconFilter, IconLoader, IconSearch } from '@/components/ui/icons'
import { listExternalAccess, type ExternalAccessConnection, type ExternalAccessType } from '@/api/externalAccess'
import { fetchStaffDirectory, type DirectoryEntry } from '@/api/directory'
import { EXTERNAL_ACCESS_TABS } from '@/constants/externalAccess'
import ExternalAccessRow from '@/features/external/components/ExternalAccessRow'
import Button from '@/components/ui/Button'
import Tabs from '@/components/ui/Tabs'

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
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--ds-text-subtle)] hover:bg-[var(--ds-surface-sunken)] hover:text-[var(--ds-text-muted)] transition-colors"
            aria-label="Retour"
          >
            <IconArrowLeft width={18} height={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-[var(--ds-text)] leading-tight">Accès externes</h1>
            <p className="text-sm text-[var(--ds-text-subtle)] mt-0.5">Gestion des liens envoyés aux entreprises et candidats</p>
          </div>
        </div>
      </div>

      {/* ── Recherche + filtres ── */}
      <div className="rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4 shadow-sm flex flex-col gap-4">
        <div className="relative">
          <IconSearch width={16} height={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ds-text-subtle)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom (entreprise / candidat)…"
            className="w-full rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-sunken)] py-2 pl-9 pr-8 text-sm text-[var(--ds-text)] placeholder:text-[var(--ds-text-subtle)] focus:border-blue focus:outline-none focus:ring-2 focus:ring-blue/20"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--ds-text-subtle)] hover:text-[var(--ds-text-muted)]"
              aria-label="Effacer la recherche"
            >
              <IconClose width={15} height={15} />
            </button>
          )}
        </div>

        <Tabs
          label="Filtrer les accès externes par statut"
          tone="purple"
          value={activeTab}
          onChange={setActiveTab}
          options={EXTERNAL_ACCESS_TABS.map((t) => ({ value: t.key, label: t.label }))}
        />

        {/* Filtres fins */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 text-xs font-semibold text-[var(--ds-text-subtle)]">
            <IconFilter width={13} height={13} /> Filtres
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as '' | ExternalAccessType)}
            className="rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-sunken)] px-3 py-1.5 text-sm text-[var(--ds-text-muted)] focus:border-blue focus:outline-none"
          >
            <option value="">Type : tous</option>
            <option value="COMPANY">Entreprise</option>
            <option value="CANDIDATE">Candidat</option>
          </select>
          <select
            value={creatorFilter}
            onChange={(e) => setCreatorFilter(e.target.value === '' ? '' : Number(e.target.value))}
            className="rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-sunken)] px-3 py-1.5 text-sm text-[var(--ds-text-muted)] focus:border-blue focus:outline-none"
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
              className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-[var(--ds-text-subtle)] hover:text-[var(--ds-text)]"
            >
              <IconClose width={13} height={13} /> Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* ── Résultats ── */}
      {loading && !connection ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-[var(--ds-text-subtle)]">
          <IconLoader width={24} height={24} className="animate-spin" />
          <p className="text-sm">Chargement des accès externes…</p>
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-[var(--ds-danger)]">
          <IconAlert width={16} height={16} />
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] px-4 py-16 text-center text-sm text-[var(--ds-text-subtle)]">
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
        <div className="mt-2 flex items-center justify-between rounded-xl bg-[var(--ds-surface)] border border-[var(--ds-border)] px-5 py-4 shadow-sm">
          <Button variant="secondary" size="sm" onClick={loadPrev} disabled={cursorHistory.length === 0 || loading}>
            ← Page précédente
          </Button>
          <span className="text-sm text-[var(--ds-text-subtle)]">
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

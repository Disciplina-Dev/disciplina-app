import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconCompany, IconLoader, IconMail, IconPhone, IconPlus, IconSearch, IconTraining, IconUser } from '@/components/ui/icons'
import Button from '@/components/ui/Button'
import AlternantCreateModal from '@/components/peda/AlternantCreateModal'
import { fetchAlternants } from '@/api/alternants'
import type { Alternant } from '@/types/alternant'

export default function ListeAlternants() {
  const navigate = useNavigate()
  const [alternants, setAlternants] = useState<Alternant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    let alive = true
    fetchAlternants(debouncedSearch || undefined).then(
      (rows) => {
        if (!alive) return
        setAlternants(rows)
        setError(null)
        setLoading(false)
      },
      (e: unknown) => {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'Chargement impossible')
        setLoading(false)
      },
    )
    return () => {
      alive = false
    }
  }, [debouncedSearch])

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ds-text)]">Alternants</h1>
          <p className="mt-1 text-sm text-[var(--ds-text-subtle)]">
            {loading ? 'Chargement…' : `${alternants.length} alternant${alternants.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          leftIcon={<IconPlus width={16} height={16} />}
          onClick={() => setShowCreateModal(true)}
        >
          Nouvel alternant
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-xl">
          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[var(--ds-text-subtle)]">
            <IconSearch width={18} height={18} />
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setLoading(true)
            }}
            placeholder="Rechercher (nom, session, entreprise)…"
            aria-label="Rechercher un alternant"
            className="w-full rounded-[var(--radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface)] py-2.5 pl-11 pr-4 text-sm text-[var(--ds-text)] placeholder:text-[var(--ds-text-subtle)] outline-none transition-colors focus:border-[var(--ds-accent)]"
          />
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-[var(--ds-danger)]/30 bg-[var(--ds-danger-bg)] px-4 py-3 text-sm text-[var(--ds-danger)]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[var(--ds-text-subtle)]">
          <IconLoader width={28} height={28} className="animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {alternants.map((a) => (
            <div
              key={a.id}
              onClick={() => navigate(`/peda/alternants/${a.id}`)}
              className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-5 shadow-sm transition-all hover:border-teal-700/30 hover:shadow-md"
            >
              {/* Card Header: avatar */}
              <div className="mb-4 mt-2">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-700/10 text-lg font-bold text-teal-700 ring-2 ring-gray-50 transition-all group-hover:ring-teal-700/20">
                  {(a.firstName[0] ?? '?').toUpperCase()}{(a.lastName[0] ?? '').toUpperCase()}
                </div>
              </div>

              {/* Card Body */}
              <div className="mb-4 flex-1">
                <h3 className="mb-1 text-lg font-bold text-[var(--ds-text)] transition-colors group-hover:text-teal-700">
                  {a.fullName}
                </h3>
                <div className="mb-4 mt-1 flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-md bg-[#CCFBF1] px-2 py-0.5 text-xs font-bold text-[#0F766E] ring-1 ring-inset ring-[#0F766E]/20">
                    {a.session}
                  </span>
                  {!a.company && (
                    <span className="inline-flex items-center rounded-md bg-[var(--ds-surface-sunken)] px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-[var(--ds-text-subtle)] ring-1 ring-inset ring-[var(--ds-border)]">
                      Sans entreprise
                    </span>
                  )}
                </div>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-[var(--ds-text-muted)]">
                    <IconCompany width={16} height={16} className="shrink-0 text-[var(--ds-text-subtle)]" />
                    <span className="truncate">{a.company?.name || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[var(--ds-text-muted)]">
                    <IconMail width={16} height={16} className="shrink-0 text-[var(--ds-text-subtle)]" />
                    <span className="flex-1 truncate">{a.email || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[var(--ds-text-muted)]">
                    <IconPhone width={16} height={16} className="shrink-0 text-[var(--ds-text-subtle)]" />
                    <span className="truncate">{a.phone || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[var(--ds-text-muted)]">
                    <IconTraining width={16} height={16} className="shrink-0 text-[var(--ds-text-subtle)]" />
                    <span className="truncate">
                      {a.company?.startDate
                        ? `En entreprise depuis le ${new Date(a.company.startDate).toLocaleDateString('fr-FR')}`
                        : 'Pas de date d’entrée'}
                    </span>
                  </div>
                </div>
              </div>

              {a.createdAt && (
                <div className="mt-3 flex items-center gap-1 border-t border-[var(--ds-border)] pt-3 text-[11px] text-[var(--ds-text-subtle)]">
                  <IconUser width={12} height={12} className="shrink-0" />
                  Créé le {new Date(a.createdAt).toLocaleDateString('fr-FR')}
                </div>
              )}
            </div>
          ))}
          {alternants.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--ds-border)] bg-[var(--ds-surface)] py-12 text-[var(--ds-text-subtle)]">
              <IconUser width={48} height={48} className="mb-4 text-[var(--ds-text-subtle)]" />
              <p className="text-lg font-medium text-[var(--ds-text)]">Aucun alternant trouvé</p>
              <p className="text-sm">Créez le premier alternant avec le bouton « Nouvel alternant ».</p>
            </div>
          )}
        </div>
      )}

      {showCreateModal && (
        <AlternantCreateModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(newId) => {
            setShowCreateModal(false)
            setLoading(true)
            fetchAlternants(debouncedSearch || undefined).then(
              (rows) => {
                setAlternants(rows)
                setLoading(false)
              },
              () => setLoading(false),
            )
            navigate(`/peda/alternants/${newId}`)
          }}
        />
      )}
    </div>
  )
}

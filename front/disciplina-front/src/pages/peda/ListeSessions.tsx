import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconCalendar, IconLoader, IconPlus, IconSearch, IconTraining, IconUsers } from '@/components/ui/icons'
import Button from '@/components/ui/Button'
import SessionFormModal from '@/components/peda/SessionFormModal'
import { fetchSessions } from '@/api/sessions'
import type { Session } from '@/types/session'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR')
}

export default function ListeSessions() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  async function reload(q: string) {
    setLoading(true)
    try {
      setSessions(await fetchSessions(q || undefined))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let alive = true
    fetchSessions(debouncedSearch || undefined).then(
      (rows) => {
        if (!alive) return
        setSessions(rows)
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ds-text)]">Sessions</h1>
          <p className="mt-1 text-sm text-[var(--ds-text-subtle)]">
            {loading ? 'Chargement…' : `${sessions.length} session${sessions.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          leftIcon={<IconPlus width={16} height={16} />}
          onClick={() => setShowCreateModal(true)}
        >
          Nouvelle session
        </Button>
      </div>

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
            placeholder="Rechercher (nom, filière)…"
            aria-label="Rechercher une session"
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
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => navigate(`/peda/sessions/${s.id}`)}
              className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-5 shadow-sm transition-all hover:border-teal-700/30 hover:shadow-md"
            >
              <div className="mb-4 mt-2">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-700/10 text-teal-700 ring-2 ring-gray-50 transition-all group-hover:ring-teal-700/20">
                  <IconTraining width={26} height={26} />
                </div>
              </div>

              <div className="mb-4 flex-1">
                <h3 className="mb-1 text-lg font-bold text-[var(--ds-text)] transition-colors group-hover:text-teal-700">
                  {s.nom}
                </h3>
                <div className="mb-4 mt-1 flex flex-wrap gap-2">
                  {s.filiere && (
                    <span className="inline-flex items-center rounded-md bg-[#CCFBF1] px-2 py-0.5 text-xs font-bold text-[#0F766E] ring-1 ring-inset ring-[#0F766E]/20">
                      {s.filiere}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-md bg-[var(--ds-surface-sunken)] px-2 py-0.5 text-xs font-bold text-[var(--ds-text-muted)] ring-1 ring-inset ring-[var(--ds-border)]">
                    <IconUsers width={12} height={12} />
                    {s.alternantCount} alternant{s.alternantCount > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="mt-2 space-y-2">
                  {s.jourCours && (
                    <div className="flex items-center gap-2 text-sm text-[var(--ds-text-muted)]">
                      <IconCalendar width={16} height={16} className="shrink-0 text-[var(--ds-text-subtle)]" />
                      <span className="truncate">Cours : {s.jourCours}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-[var(--ds-text-muted)]">
                    <IconCalendar width={16} height={16} className="shrink-0 text-[var(--ds-text-subtle)]" />
                    <span className="truncate">
                      Du {formatDate(s.dateDebut)} au {formatDate(s.dateFin)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {sessions.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--ds-border)] bg-[var(--ds-surface)] py-12 text-[var(--ds-text-subtle)]">
              <IconTraining width={48} height={48} className="mb-4 text-[var(--ds-text-subtle)]" />
              <p className="text-lg font-medium text-[var(--ds-text)]">Aucune session trouvée</p>
              <p className="text-sm">Créez la première session avec le bouton « Nouvelle session ».</p>
            </div>
          )}
        </div>
      )}

      {showCreateModal && (
        <SessionFormModal
          onClose={() => setShowCreateModal(false)}
          onSaved={(created) => {
            setShowCreateModal(false)
            reload(debouncedSearch)
            navigate(`/peda/sessions/${created.id}`)
          }}
        />
      )}
    </div>
  )
}

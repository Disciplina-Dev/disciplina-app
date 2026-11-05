import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IconLoader,
  IconPlus,
  IconSearch,
  IconUser,
} from '@/components/ui/icons'
import { fetchFormateurs } from '@/api/formateurs'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import FormateurModal from '@/components/peda/FormateurModal'
import { formatMinutes } from '@/utils/emargement'
import type { Formateur } from '@/types/formateur'

export default function ListeFormateurs() {
  const navigate = useNavigate()
  const [formateurs, setFormateurs] = useState<Formateur[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let alive = true
    fetchFormateurs().then(
      (rows) => {
        if (!alive) return
        setFormateurs(rows)
        setError(null)
        setLoading(false)
      },
      (err: unknown) => {
        if (!alive) return
        setError(err instanceof Error ? err.message : 'Chargement impossible')
        setLoading(false)
      },
    )
    return () => {
      alive = false
    }
  }, [reloadKey])

  const normalized = search.trim().toLowerCase()
  const matches = normalized
    ? formateurs.filter(
        (formateur) =>
          formateur.name.toLowerCase().includes(normalized) ||
          formateur.email.toLowerCase().includes(normalized) ||
          (formateur.phone ?? '').toLowerCase().includes(normalized),
      )
    : formateurs

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
      <PageHeader
        eyebrow="Espace pédagogique"
        title="Formateurs"
        description="Annuaire des intervenants : coordonnées, volume de séances et heures de cours animées."
        actions={
          <Button
            variant="primary"
            leftIcon={<IconPlus width={16} height={16} />}
            onClick={() => setShowForm(true)}
          >
            Nouveau formateur
          </Button>
        }
      />

      <div className="mb-6">
        <div className="relative max-w-xl">
          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[var(--ds-text-subtle)]">
            <IconSearch width={18} height={18} />
          </span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher (nom, e-mail, téléphone)…"
            aria-label="Rechercher un formateur"
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
      ) : matches.length === 0 ? (
        <EmptyState
          icon={<IconUser width={24} height={24} />}
          title={formateurs.length === 0 ? 'Aucun formateur' : 'Aucun résultat'}
          description={
            formateurs.length === 0
              ? 'Créez une fiche formateur : elle sera proposée à la création des séances et suivie dans les statistiques.'
              : 'Aucune fiche ne correspond à cette recherche.'
          }
          action={
            formateurs.length === 0 ? (
              <Button
                variant="primary"
                leftIcon={<IconPlus width={16} height={16} />}
                onClick={() => setShowForm(true)}
              >
                Nouveau formateur
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {matches.map((formateur) => (
            <button
              key={formateur.id}
              type="button"
              onClick={() => navigate(`/peda/formateurs/${formateur.id}`)}
              className="group flex h-full flex-col rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-5 text-left shadow-sm transition-all hover:border-[var(--ds-accent)]/30 hover:shadow-md"
            >
              <div className="mb-3 flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--ds-accent-soft)] text-[var(--ds-accent)]">
                  <IconUser width={22} height={22} />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-[15px] font-bold text-[var(--ds-text)] group-hover:text-[var(--ds-accent)]">
                    {formateur.name}
                  </h2>
                  <p className="truncate text-[12px] text-[var(--ds-text-muted)]">{formateur.email}</p>
                  {formateur.phone && (
                    <p className="truncate text-[12px] text-[var(--ds-text-subtle)]">{formateur.phone}</p>
                  )}
                </div>
              </div>

              <div className="mt-1 grid flex-1 grid-cols-3 gap-2 border-t border-[var(--ds-border)] pt-3 text-center">
                <div>
                  <p className="text-[15px] font-bold text-[var(--ds-text)]">
                    {formateur.stats.seanceCount}
                  </p>
                  <p className="text-[11px] uppercase tracking-wide text-[var(--ds-text-subtle)]">Séances</p>
                </div>
                <div>
                  <p className="text-[15px] font-bold text-[var(--ds-text)]">
                    {formatMinutes(formateur.stats.plannedMinutes)}
                  </p>
                  <p className="text-[11px] uppercase tracking-wide text-[var(--ds-text-subtle)]">Heures</p>
                </div>
                <div>
                  <p className="text-[15px] font-bold text-[var(--ds-text)]">
                    {formateur.stats.sessionCount}
                  </p>
                  <p className="text-[11px] uppercase tracking-wide text-[var(--ds-text-subtle)]">Sessions</p>
                </div>
              </div>

              {formateur.comment && (
                <p className="mt-3 line-clamp-2 text-[12px] text-[var(--ds-text-subtle)]">
                  {formateur.comment}
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {showForm && (
        <FormateurModal
          onClose={() => setShowForm(false)}
          onSaved={(saved) => {
            setReloadKey((key) => key + 1)
            navigate(`/peda/formateurs/${saved.id}`)
          }}
        />
      )}
    </div>
  )
}

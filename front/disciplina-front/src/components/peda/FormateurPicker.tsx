import { useEffect, useState } from 'react'
import { IconLoader, IconSearch, IconUser, IconUserPlus } from '@/components/ui/icons'
import { fetchFormateurs } from '@/api/formateurs'
import type { Formateur } from '@/types/formateur'

type FormateurPickerProps = {
  /** Fiche déjà sélectionnée pour la séance (`null` = saisie libre ou liée par e-mail). */
  selectedId: string | null
  /** Nom/e-mail saisis dans les champs, pour pré-remplir la recherche. */
  currentName: string
  onSelect: (formateur: Formateur) => void
  onClear: () => void
}

/**
 * Recherche dans l'annuaire des formateurs. La sélection recopie nom, e-mail et
 * id dans le formulaire de séance ; toute modification manuelle des champs
 * efface l'id, et l'enregistrement créera la fiche si l'adresse est inconnue.
 */
export default function FormateurPicker({
  selectedId,
  currentName,
  onSelect,
  onClear,
}: FormateurPickerProps) {
  const [formateurs, setFormateurs] = useState<Formateur[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let alive = true
    fetchFormateurs().then(
      (rows) => {
        if (!alive) return
        setFormateurs(rows)
        setLoading(false)
      },
      (err: unknown) => {
        if (!alive) return
        setError(err instanceof Error ? err.message : 'Chargement des formateurs impossible')
        setLoading(false)
      },
    )
    return () => {
      alive = false
    }
  }, [])

  const normalized = query.trim().toLowerCase()
  const matches = (
    normalized
      ? formateurs.filter(
          (formateur) =>
            formateur.name.toLowerCase().includes(normalized) ||
            formateur.email.toLowerCase().includes(normalized),
        )
      : formateurs
  ).slice(0, 8)

  if (selectedId) {
    const selected = formateurs.find((formateur) => formateur.id === selectedId)
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--ds-accent)]/30 bg-[var(--ds-accent-soft)] px-3.5 py-2.5 text-sm">
        <span className="flex min-w-0 items-center gap-2 text-[var(--ds-text)]">
          <IconUser width={16} height={16} className="shrink-0 text-[var(--ds-accent)]" />
          <span className="truncate font-semibold">{selected?.name ?? currentName}</span>
          {selected && <span className="truncate text-[var(--ds-text-muted)]">{selected.email}</span>}
        </span>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 text-[13px] font-semibold text-[var(--ds-accent)] hover:underline"
        >
          Délier
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[var(--ds-text-subtle)]">
        {loading ? (
          <IconLoader width={16} height={16} className="animate-spin" />
        ) : (
          <IconSearch width={16} height={16} />
        )}
      </span>
      <input
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        placeholder="Rechercher un formateur existant (nom, e-mail)…"
        aria-label="Rechercher un formateur existant"
        className="w-full rounded-[var(--radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface)] py-2.5 pl-10 pr-4 text-sm text-[var(--ds-text)] placeholder:text-[var(--ds-text-subtle)] outline-none transition-colors focus:border-[var(--ds-accent)]"
      />

      {open && !loading && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-[var(--radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-1 shadow-lg">
          {matches.map((formateur) => (
            <button
              key={formateur.id}
              type="button"
              // `mousedown` précède le blur de l'input : sans ça la liste se ferme avant le clic.
              onMouseDown={(event) => {
                event.preventDefault()
                onSelect(formateur)
                setQuery('')
                setOpen(false)
              }}
              className="flex w-full flex-col items-start rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--ds-surface-sunken)]"
            >
              <span className="font-semibold text-[var(--ds-text)]">{formateur.name}</span>
              <span className="text-[12px] text-[var(--ds-text-muted)]">{formateur.email}</span>
            </button>
          ))}
          {matches.length === 0 && (
            <p className="flex items-start gap-2 px-3 py-2 text-[12px] text-[var(--ds-text-muted)]">
              <IconUserPlus width={14} height={14} className="mt-0.5 shrink-0" />
              {normalized
                ? 'Aucun formateur trouvé : la fiche sera créée automatiquement à l’enregistrement.'
                : 'Aucun formateur dans l’annuaire pour le moment.'}
            </p>
          )}
        </div>
      )}

      {error && <p className="mt-1 text-xs text-[var(--ds-danger)]">{error}</p>}
    </div>
  )
}

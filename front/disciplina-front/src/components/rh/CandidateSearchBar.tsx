import { useEffect, useRef, useState } from 'react'
import { IconCheck, IconClose, IconLoader, IconSearch } from '@/components/ui/icons'
import SegmentedControl from '@/components/ui/SegmentedControl'
import type { CandidateSearchField } from '@/graphql/hooks'

const FIELD_LABELS: Record<CandidateSearchField, string> = {
  NAME: 'Nom',
  PHONE: 'Tél.',
  EMAIL: 'Mail',
}

const FIELD_PLACEHOLDERS: Record<CandidateSearchField, string> = {
  NAME: 'Rechercher un candidat…',
  PHONE: 'Rechercher par téléphone…',
  EMAIL: 'Rechercher par mail…',
}

const FIELDS: CandidateSearchField[] = ['NAME', 'PHONE', 'EMAIL']

// Durée minimale d'affichage du chargement : une réponse instantanée paraît
// « rien ne s'est passé », un court temps visible rend le résultat perçu comme
// le fruit de la recherche.
const MIN_BUSY_MS = 450
const DONE_FLASH_MS = 1600

type Props = {
  value: string
  onChange: (value: string) => void
  field: CandidateSearchField
  onFieldChange: (field: CandidateSearchField) => void
  /** Vrai tant que la saisie n'est pas encore appliquée ou que la requête tourne. */
  searching: boolean
  resultCount: number
}

export default function CandidateSearchBar({ value, onChange, field, onFieldChange, searching, resultCount }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const startedAtRef = useRef(0)
  const [held, setHeld] = useState(false)
  const [done, setDone] = useState(false)

  // Ajustement pendant le rendu (pas dans un effet) : le spinner apparaît dès
  // le premier rendu où la recherche démarre.
  if (searching && !held) {
    setHeld(true)
    setDone(false)
  }

  useEffect(() => {
    if (searching) startedAtRef.current = Date.now()
  }, [searching])

  useEffect(() => {
    if (searching || !held) return
    const remaining = Math.max(0, MIN_BUSY_MS - (Date.now() - startedAtRef.current))
    let flash: ReturnType<typeof setTimeout> | undefined
    const settle = setTimeout(() => {
      setHeld(false)
      setDone(true)
      flash = setTimeout(() => setDone(false), DONE_FLASH_MS)
    }, remaining)
    return () => {
      clearTimeout(settle)
      clearTimeout(flash)
    }
  }, [searching, held])

  const busy = searching || held
  const showDone = done && !busy && value.trim() !== ''

  const clear = () => {
    onChange('')
    inputRef.current?.focus()
  }

  return (
    <div className="w-full sm:w-[26rem]">
      <div
        className={[
          'group relative flex h-[42px] items-center overflow-hidden rounded-xl border bg-[var(--ds-surface)] shadow-sm',
          'border-[var(--ds-border)] transition-[border-color,box-shadow] duration-200',
          'focus-within:border-purple focus-within:ring-2 focus-within:ring-purple/20',
        ].join(' ')}
      >
        <span className="pointer-events-none flex h-full w-11 shrink-0 items-center justify-center text-[var(--ds-text-subtle)] transition-colors group-focus-within:text-purple">
          {busy ? (
            <IconLoader width={17} height={17} className="animate-spin text-purple" />
          ) : (
            <IconSearch width={17} height={17} />
          )}
        </span>

        <input
          ref={inputRef}
          type="text"
          aria-label="Rechercher un candidat"
          placeholder={FIELD_PLACEHOLDERS[field]}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && value) {
              e.preventDefault()
              onChange('')
            }
          }}
          className="h-full min-w-0 flex-1 bg-transparent pr-2 text-sm text-[var(--ds-text)] placeholder:text-[var(--ds-text-subtle)] focus:outline-none"
        />

        {value && (
          <button
            type="button"
            onClick={clear}
            aria-label="Effacer la recherche"
            className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--ds-text-subtle)] transition-colors hover:bg-[var(--ds-surface-sunken)] hover:text-[var(--ds-text)] animate-[ds-fade-in_0.15s_ease-out]"
          >
            <IconClose width={14} height={14} />
          </button>
        )}

        <SegmentedControl
          label="Champ de recherche"
          tone="purple"
          size="sm"
          className="mr-1.5 shrink-0"
          value={field}
          onChange={onFieldChange}
          options={FIELDS.map((f) => ({ value: f, label: FIELD_LABELS[f] }))}
        />

        {/* Barre de progression indéterminée, aux couleurs de la charte. */}
        <span
          aria-hidden="true"
          className={[
            'pointer-events-none absolute inset-x-0 bottom-0 h-[2px] overflow-hidden transition-opacity duration-300',
            busy ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
        >
          <span className="absolute inset-y-0 w-1/3 rounded-full bg-[linear-gradient(90deg,transparent,var(--color-blue),var(--color-purple),transparent)] animate-[ds-search-progress_1.1s_ease-in-out_infinite]" />
        </span>
      </div>

      {/* Retour de fin de recherche, annoncé aux lecteurs d'écran. */}
      <div aria-live="polite" className="relative h-0">
        {showDone && (
          <p className="absolute left-3 top-1 flex items-center gap-1.5 text-[12px] font-medium text-[var(--ds-text-subtle)] animate-[ds-menu-in_0.2s_ease-out]">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-purple-light text-purple">
              <IconCheck width={10} height={10} />
            </span>
            {resultCount === 0 ? 'Aucun résultat' : `${resultCount} résultat${resultCount > 1 ? 's' : ''}`}
          </p>
        )}
      </div>
    </div>
  )
}

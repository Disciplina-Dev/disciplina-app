import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { IconCheck, IconChevronDown } from '@/components/ui/icons'

export type SelectOption<T extends string | number> = {
  value: T
  label: string
  disabled?: boolean
}

type SelectProps<T extends string | number> = {
  options: ReadonlyArray<SelectOption<T>>
  value: T
  onChange: (value: T) => void
  /** Intitulé visible au-dessus du champ. */
  label?: string
  /** Nom du champ pour les lecteurs d'écran quand aucun `label` n'est affiché. */
  ariaLabel?: string
  placeholder?: string
  disabled?: boolean
  error?: string
  size?: 'sm' | 'md'
  className?: string
  /** Largeur du menu : `trigger` s'aligne sur le champ, `auto` s'adapte au texte. */
  menuWidth?: 'trigger' | 'auto'
}

const sizeClasses = {
  sm: 'h-9 px-3 text-[13px]',
  md: 'h-11 px-3.5 text-sm',
} as const

/**
 * Liste déroulante de l'application.
 *
 * Remplace `<select>` natif, dont l'apparence n'est pas stylable et diffère
 * d'un système à l'autre. Le comportement clavier du natif est reproduit :
 * flèches pour parcourir, Entrée/Espace pour valider, Échap pour fermer,
 * Origine/Fin pour les extrémités, et saisie d'une lettre pour sauter à
 * l'option correspondante.
 */
export default function Select<T extends string | number>({
  options,
  value,
  onChange,
  label,
  ariaLabel,
  placeholder = 'Sélectionner…',
  disabled = false,
  error,
  size = 'md',
  className = '',
  menuWidth = 'trigger',
}: SelectProps<T>) {
  const id = useId()
  const listboxId = `${id}-listbox`
  const errorId = `${id}-error`

  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const optionRefs = useRef(new Map<T, HTMLDivElement>())
  const typeahead = useRef<{ query: string; timer: number | null }>({ query: '', timer: null })

  const [open, setOpen] = useState(false)
  // Option survolée au clavier : distincte de la valeur retenue tant que
  // l'utilisateur n'a pas validé.
  const [activeValue, setActiveValue] = useState<T>(value)

  const selected = useMemo(() => options.find((o) => o.value === value), [options, value])
  const enabled = useMemo(() => options.filter((o) => !o.disabled), [options])

  // L'option active reste dans le champ de vision pendant la navigation.
  useEffect(() => {
    if (!open) return
    optionRefs.current.get(activeValue)?.scrollIntoView({ block: 'nearest' })
  }, [open, activeValue])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  /** À l'ouverture, la navigation clavier repart de la valeur retenue. */
  const openMenu = () => {
    setActiveValue(value)
    setOpen(true)
  }

  const commit = (next: T) => {
    onChange(next)
    setOpen(false)
    triggerRef.current?.focus()
  }

  const moveActive = (direction: 1 | -1) => {
    if (enabled.length === 0) return
    const index = enabled.findIndex((o) => o.value === activeValue)
    const nextIndex = index === -1 ? 0 : (index + direction + enabled.length) % enabled.length
    setActiveValue(enabled[nextIndex].value)
  }

  /** Saisie au clavier : « ma » amène sur « Martin » comme dans un select natif. */
  const handleTypeahead = (char: string) => {
    if (typeahead.current.timer) window.clearTimeout(typeahead.current.timer)
    typeahead.current.query += char.toLowerCase()
    const query = typeahead.current.query
    const match = enabled.find((o) => o.label.toLowerCase().startsWith(query))
    if (match) {
      setActiveValue(match.value)
      if (!open) onChange(match.value)
    }
    typeahead.current.timer = window.setTimeout(() => {
      typeahead.current.query = ''
    }, 600)
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        if (!open) openMenu()
        else moveActive(1)
        break
      case 'ArrowUp':
        event.preventDefault()
        if (!open) openMenu()
        else moveActive(-1)
        break
      case 'Home':
        if (open && enabled.length) {
          event.preventDefault()
          setActiveValue(enabled[0].value)
        }
        break
      case 'End':
        if (open && enabled.length) {
          event.preventDefault()
          setActiveValue(enabled[enabled.length - 1].value)
        }
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        if (open) commit(activeValue)
        else openMenu()
        break
      case 'Escape':
        if (open) {
          event.preventDefault()
          setOpen(false)
        }
        break
      case 'Tab':
        setOpen(false)
        break
      default:
        if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
          handleTypeahead(event.key)
        }
    }
  }

  return (
    <div ref={rootRef} className={`relative flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={id} className="text-[13px] font-semibold text-[var(--ds-text-muted)]">
          {label}
        </label>
      )}

      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={label ? undefined : ariaLabel}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleKeyDown}
        className={[
          'flex w-full items-center justify-between gap-2 rounded-[var(--radius-md)] border text-left',
          'bg-[var(--ds-surface)] transition-[border-color,box-shadow] duration-150',
          'focus-visible:outline-none focus-visible:ring-2',
          error
            ? 'border-[var(--ds-danger)] focus-visible:ring-[var(--ds-danger)]/20'
            : 'border-[var(--ds-border)] focus-visible:border-[var(--ds-accent)] focus-visible:ring-[var(--ds-accent)]/15',
          'disabled:cursor-not-allowed disabled:bg-[var(--ds-surface-sunken)] disabled:opacity-70',
          sizeClasses[size],
        ].join(' ')}
      >
        <span className={`truncate ${selected ? 'text-[var(--ds-text)]' : 'text-[var(--ds-text-subtle)]'}`}>
          {selected?.label ?? placeholder}
        </span>
        <IconChevronDown
          width={16}
          height={16}
          aria-hidden="true"
          className={[
            'shrink-0 text-[var(--ds-text-subtle)]',
            'motion-safe:transition-transform motion-safe:duration-200',
            open ? 'rotate-180' : '',
          ].join(' ')}
        />
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={label ?? ariaLabel}
          aria-activedescendant={`${id}-opt-${String(activeValue)}`}
          tabIndex={-1}
          className={[
            'ds-glass-strong ds-scroll absolute top-full z-50 mt-1 max-h-64 overflow-y-auto',
            'rounded-[var(--radius-lg)] p-1.5',
            'motion-safe:animate-[ds-menu-in_140ms_ease-out]',
            menuWidth === 'trigger' ? 'w-full' : 'min-w-full w-max',
          ].join(' ')}
          style={{ top: label ? undefined : '100%' }}
        >
          {options.length === 0 && (
            <p className="px-3 py-2 text-[13px] text-[var(--ds-text-subtle)]">Aucune option</p>
          )}
          {options.map((option) => {
            const isSelected = option.value === value
            const isActive = option.value === activeValue
            return (
              <div
                key={String(option.value)}
                id={`${id}-opt-${String(option.value)}`}
                ref={(node) => {
                  if (node) optionRefs.current.set(option.value, node)
                  else optionRefs.current.delete(option.value)
                }}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled}
                onMouseEnter={() => !option.disabled && setActiveValue(option.value)}
                onClick={() => !option.disabled && commit(option.value)}
                className={[
                  'flex cursor-pointer items-center justify-between gap-2 rounded-full px-3 py-2 text-[13px]',
                  option.disabled ? 'cursor-not-allowed opacity-50' : '',
                  isActive && !option.disabled ? 'bg-[var(--ds-surface-sunken)]' : '',
                  isSelected ? 'font-semibold text-[var(--ds-text)]' : 'text-[var(--ds-text-muted)]',
                ].join(' ')}
              >
                <span className="truncate">{option.label}</span>
                {isSelected && (
                  <IconCheck width={15} height={15} aria-hidden="true" className="shrink-0 text-[var(--ds-accent)]" />
                )}
              </div>
            )
          })}
        </div>
      )}

      {error && (
        <p id={errorId} className="text-xs font-medium text-[var(--ds-danger)]">
          {error}
        </p>
      )}
    </div>
  )
}

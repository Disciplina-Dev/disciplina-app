import { useEffect, useRef, useState } from 'react'
import { IconCheck, IconChevronDown, IconClose } from '@/components/ui/icons'

type MultiSelectSection = {
  key: string
  label: string
  options: string[]
}

type MultiSelectFieldProps = {
  label: string
  id: string
  options: string[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  getOptionLabel?: (option: string) => string
  variant?: 'form' | 'filter'
  sections?: MultiSelectSection[]
}

export default function MultiSelectField({
  label,
  id,
  options,
  value,
  onChange,
  placeholder = 'Sélectionner…',
  getOptionLabel = (option) => option,
  variant = 'form',
  sections,
}: MultiSelectFieldProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const toggle = (opt: string) =>
    onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt])

  const toggleSection = (sectionOptions: string[]) => {
    const allInSectionSelected = sectionOptions.every(o => value.includes(o))
    onChange(
      allInSectionSelected
        ? value.filter(v => !sectionOptions.includes(v))
        : [...new Set([...value, ...sectionOptions])],
    )
  }

  const isFilter = variant === 'filter'
  const hasSections = !!sections?.length

  // When grouped (like Matching commune filter): show fully-selected section
  // labels instead of a raw count.
  const buttonText = (() => {
    if (!value.length) return placeholder
    if (hasSections) {
      const activeSections = sections!.filter(s => s.options.every(o => value.includes(o)))
      if (activeSections.length > 0) {
        const selectedSet = new Set(value)
        const covered = new Set(activeSections.flatMap(s => s.options))
        const extraCount = [...selectedSet].filter(v => !covered.has(v)).length
        const base = activeSections.map(s => s.label).join(', ')
        return extraCount > 0 ? `${base} (+${extraCount})` : base
      }
    }
    return `${value.length} sélectionnée${value.length > 1 ? 's' : ''}`
  })()

  const allOptions = hasSections ? [...new Set(sections!.flatMap(s => s.options))] : options
  const allSelected = allOptions.length > 0 && allOptions.every(o => value.includes(o))

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      <label
        htmlFor={id}
        className={
          isFilter
            ? 'text-[11px] font-bold uppercase tracking-wider text-[var(--ds-text-subtle)]'
            : 'text-sm font-medium text-[var(--ds-text-muted)]'
        }
      >
        {label}
      </label>
      <div className="relative">
        <button
          id={id}
          type="button"
          onClick={() => setOpen(o => !o)}
          className={[
            'flex w-full items-center justify-between gap-2 text-left text-sm outline-none transition-colors',
            isFilter
              ? 'rounded-lg border bg-[var(--ds-surface-sunken)] px-3 py-2 focus:border-purple focus:ring-purple/20'
              : 'rounded-[10px] border bg-[var(--ds-surface)] py-2.5 pl-4 pr-3',
            open ? 'border-purple' : 'border-[var(--ds-border)]',
          ].join(' ')}
        >
          <span className={value.length ? 'text-[var(--ds-text)]' : 'text-[var(--ds-text-subtle)]'}>
            {buttonText}
          </span>
          <IconChevronDown className={`h-4 w-4 shrink-0 text-[var(--ds-text-subtle)] transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface)] py-1 shadow-lg">
            {hasSections ? (
              <>
                <button
                  type="button"
                  onClick={() => onChange(allSelected ? [] : allOptions)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm italic text-[var(--ds-text-subtle)] hover:bg-[var(--ds-surface-sunken)]"
                >
                  <span>{allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}</span>
                </button>
                <div className="my-1 border-t border-[var(--ds-border)]" />
                {sections!.map(section => {
                  const sectionSelected = section.options.every(o => value.includes(o))
                  const sectionPartial = section.options.some(o => value.includes(o)) && !sectionSelected
                  return (
                    <div key={section.key}>
                      <button
                        type="button"
                        onClick={() => toggleSection(section.options)}
                        className="flex w-full items-center gap-2 border-b border-[var(--ds-border)] px-3 py-2 text-left text-sm font-semibold text-[var(--ds-text)] hover:bg-[var(--ds-surface-sunken)]"
                      >
                        <span className="flex-1">{section.label}</span>
                        <span className="text-[11px] font-normal text-[var(--ds-text-subtle)]">{section.options.length} communes</span>
                        {sectionSelected && (
                          <IconCheck className={`h-4 w-4 shrink-0 ${isFilter ? 'text-purple' : 'text-blue'}`} />
                        )}
                        {sectionPartial && (
                          <div className={`h-3.5 w-3.5 shrink-0 rounded-sm border-2 ${isFilter ? 'border-purple' : 'border-blue'}`} />
                        )}
                      </button>
                      <div className="ml-4">
                        {section.options.map(opt => {
                          const selected = value.includes(opt)
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => toggle(opt)}
                              className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm text-[var(--ds-text)] hover:bg-[var(--ds-surface-sunken)]"
                            >
                              <span>{getOptionLabel(opt)}</span>
                              {selected && (
                                <IconCheck className={`h-4 w-4 shrink-0 ${isFilter ? 'text-purple' : 'text-blue'}`} />
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </>
            ) : (
              options.map(opt => {
              const selected = value.includes(opt)
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggle(opt)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-[var(--ds-text)] hover:bg-[var(--ds-surface-sunken)]"
                >
                  <span>{getOptionLabel(opt)}</span>
                  {selected && (
                    <IconCheck className={`h-4 w-4 shrink-0 ${isFilter ? 'text-purple' : 'text-blue'}`} />
                  )}
                </button>
              )
            })
            )}
          </div>
        )}
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map(v => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-full bg-purple/10 px-2.5 py-0.5 text-xs font-medium text-purple"
            >
              {getOptionLabel(v)}
              <button type="button" onClick={() => toggle(v)} className="hover:text-[var(--ds-danger)]">
                <IconClose className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

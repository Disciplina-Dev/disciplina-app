import { useEffect, useRef, useState } from 'react'
import { IconCheck, IconChevronDown, IconClose } from '@/components/ui/icons'
import { TitleProfessionalType } from '@/types/candidate'
import { TP_TYPE_LABELS } from '@/data/candidateTemplates'

interface TpFilterDropdownProps {
  value: string[]
  onChange: (value: string[]) => void
}

const TP_OPTIONS = Object.values(TitleProfessionalType)

export default function TpFilterDropdown({ value, onChange }: TpFilterDropdownProps) {
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--ds-border)] px-3 py-2 text-left text-sm outline-none transition-colors hover:bg-[var(--ds-surface-sunken)]"
      >
        <span className="truncate">
          {value.length === 0 ? (
            <span className="text-[var(--ds-text-subtle)]">Tous les types de TP</span>
          ) : (
            <span className="font-medium text-[var(--ds-text)]">
              {value.map(v => TP_TYPE_LABELS[v as TitleProfessionalType] ?? v).join(' · ')}
            </span>
          )}
        </span>
        <IconChevronDown className={`h-4 w-4 shrink-0 text-[var(--ds-text-subtle)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface)] py-1 shadow-lg">
          {value.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-blue hover:bg-[var(--ds-surface-sunken)]"
            >
              <span>Tous les types</span>
              <span className="text-xs text-[var(--ds-text-subtle)]">Effacer</span>
            </button>
          )}
          {TP_OPTIONS.map(opt => {
            const selected = value.includes(opt)
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-[var(--ds-text)] hover:bg-[var(--ds-surface-sunken)]"
              >
                <span>{TP_TYPE_LABELS[opt]}</span>
                {selected && <IconCheck className="h-4 w-4 shrink-0 text-blue" />}
              </button>
            )
          })}
        </div>
      )}

      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map(v => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-full bg-blue-light/60 px-2.5 py-0.5 text-xs font-medium text-blue"
            >
              {TP_TYPE_LABELS[v as TitleProfessionalType] ?? v}
              <button type="button" onClick={() => toggle(v)} className="hover:text-blue-dark">
                <IconClose className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
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
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 text-left text-sm outline-none transition-colors hover:bg-gray-50"
      >
        <span className="truncate">
          {value.length === 0 ? (
            <span className="text-gray-400">Tous les types de TP</span>
          ) : (
            <span className="font-medium text-gray-900">
              {value.map(v => TP_TYPE_LABELS[v as TitleProfessionalType] ?? v).join(' · ')}
            </span>
          )}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {value.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-blue hover:bg-gray-50"
            >
              <span>Tous les types</span>
              <span className="text-xs text-gray-400">Effacer</span>
            </button>
          )}
          {TP_OPTIONS.map(opt => {
            const selected = value.includes(opt)
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50"
              >
                <span>{TP_TYPE_LABELS[opt]}</span>
                {selected && <Check className="h-4 w-4 shrink-0 text-blue" />}
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
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
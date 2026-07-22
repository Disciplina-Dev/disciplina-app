import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'

type MultiSelectFieldProps = {
  label: string
  id: string
  options: string[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  getOptionLabel?: (option: string) => string
  variant?: 'form' | 'filter'
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

  const isFilter = variant === 'filter'

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      <label
        htmlFor={id}
        className={
          isFilter
            ? 'text-[11px] font-bold uppercase tracking-wider text-gray-500'
            : 'text-sm font-medium text-gray-700'
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
              ? 'rounded-lg border bg-gray-50 px-3 py-2 focus:border-purple focus:ring-purple/20'
              : 'rounded-[10px] border bg-white py-2.5 pl-4 pr-3',
            open ? 'border-purple' : 'border-gray-200',
          ].join(' ')}
        >
          <span className={value.length ? 'text-gray-900' : 'text-gray-400'}>
            {value.length ? `${value.length} sélectionnée${value.length > 1 ? 's' : ''}` : placeholder}
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            {options.map(opt => {
              const selected = value.includes(opt)
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggle(opt)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50"
                >
                  <span>{getOptionLabel(opt)}</span>
                  {selected && (
                    <Check className={`h-4 w-4 shrink-0 ${isFilter ? 'text-purple' : 'text-blue'}`} />
                  )}
                </button>
              )
            })}
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
              <button type="button" onClick={() => toggle(v)} className="hover:text-danger">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

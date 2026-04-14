import {
  Tag,
  User,
  MapPin,
  Bell,
  CalendarDays,
  UserX,
  ChevronDown,
  X,
  Check,
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import type { EntrepriseFilters, EntrepriseStatus } from '@/types/entreprise'
import { USERS } from '@/store/authStore'

const STATUS_OPTIONS: EntrepriseStatus[] = ['Oui', 'Non', 'À Réfléchir']

const STATUS_DOT: Record<EntrepriseStatus, string> = {
  Oui: 'bg-success',
  Non: 'bg-danger',
  'À Réfléchir': 'bg-warning',
}

interface Props {
  filters: EntrepriseFilters
  secteurs: string[]
  onChange: (filters: EntrepriseFilters) => void
  onReset: () => void
  activeCount: number
}

export const EMPTY_FILTERS: EntrepriseFilters = {
  siret: '',
  status: [],
  commercial: '',
  secteur: '',
  relance_today: false,
  unassigned_only: false,
  date_insertion_from: '',
  date_insertion_to: '',
}

// ─── Generic dropdown chip ────────────────────────────────────────────────────
interface ChipDropdownProps {
  icon: React.ReactNode
  label: string
  activeLabel?: string
  isActive: boolean
  children: React.ReactNode
  onClear?: () => void
}

function ChipDropdown({ icon, label, activeLabel, isActive, children, onClear }: ChipDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={[
          'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium',
          'border transition-all duration-150 whitespace-nowrap',
          isActive
            ? 'border-blue bg-blue text-white'
            : 'border-gray-100 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900',
        ].join(' ')}
      >
        <span className={isActive ? 'text-white' : 'text-gray-400'}>{icon}</span>
        {isActive && activeLabel ? activeLabel : label}
        {isActive && onClear ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onClear() }}
            onKeyDown={(e) => e.key === 'Enter' && (e.stopPropagation(), onClear?.())}
            className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/20 hover:bg-white/40 transition-colors"
          >
            <X className="h-2.5 w-2.5" />
          </span>
        ) : (
          <ChevronDown
            className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''} ${isActive ? 'text-white/70' : 'text-gray-400'}`}
          />
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 min-w-[200px] rounded-xl border border-gray-100 bg-white shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12),0_2px_8px_-2px_rgba(0,0,0,0.06)] overflow-hidden">
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Toggle chip (no dropdown) ────────────────────────────────────────────────
interface ToggleChipProps {
  icon: React.ReactNode
  label: string
  active: boolean
  onToggle: () => void
}

function ToggleChip({ icon, label, active, onToggle }: ToggleChipProps) {
  return (
    <button
      onClick={onToggle}
      className={[
        'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium',
        'border transition-all duration-150 whitespace-nowrap',
        active
          ? 'border-blue bg-blue text-white'
          : 'border-gray-100 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900',
      ].join(' ')}
    >
      <span className={active ? 'text-white' : 'text-gray-400'}>{icon}</span>
      {label}
      {active && <X className="h-2.5 w-2.5 ml-0.5 text-white/70" />}
    </button>
  )
}

// ─── Status dropdown content ──────────────────────────────────────────────────
function StatusContent({
  selected,
  onToggle,
}: {
  selected: EntrepriseStatus[]
  onToggle: (s: EntrepriseStatus) => void
}) {
  return (
    <div className="py-1.5">
      {STATUS_OPTIONS.map((s) => {
        const active = selected.includes(s)
        return (
          <button
            key={s}
            onClick={() => onToggle(s)}
            className="flex w-full items-center gap-3 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[s]}`} />
            <span className="flex-1 text-left">{s}</span>
            {active && <Check className="h-3.5 w-3.5 text-blue" />}
          </button>
        )
      })}
    </div>
  )
}

// ─── Generic select dropdown content ─────────────────────────────────────────
function SelectContent({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div className="py-1.5 max-h-60 overflow-y-auto">
      <button
        onClick={() => onChange('')}
        className="flex w-full items-center gap-3 px-3.5 py-2 text-sm text-gray-400 hover:bg-gray-50 transition-colors"
      >
        <span className="flex-1 text-left italic">{placeholder}</span>
        {!value && <Check className="h-3.5 w-3.5 text-blue" />}
      </button>
      <div className="border-t border-gray-100 my-1" />
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className="flex w-full items-center gap-3 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span className="flex-1 text-left">{opt}</span>
          {value === opt && <Check className="h-3.5 w-3.5 text-blue" />}
        </button>
      ))}
    </div>
  )
}

// ─── Date range dropdown content ──────────────────────────────────────────────
function DateRangeContent({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: string
  to: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
}) {
  return (
    <div className="p-3.5 space-y-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Depuis</p>
        <input
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          className="w-full rounded-lg border border-gray-100 bg-white py-2 px-3 text-sm text-gray-900 outline-none focus:border-blue transition-colors"
        />
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Jusqu'au</p>
        <input
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          className="w-full rounded-lg border border-gray-100 bg-white py-2 px-3 text-sm text-gray-900 outline-none focus:border-blue transition-colors"
        />
      </div>
    </div>
  )
}

// ─── Main FilterPanel ─────────────────────────────────────────────────────────
export default function FilterPanel({ filters, secteurs, onChange, onReset, activeCount }: Props) {
  const commercials = Object.values(USERS)
    .filter((u) => u.role !== 'admin')
    .map((u) => u.name)

  const toggleStatus = (s: EntrepriseStatus) => {
    const cur = filters.status
    onChange({
      ...filters,
      status: cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s],
    })
  }

  const statusLabel =
    filters.status.length === 0
      ? undefined
      : filters.status.length === 1
        ? filters.status[0]
        : `${filters.status.length} statuts`

  const dateInsertionActive = !!(filters.date_insertion_from || filters.date_insertion_to)
  const dateInsertionLabel = dateInsertionActive
    ? filters.date_insertion_from && filters.date_insertion_to
      ? `${filters.date_insertion_from.slice(5)} → ${filters.date_insertion_to.slice(5)}`
      : filters.date_insertion_from
        ? `Depuis ${filters.date_insertion_from.slice(5)}`
        : `Jusqu'au ${filters.date_insertion_to.slice(5)}`
    : undefined

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Statut */}
      <ChipDropdown
        icon={<Tag className="h-3.5 w-3.5" />}
        label="Statut"
        activeLabel={statusLabel}
        isActive={filters.status.length > 0}
        onClear={() => onChange({ ...filters, status: [] })}
      >
        <StatusContent selected={filters.status} onToggle={toggleStatus} />
      </ChipDropdown>

      {/* Commercial */}
      <ChipDropdown
        icon={<User className="h-3.5 w-3.5" />}
        label="Commercial"
        activeLabel={filters.commercial || undefined}
        isActive={!!filters.commercial}
        onClear={() => onChange({ ...filters, commercial: '' })}
      >
        <SelectContent
          options={commercials}
          value={filters.commercial}
          onChange={(v) => onChange({ ...filters, commercial: v })}
          placeholder="Tous les commerciaux"
        />
      </ChipDropdown>

      {/* Secteur */}
      <ChipDropdown
        icon={<MapPin className="h-3.5 w-3.5" />}
        label="Secteur"
        activeLabel={filters.secteur || undefined}
        isActive={!!filters.secteur}
        onClear={() => onChange({ ...filters, secteur: '' })}
      >
        <SelectContent
          options={secteurs}
          value={filters.secteur}
          onChange={(v) => onChange({ ...filters, secteur: v })}
          placeholder="Tous les secteurs"
        />
      </ChipDropdown>

      {/* Date insertion */}
      <ChipDropdown
        icon={<CalendarDays className="h-3.5 w-3.5" />}
        label="Insertion"
        activeLabel={dateInsertionLabel}
        isActive={dateInsertionActive}
        onClear={() => onChange({ ...filters, date_insertion_from: '', date_insertion_to: '' })}
      >
        <DateRangeContent
          from={filters.date_insertion_from}
          to={filters.date_insertion_to}
          onFromChange={(v) => onChange({ ...filters, date_insertion_from: v })}
          onToChange={(v) => onChange({ ...filters, date_insertion_to: v })}
        />
      </ChipDropdown>

      {/* Relance aujourd'hui */}
      <ToggleChip
        icon={<Bell className="h-3.5 w-3.5" />}
        label="Relance aujourd'hui"
        active={filters.relance_today}
        onToggle={() => onChange({ ...filters, relance_today: !filters.relance_today })}
      />

      {/* Sans commercial */}
      <ToggleChip
        icon={<UserX className="h-3.5 w-3.5" />}
        label="Sans commercial"
        active={filters.unassigned_only}
        onToggle={() => onChange({ ...filters, unassigned_only: !filters.unassigned_only })}
      />

      {/* Reset */}
      {activeCount > 0 && (
        <>
          <div className="h-5 w-px bg-gray-200 mx-1" />
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-gray-400 hover:text-danger hover:bg-danger-bg border border-transparent hover:border-danger/20 transition-all duration-150"
          >
            <X className="h-3 w-3" />
            Réinitialiser
            <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gray-200 px-1 text-[10px] font-bold text-gray-500">
              {activeCount}
            </span>
          </button>
        </>
      )}
    </div>
  )
}

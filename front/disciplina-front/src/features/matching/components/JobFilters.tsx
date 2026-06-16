import { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown, X, Check, Car, Briefcase, MapPin, Users, Building2, Clock } from 'lucide-react'
import type { JobFilters } from '../services/jobFilters'
import { EMPTY_JOB_FILTERS, getDistinctAgeRanges } from '../services/jobFilters'
import type { Job } from '../types'
import { JobStatus, DesiredTP, DesiredSex, Sector, Localisation, formatEnumLabel } from '../constants/jobEnums'

interface Props {
  filters: JobFilters
  onChange: (filters: JobFilters) => void
  jobs: Job[]
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
            onClick={(e) => {
              e.stopPropagation()
              onClear()
            }}
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

// ─── Multi-select dropdown content ────────────────────────────────────────────
function MultiSelectContent({
  options,
  selected,
  onToggle,
  placeholder,
}: {
  options: { label: string; value: string }[]
  selected: string[]
  onToggle: (v: string) => void
  placeholder: string
}) {
  return (
    <div className="py-1.5 max-h-60 overflow-y-auto">
      <button
        onClick={() => {
          selected.forEach((s) => onToggle(s))
        }}
        className="flex w-full items-center gap-3 px-3.5 py-2 text-sm text-gray-400 hover:bg-gray-50 transition-colors"
      >
        <span className="flex-1 text-left italic">{placeholder}</span>
        {selected.length === 0 && <Check className="h-3.5 w-3.5 text-blue" />}
      </button>
      <div className="border-t border-gray-100 my-1" />
      {options.map((opt) => {
        const active = selected.includes(opt.value)
        return (
          <button
            key={opt.value}
            onClick={() => onToggle(opt.value)}
            className="flex w-full items-center gap-3 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span className="flex-1 text-left">{opt.label}</span>
            {active && <Check className="h-3.5 w-3.5 text-blue" />}
          </button>
        )
      })}
    </div>
  )
}

// ─── Single-select dropdown content ──────────────────────────────────────────
function SelectContent({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: { label: string; value: string }[]
  value: string | null
  onChange: (v: string | null) => void
  placeholder: string
}) {
  return (
    <div className="py-1.5 max-h-60 overflow-y-auto">
      <button
        onClick={() => onChange(null)}
        className="flex w-full items-center gap-3 px-3.5 py-2 text-sm text-gray-400 hover:bg-gray-50 transition-colors"
      >
        <span className="flex-1 text-left italic">{placeholder}</span>
        {value === null && <Check className="h-3.5 w-3.5 text-blue" />}
      </button>
      <div className="border-t border-gray-100 my-1" />
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="flex w-full items-center gap-3 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span className="flex-1 text-left">{opt.label}</span>
          {value === opt.value && <Check className="h-3.5 w-3.5 text-blue" />}
        </button>
      ))}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
export function JobFilters({ filters, onChange, jobs }: Props) {
  const statusOptions = Object.values(JobStatus).map((s) => ({ label: formatEnumLabel(s), value: s }))
  const tpOptions = Object.values(DesiredTP).map((tp) => ({ label: tp, value: tp }))
  const sexOptions = Object.values(DesiredSex).map((s) => ({ label: formatEnumLabel(s), value: s }))
  const sectorOptions = Object.values(Sector)
    .filter((s) => s !== Sector.NONE)
    .map((s) => ({ label: formatEnumLabel(s), value: s }))
  const localisationOptions = Object.values(Localisation).map((l) => ({ label: formatEnumLabel(l), value: l }))
  const ageRangeOptions = getDistinctAgeRanges(jobs).map((ar) => ({ label: ar, value: ar }))

  const activeCount = [
    filters.search,
    ...filters.statuses,
    filters.desiredTP,
    filters.desiredSex,
    filters.sector,
    ...filters.localisations,
    filters.ageRange,
    filters.drivingLicenceB !== null ? 'drivingLicenceB' : '',
  ].filter(Boolean).length

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher par entreprise..."
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue focus:border-transparent"
        />
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        <ChipDropdown
          icon={<Building2 className="h-3 w-3" />}
          label="Statut"
          activeLabel={filters.statuses.length === 1 ? filters.statuses[0] : `${filters.statuses.length} sélectionnés`}
          isActive={filters.statuses.length > 0}
          onClear={() => onChange({ ...filters, statuses: [] })}
        >
          <MultiSelectContent
            options={statusOptions}
            selected={filters.statuses}
            onToggle={(s) => {
              const updated = filters.statuses.includes(s)
                ? filters.statuses.filter((x) => x !== s)
                : [...filters.statuses, s]
              onChange({ ...filters, statuses: updated })
            }}
            placeholder="Tous les statuts"
          />
        </ChipDropdown>

        <ChipDropdown
          icon={<Briefcase className="h-3 w-3" />}
          label="Type TP"
          activeLabel={filters.desiredTP ? filters.desiredTP : undefined}
          isActive={filters.desiredTP !== null}
          onClear={() => onChange({ ...filters, desiredTP: null })}
        >
          <SelectContent
            options={tpOptions}
            value={filters.desiredTP}
            onChange={(tp) => onChange({ ...filters, desiredTP: tp })}
            placeholder="Tous les types"
          />
        </ChipDropdown>

        <ChipDropdown
          icon={<Users className="h-3 w-3" />}
          label="Sexe"
          activeLabel={filters.desiredSex ? formatEnumLabel(filters.desiredSex) : undefined}
          isActive={filters.desiredSex !== null}
          onClear={() => onChange({ ...filters, desiredSex: null })}
        >
          <SelectContent
            options={sexOptions}
            value={filters.desiredSex}
            onChange={(s) => onChange({ ...filters, desiredSex: s })}
            placeholder="Tous les sexes"
          />
        </ChipDropdown>

        <ChipDropdown
          icon={<Building2 className="h-3 w-3" />}
          label="Secteur"
          activeLabel={filters.sector ? formatEnumLabel(filters.sector) : undefined}
          isActive={filters.sector !== null}
          onClear={() => onChange({ ...filters, sector: null })}
        >
          <SelectContent
            options={sectorOptions}
            value={filters.sector}
            onChange={(s) => onChange({ ...filters, sector: s })}
            placeholder="Tous les secteurs"
          />
        </ChipDropdown>

        <ChipDropdown
          icon={<MapPin className="h-3 w-3" />}
          label="Localisation"
          activeLabel={filters.localisations.length === 1 ? formatEnumLabel(filters.localisations[0]) : `${filters.localisations.length} sélectionnées`}
          isActive={filters.localisations.length > 0}
          onClear={() => onChange({ ...filters, localisations: [] })}
        >
          <MultiSelectContent
            options={localisationOptions}
            selected={filters.localisations}
            onToggle={(l) => {
              const updated = filters.localisations.includes(l)
                ? filters.localisations.filter((x) => x !== l)
                : [...filters.localisations, l]
              onChange({ ...filters, localisations: updated })
            }}
            placeholder="Toutes les localisations"
          />
        </ChipDropdown>

        <ChipDropdown
          icon={<Clock className="h-3 w-3" />}
          label="Tranche d'âge"
          activeLabel={filters.ageRange ? filters.ageRange : undefined}
          isActive={filters.ageRange !== null}
          onClear={() => onChange({ ...filters, ageRange: null })}
        >
          <SelectContent
            options={ageRangeOptions}
            value={filters.ageRange}
            onChange={(ar) => onChange({ ...filters, ageRange: ar })}
            placeholder="Toutes les tranches"
          />
        </ChipDropdown>

        <ToggleChip
          icon={<Car className="h-3 w-3" />}
          label="Permis B"
          active={filters.drivingLicenceB === true}
          onToggle={() => onChange({ ...filters, drivingLicenceB: filters.drivingLicenceB === true ? null : true })}
        />

        {activeCount > 0 && (
          <button
            onClick={() => onChange(EMPTY_JOB_FILTERS)}
            className="ml-auto px-3 py-1.5 text-[12px] font-medium text-gray-600 hover:text-gray-900 border border-gray-100 rounded-full hover:border-gray-300 transition-all"
          >
            Réinitialiser
          </button>
        )}
      </div>
    </div>
  )
}

import { useState, useRef, useEffect, useMemo } from 'react'
import { Search, ChevronDown, X, Check, Briefcase, Building2, MapPin } from 'lucide-react'
import type { JobFilters } from '../services/jobFilters'
import { EMPTY_JOB_FILTERS } from '../services/jobFilters'
import { OfferStatus, DesiredTP, Sector, formatEnumLabel } from '../constants/jobEnums'
import { JOB_STATUS_LABELS } from '@/constants/jobStatus'
import { REGION_COMMUNES, REGION_LABELS, type Region } from '../constants/regions'
import { LOCALISATION_LABELS } from '@/data/reunionCommunes'

interface Props {
  filters: JobFilters
  onChange: (filters: JobFilters) => void
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

// ─── Region-sorted commune multi-select content ─────────────────────────────
const ALL_REGIONS: Region[] = ['NORD', 'OUEST', 'SUD']
const ALL_COMMUNES = ALL_REGIONS.flatMap((r) => REGION_COMMUNES[r])

function RegionMultiSelectContent({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (localisations: string[]) => void
}) {
  const allSelected = ALL_COMMUNES.every((c) => selected.includes(c))

  return (
    <div className="py-1.5 max-h-72 overflow-y-auto">
      {/* Select / deselect all */}
      <button
        onClick={() => onChange(allSelected ? [] : [...ALL_COMMUNES])}
        className="flex w-full items-center gap-3 px-3.5 py-2 text-sm text-gray-400 hover:bg-gray-50 transition-colors"
      >
        <span className="flex-1 text-left italic">{allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}</span>
      </button>
      <div className="border-t border-gray-100 my-1" />

      {ALL_REGIONS.map((region) => {
        const communes = REGION_COMMUNES[region]
        const regionSelected = communes.every((c) => selected.includes(c))
        const regionPartial = communes.some((c) => selected.includes(c)) && !regionSelected

        return (
          <div key={region}>
            {/* Region toggle */}
            <button
              onClick={() =>
                onChange(
                  regionSelected
                    ? selected.filter((c) => !communes.includes(c as any))
                    : [...new Set([...selected, ...communes])],
                )
              }
              className="flex w-full items-center gap-3 px-3.5 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors border-b border-gray-50"
            >
              <span className="flex-1 text-left">{REGION_LABELS[region]}</span>
              <span className="text-[11px] text-gray-400 font-normal">{communes.length} communes</span>
              {regionSelected && <Check className="h-3.5 w-3.5 text-blue shrink-0" />}
              {regionPartial && <div className="h-3.5 w-3.5 rounded-sm border-2 border-blue" />}
            </button>

            {/* Individual communes */}
            <div className="ml-4">
              {communes.map((commune) => {
                const active = selected.includes(commune)
                return (
                  <button
                    key={commune}
                    onClick={() =>
                      onChange(
                        active
                          ? selected.filter((c) => c !== commune)
                          : [...selected, commune],
                      )
                    }
                    className="flex w-full items-center gap-3 px-3.5 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <span className="flex-1 text-left">{LOCALISATION_LABELS[commune] ?? commune}</span>
                    {active && <Check className="h-3.5 w-3.5 text-blue shrink-0" />}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
export function JobFilters({ filters, onChange }: Props) {
  const statusOptions = Object.values(OfferStatus).map((s) => ({ label: JOB_STATUS_LABELS[s], value: s }))
  const tpOptions = Object.values(DesiredTP).map((tp) => ({ label: tp, value: tp }))
  const sectorOptions = Object.values(Sector)
    .filter((s) => s !== Sector.NONE)
    .map((s) => ({ label: formatEnumLabel(s), value: s }))

  const communeActiveLabel = useMemo(() => {
    if (filters.localisations.length === 0) return undefined
    const activeRegions = ALL_REGIONS.filter((r) =>
      REGION_COMMUNES[r].every((c) => filters.localisations.includes(c)),
    )
    if (activeRegions.length > 0) {
      return activeRegions.map((r) => REGION_LABELS[r]).join(', ')
    }
    return `${filters.localisations.length} commune${filters.localisations.length > 1 ? 's' : ''}`
  }, [filters.localisations])

  const activeCount = [
    filters.search,
    ...filters.statuses,
    filters.desiredTP,
    filters.sector,
    ...(filters.localisations.length > 0 ? ['localisations'] : []),
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
          activeLabel={filters.statuses.length === 1 ? JOB_STATUS_LABELS[filters.statuses[0] as OfferStatus] : `${filters.statuses.length} sélectionnés`}
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
          label="Commune"
          activeLabel={communeActiveLabel}
          isActive={filters.localisations.length > 0}
          onClear={() => onChange({ ...filters, localisations: [] })}
        >
          <RegionMultiSelectContent
            selected={filters.localisations}
            onChange={(localisations) => onChange({ ...filters, localisations })}
          />
        </ChipDropdown>

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

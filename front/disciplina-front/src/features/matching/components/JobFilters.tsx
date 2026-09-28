import { useState, useRef, useEffect, useMemo } from 'react'
import { IconCheck, IconChevronDown, IconClose, IconCompany, IconInstitution, IconJob, IconMapPin, IconSearch } from '@/components/ui/icons'
import type { JobFilters } from '../services/jobFilters'
import { EMPTY_JOB_FILTERS } from '../services/jobFilters'
import { OfferStatus, DesiredTP, Sector, Localisation, formatEnumLabel } from '../constants/jobEnums'
import { JOB_STATUS_LABELS } from '@/constants/jobStatus'
import { REGION_COMMUNES, REGION_LABELS, ANNEMASSE_REGION_COMMUNES, ANNEMASSE_REGION_LABELS, type Region, type AnnemasseRegion } from '../constants/regions'
import { LOCALISATION_LABELS } from '@/data/reunionCommunes'

interface Props {
  filters: JobFilters
  onChange: (filters: JobFilters) => void
  hideSearch?: boolean
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
            : 'border-[var(--ds-border)] bg-[var(--ds-surface)] text-[var(--ds-text-muted)] hover:border-[var(--ds-border-strong)] hover:text-[var(--ds-text)]',
        ].join(' ')}
      >
        <span className={isActive ? 'text-white' : 'text-[var(--ds-text-subtle)]'}>{icon}</span>
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
            className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--ds-surface)] hover:bg-[var(--ds-surface)] transition-colors"
          >
            <IconClose className="h-2.5 w-2.5" />
          </span>
        ) : (
          <IconChevronDown
            className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''} ${isActive ? 'text-white/70' : 'text-[var(--ds-text-subtle)]'}`}
          />
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 min-w-[200px] rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12),0_2px_8px_-2px_rgba(0,0,0,0.06)] overflow-hidden">
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
        className="flex w-full items-center gap-3 px-3.5 py-2 text-sm text-[var(--ds-text-subtle)] hover:bg-[var(--ds-surface-sunken)] transition-colors"
      >
        <span className="flex-1 text-left italic">{placeholder}</span>
        {selected.length === 0 && <IconCheck className="h-3.5 w-3.5 text-blue" />}
      </button>
      <div className="border-t border-[var(--ds-border)] my-1" />
      {options.map((opt) => {
        const active = selected.includes(opt.value)
        return (
          <button
            key={opt.value}
            onClick={() => onToggle(opt.value)}
            className="flex w-full items-center gap-3 px-3.5 py-2 text-sm text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-sunken)] transition-colors"
          >
            <span className="flex-1 text-left">{opt.label}</span>
            {active && <IconCheck className="h-3.5 w-3.5 text-blue" />}
          </button>
        )
      })}
    </div>
  )
}

// ─── Region-sorted commune multi-select content ─────────────────────────────
const ALL_REGIONS: Region[] = ['NORD', 'OUEST', 'SUD']
const ANNEMASSE_REGIONS: AnnemasseRegion[] = [
  'GENEVE_FRONTIERE',
  'GENEVOIS',
  'ARVE',
  'FAUCIGNY',
  'ANNECY',
  'CHABLAIS',
]
const ALL_COMMUNES = [
  ...ALL_REGIONS.flatMap((r) => REGION_COMMUNES[r]),
  ...ANNEMASSE_REGIONS.flatMap((r) => ANNEMASSE_REGION_COMMUNES[r]),
]

/** Sections du filtre commune : 3 zones Réunion puis 6 secteurs Annemasse. */
const COMMUNE_SECTIONS: { key: string; communes: Localisation[]; label: string }[] = [
  ...ALL_REGIONS.map((r) => ({ key: r, communes: [...REGION_COMMUNES[r]], label: REGION_LABELS[r] })),
  ...ANNEMASSE_REGIONS.map((r) => ({
    key: r,
    communes: [...ANNEMASSE_REGION_COMMUNES[r]],
    label: ANNEMASSE_REGION_LABELS[r],
  })),
]

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
        className="flex w-full items-center gap-3 px-3.5 py-2 text-sm text-[var(--ds-text-subtle)] hover:bg-[var(--ds-surface-sunken)] transition-colors"
      >
        <span className="flex-1 text-left italic">{allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}</span>
      </button>
      <div className="border-t border-[var(--ds-border)] my-1" />

      {COMMUNE_SECTIONS.map(({ key, communes, label }) => {
        const regionSelected = communes.every((c) => selected.includes(c))
        const regionPartial = communes.some((c) => selected.includes(c)) && !regionSelected

        return (
          <div key={key}>
            {/* Region toggle */}
            <button
              onClick={() =>
                onChange(
                  regionSelected
                    ? selected.filter((c) => !communes.includes(c as any))
                    : [...new Set([...selected, ...communes])],
                )
              }
              className="flex w-full items-center gap-3 px-3.5 py-2 text-sm font-semibold text-[var(--ds-text)] hover:bg-[var(--ds-surface-sunken)] transition-colors border-b border-[var(--ds-border)]"
            >
              <span className="flex-1 text-left">{label}</span>
              <span className="text-[11px] text-[var(--ds-text-subtle)] font-normal">{communes.length} communes</span>
              {regionSelected && <IconCheck className="h-3.5 w-3.5 text-blue shrink-0" />}
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
                    className="flex w-full items-center gap-3 px-3.5 py-1.5 text-sm text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-sunken)] transition-colors"
                  >
                    <span className="flex-1 text-left">{LOCALISATION_LABELS[commune] ?? commune}</span>
                    {active && <IconCheck className="h-3.5 w-3.5 text-blue shrink-0" />}
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
export function JobFilters({ filters, onChange, hideSearch = false }: Props) {
  const statusOptions = Object.values(OfferStatus).map((s) => ({ label: JOB_STATUS_LABELS[s], value: s }))
  const tpOptions = Object.values(DesiredTP).map((tp) => ({ label: tp, value: tp }))
  const sectorOptions = Object.values(Sector)
    .filter((s) => s !== Sector.NONE)
    .map((s) => ({ label: formatEnumLabel(s), value: s }))

  const communeActiveLabel = useMemo(() => {
    if (filters.localisations.length === 0) return undefined
    const activeSections = COMMUNE_SECTIONS.filter((s) =>
      s.communes.every((c) => filters.localisations.includes(c)),
    )
    if (activeSections.length > 0) {
      return activeSections.map((s) => s.label).join(', ')
    }
    return `${filters.localisations.length} commune${filters.localisations.length > 1 ? 's' : ''}`
  }, [filters.localisations])

  const administrationOptions = [
    { label: 'Non renseigné', value: 'NON_RENSEIGNE' },
    { label: 'Administration publique', value: 'ADMINISTRATION_PUBLIQUE' },
    { label: 'Administration privée', value: 'ADMINISTRATION_PRIVEE' },
  ]

  const activeCount = [
    filters.search,
    ...filters.statuses,
    ...filters.desiredTPs,
    ...filters.sectors,
    ...(filters.localisations.length > 0 ? ['localisations'] : []),
    ...(filters.administrationTypes.length > 0 ? ['administration'] : []),
  ].filter(Boolean).length

  return (
    <div className="space-y-3">
      {/* Search bar */}
      {!hideSearch && (
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ds-text-subtle)]" />
          <input
            type="text"
            placeholder="Rechercher par entreprise..."
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="w-full pl-9 pr-3 py-2 text-sm border border-[var(--ds-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue focus:border-transparent"
          />
        </div>
      )}

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        <ChipDropdown
          icon={<IconCompany className="h-3 w-3" />}
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
          icon={<IconJob className="h-3 w-3" />}
          label="Type TP"
          activeLabel={filters.desiredTPs.length === 1 ? filters.desiredTPs[0] : `${filters.desiredTPs.length} sélectionnés`}
          isActive={filters.desiredTPs.length > 0}
          onClear={() => onChange({ ...filters, desiredTPs: [] })}
        >
          <MultiSelectContent
            options={tpOptions}
            selected={filters.desiredTPs}
            onToggle={(tp) => {
              const updated = filters.desiredTPs.includes(tp)
                ? filters.desiredTPs.filter((x) => x !== tp)
                : [...filters.desiredTPs, tp]
              onChange({ ...filters, desiredTPs: updated })
            }}
            placeholder="Tous les types"
          />
        </ChipDropdown>

        <ChipDropdown
          icon={<IconCompany className="h-3 w-3" />}
          label="Secteur"
          activeLabel={filters.sectors.length === 1 ? formatEnumLabel(filters.sectors[0]) : `${filters.sectors.length} sélectionnés`}
          isActive={filters.sectors.length > 0}
          onClear={() => onChange({ ...filters, sectors: [] })}
        >
          <MultiSelectContent
            options={sectorOptions}
            selected={filters.sectors}
            onToggle={(s) => {
              const updated = filters.sectors.includes(s)
                ? filters.sectors.filter((x) => x !== s)
                : [...filters.sectors, s]
              onChange({ ...filters, sectors: updated })
            }}
            placeholder="Tous les secteurs"
          />
        </ChipDropdown>

        <ChipDropdown
          icon={<IconMapPin className="h-3 w-3" />}
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

        <ChipDropdown
          icon={<IconInstitution className="h-3 w-3" />}
          label="Administration"
          activeLabel={filters.administrationTypes.length === 1 ? (administrationOptions.find(o => o.value === filters.administrationTypes[0])?.label ?? filters.administrationTypes[0]) : `${filters.administrationTypes.length} sélectionnés`}
          isActive={filters.administrationTypes.length > 0}
          onClear={() => onChange({ ...filters, administrationTypes: [] })}
        >
          <MultiSelectContent
            options={administrationOptions}
            selected={filters.administrationTypes}
            onToggle={(v) => {
              const updated = filters.administrationTypes.includes(v)
                ? filters.administrationTypes.filter((x) => x !== v)
                : [...filters.administrationTypes, v]
              onChange({ ...filters, administrationTypes: updated })
            }}
            placeholder="Tous les types"
          />
        </ChipDropdown>

        {activeCount > 0 && (
          <button
            onClick={() => onChange(EMPTY_JOB_FILTERS)}
            className="ml-auto px-3 py-1.5 text-[12px] font-medium text-[var(--ds-text-muted)] hover:text-[var(--ds-text)] border border-[var(--ds-border)] rounded-full hover:border-[var(--ds-border-strong)] transition-all"
          >
            Réinitialiser
          </button>
        )}
      </div>
    </div>
  )
}

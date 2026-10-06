import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconCalendar, IconCheckCircle, IconCompany, IconLoader, IconRefresh, IconSearch } from '@/components/ui/icons'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'
import { fetchAlternants, fetchSequences } from '@/api/alternants'
import type { Alternant, AlternantSequence } from '@/types/alternant'

type Bucket = 'late' | 'soon' | 'upcoming'

const DAY_MS = 24 * 60 * 60 * 1000
/** Seuil « En cours » : SA prévue dans moins de 14 jours. */
const SOON_THRESHOLD_DAYS = 14
/** Seuil « À venir » : SA prévue entre 14 jours et un mois. */
const UPCOMING_THRESHOLD_DAYS = 30

interface DashboardRow {
  alternant: Alternant
  sequence: AlternantSequence
  /** Jours entre aujourd'hui (00h00) et la date prévue : négatif = en retard. */
  diffDays: number
}

function diffDaysFromToday(prevueLe: string): number {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const prevue = new Date(prevueLe)
  prevue.setHours(0, 0, 0, 0)
  return Math.round((prevue.getTime() - startOfToday.getTime()) / DAY_MS)
}

function bucketOf(diffDays: number): Bucket | null {
  if (diffDays < 0) return 'late'
  if (diffDays < SOON_THRESHOLD_DAYS) return 'soon'
  if (diffDays <= UPCOMING_THRESHOLD_DAYS) return 'upcoming'
  return null
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Libellé du délai d'une SA : « En retard de N jours » ou « Dans N jours ». */
function delayLabel(diffDays: number): string {
  if (diffDays < 0) return `En retard de ${-diffDays} jour${-diffDays > 1 ? 's' : ''}`
  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) return 'Demain'
  return `Dans ${diffDays} jours`
}

function DelayBadge({ diffDays }: { diffDays: number }) {
  if (diffDays < 0) return <Badge tone="danger">{delayLabel(diffDays)}</Badge>
  if (diffDays < SOON_THRESHOLD_DAYS) return <Badge tone="warning">{delayLabel(diffDays)}</Badge>
  return <Badge tone="accent">{delayLabel(diffDays)}</Badge>
}

function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count > 1 ? (plural ?? `${singular}s`) : singular}`
}

export default function DashboardPeda() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Bucket>('late')
  const [rows, setRows] = useState<DashboardRow[]>([])
  const [beyondCount, setBeyondCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      const alternants = await fetchAlternants()
      const byAlternant = await Promise.all(alternants.map((a) => fetchSequences(a.id)))
      if (!alive) return
      const collected: DashboardRow[] = []
      let beyond = 0
      alternants.forEach((alternant, index) => {
        for (const sequence of byAlternant[index] ?? []) {
          // Seules les SA en attente alimentent le tableau de bord.
          if (sequence.status !== 'pending') continue
          const diffDays = diffDaysFromToday(sequence.prevueLe)
          if (bucketOf(diffDays) === null) {
            beyond += 1
            continue
          }
          collected.push({ alternant, sequence, diffDays })
        }
      })
      // En retard : les plus en retard d'abord ; En cours / À venir : les plus proches d'abord.
      collected.sort((a, b) => a.diffDays - b.diffDays)
      setRows(collected)
      setBeyondCount(beyond)
      setLoading(false)
    })().catch((e: unknown) => {
      if (!alive) return
      setError(e instanceof Error ? e.message : 'Chargement impossible')
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [refreshKey])

  const buckets = useMemo(() => {
    const grouped: Record<Bucket, DashboardRow[]> = { late: [], soon: [], upcoming: [] }
    for (const row of rows) {
      const bucket = bucketOf(row.diffDays)
      if (bucket) grouped[bucket].push(row)
    }
    return grouped
  }, [rows])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const current = buckets[tab]
    if (!needle) return current
    return current.filter(
      ({ alternant }) =>
        alternant.fullName.toLowerCase().includes(needle) ||
        alternant.session.toLowerCase().includes(needle) ||
        (alternant.company?.name ?? '').toLowerCase().includes(needle),
    )
  }, [buckets, tab, search])

  const distinctAlternants = useMemo(() => new Set(filtered.map((r) => r.alternant.id)).size, [filtered])

  const tabDescriptions: Record<Bucket, string> = {
    late: 'SA dont la date prévue est dépassée.',
    soon: 'SA prévue dans moins de 14 jours.',
    upcoming: 'SA prévue entre 14 jours et un mois.',
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
      <PageHeader
        eyebrow="Espace pédagogique"
        title="Tableau de bord des SA"
        description="Séquences d'accompagnement (SA) en attente, classées par échéance."
        actions={
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<IconRefresh width={16} height={16} />}
            onClick={() => {
              setLoading(true)
              setError(null)
              setRefreshKey((k) => k + 1)
            }}
            disabled={loading}
          >
            Actualiser
          </Button>
        }
      />

      {error && (
        <div className="mb-6 rounded-xl border border-[var(--ds-danger)]/30 bg-[var(--ds-danger-bg)] px-4 py-3 text-sm text-[var(--ds-danger)]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[var(--ds-text-subtle)]">
          <IconLoader width={28} height={28} className="animate-spin" />
        </div>
      ) : (
        <>
          <Tabs<Bucket>
            label="Échéances des séquences d'accompagnement"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'late', label: 'En retard', count: buckets.late.length },
              { value: 'soon', label: 'En cours', count: buckets.soon.length },
              { value: 'upcoming', label: 'À venir', count: buckets.upcoming.length },
            ]}
          />

          <div className="mt-4 mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--ds-text-subtle)]">
              {tabDescriptions[tab]}{' '}
              <strong className="font-bold text-[var(--ds-text)]">
                {pluralize(filtered.length, 'SA')}
              </strong>{' '}
              · {pluralize(distinctAlternants, 'alternant')}
            </p>
            <div className="relative w-full max-w-xs">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--ds-text-subtle)]">
                <IconSearch width={16} height={16} />
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher (nom, session, entreprise)…"
                aria-label="Rechercher un alternant"
                className="w-full rounded-[var(--radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface)] py-2 pl-9 pr-3 text-sm text-[var(--ds-text)] placeholder:text-[var(--ds-text-subtle)] outline-none transition-colors focus:border-[var(--ds-accent)]"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<IconCheckCircle width={24} height={24} />}
              title={search.trim() ? 'Aucun résultat pour cette recherche' : 'Aucune SA dans cet onglet'}
              description={
                search.trim()
                  ? 'Essayez un autre nom, une autre session ou une autre entreprise.'
                  : tab === 'late'
                    ? 'Aucune séquence d’accompagnement en retard. Beau travail !'
                    : 'Aucune séquence d’accompagnement à cette échéance.'
              }
            />
          ) : (
            <ul className="space-y-3">
              {filtered.map(({ alternant, sequence, diffDays }) => (
                <li key={sequence.id}>
                  <Card className="transition-colors hover:border-teal-700/30">
                    <div className="flex flex-wrap items-center gap-4">
                      <button
                        type="button"
                        onClick={() => navigate(`/peda/alternants/${alternant.id}`)}
                        title={`Ouvrir la fiche de ${alternant.fullName}`}
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left"
                      >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-700/10 text-sm font-bold text-teal-700">
                          {(alternant.firstName[0] ?? '?').toUpperCase()}
                          {(alternant.lastName[0] ?? '').toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-bold text-[var(--ds-text)] hover:text-teal-700">
                            {alternant.fullName}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-[var(--ds-text-subtle)]">
                            <span className="inline-flex items-center rounded-md bg-[#CCFBF1] px-2 py-0.5 font-bold text-[#0F766E] ring-1 ring-inset ring-[#0F766E]/20">
                              {alternant.session}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <IconCompany width={12} height={12} />
                              {alternant.company?.name || 'Sans entreprise'}
                            </span>
                          </span>
                        </span>
                      </button>
                      <span className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                        <span className="font-semibold text-[var(--ds-text)]">SA n°{sequence.numero}</span>
                        <span className="inline-flex items-center gap-1.5 text-[var(--ds-text-muted)]">
                          <IconCalendar width={14} height={14} className="text-[var(--ds-text-subtle)]" />
                          Prévue le {formatDate(sequence.prevueLe)}
                        </span>
                        <DelayBadge diffDays={diffDays} />
                      </span>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}

          {beyondCount > 0 && (
            <p className="mt-4 text-[12px] text-[var(--ds-text-subtle)]">
              {pluralize(beyondCount, 'SA planifiée', 'SA planifiées')} au-delà d'un mois{' '}
              {beyondCount > 1 ? 'ne sont pas affichées' : "n'est pas affichée"} ici — retrouvez-les sur les fiches
              alternants.
            </p>
          )}
        </>
      )}
    </div>
  )
}

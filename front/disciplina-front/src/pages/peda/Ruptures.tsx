import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconAlert, IconCalendar, IconCompany, IconLoader } from '@/components/ui/icons'
import Badge from '@/components/ui/Badge'
import Card, { CardHeader } from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import Select from '@/components/ui/Select'
import { fetchRuptures } from '@/api/ruptures'
import { formatRuptureDate, poursuiteLabel, type Rupture } from '@/types/rupture'

const MONTH_LABELS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
]

/** Années proposées autour de l'année en cours. */
function yearOptions(): number[] {
  const current = new Date().getFullYear()
  return [current - 3, current - 2, current - 1, current, current + 1]
}

export default function Ruptures() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [ruptures, setRuptures] = useState<Rupture[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetchRuptures(year, month).then(
      (rows) => {
        if (!alive) return
        setRuptures(rows)
        setError(null)
        setLoading(false)
      },
      (e: unknown) => {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'Chargement impossible')
        setLoading(false)
      },
    )
    return () => {
      alive = false
    }
  }, [year, month])

  const poursuivent = ruptures.filter((r) => r.poursuitFormation).length
  const quittent = ruptures.length - poursuivent

  const counters = [
    { label: 'Ruptures sur le mois', value: ruptures.length },
    { label: 'Poursuivent la formation', value: poursuivent },
    { label: 'Quittent la formation', value: quittent },
  ]

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
      <PageHeader
        eyebrow="Espace pédagogique"
        title="Ruptures"
        description="Rapport mensuel des ruptures de contrats d'apprentissage."
        actions={
          <>
            <Select
              ariaLabel="Mois"
              value={month}
              onChange={(v) => {
                setLoading(true)
                setMonth(v)
              }}
              options={MONTH_LABELS.map((label, i) => ({ value: i + 1, label }))}
              size="sm"
              className="w-40"
            />
            <Select
              ariaLabel="Année"
              value={year}
              onChange={(v) => {
                setLoading(true)
                setYear(v)
              }}
              options={yearOptions().map((y) => ({ value: y, label: String(y) }))}
              size="sm"
              className="w-28"
            />
          </>
        }
      />

      {error && (
        <div className="mb-6 rounded-xl border border-[var(--ds-danger)]/30 bg-[var(--ds-danger-bg)] px-4 py-3 text-sm text-[var(--ds-danger)]">
          {error}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {counters.map((c) => (
          <Card key={c.label}>
            <p className="text-[13px] font-semibold text-[var(--ds-text-subtle)]">{c.label}</p>
            <p className="mt-1 text-3xl font-extrabold tracking-tight text-[var(--ds-text)]">{loading ? '…' : c.value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader
          title="Détail des ruptures du mois"
          description={
            loading
              ? 'Chargement…'
              : `${ruptures.length} rupture${ruptures.length > 1 ? 's' : ''} — ${MONTH_LABELS[month - 1].toLowerCase()} ${year}`
          }
        />
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[var(--ds-text-subtle)]">
            <IconLoader width={28} height={28} className="animate-spin" />
          </div>
        ) : ruptures.length === 0 ? (
          <EmptyState
            icon={<IconAlert width={24} height={24} />}
            title="Aucune rupture ce mois-ci"
            description="Les ruptures déclarées depuis les fiches alternants apparaîtront ici."
          />
        ) : (
          <ul className="space-y-3">
            {ruptures.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      to={`/peda/alternants/${r.alternantId}`}
                      className="font-bold text-[var(--ds-text)] hover:text-teal-700 hover:underline"
                    >
                      {r.fullName || 'Alternant'}
                    </Link>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-[var(--ds-text-muted)]">
                      <span className="inline-flex items-center rounded-md bg-[#CCFBF1] px-2 py-0.5 text-xs font-bold text-[#0F766E] ring-1 ring-inset ring-[#0F766E]/20">
                        {r.session || 'Hors groupe'}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <IconCalendar width={13} height={13} className="text-[var(--ds-text-subtle)]" />
                        Rupture le {formatRuptureDate(r.dateRupture)}
                      </span>
                    </p>
                  </div>
                  <Badge tone={r.poursuitFormation ? 'success' : 'danger'}>{poursuiteLabel(r.poursuitFormation)}</Badge>
                </div>
                <div className="mt-3 space-y-1.5 border-t border-[var(--ds-border)] pt-3 text-sm">
                  <p className="flex items-center gap-2 text-[var(--ds-text-muted)]">
                    <IconCompany width={15} height={15} className="shrink-0 text-[var(--ds-text-subtle)]" />
                    <span className="font-semibold text-[var(--ds-text)]">{r.entreprise || 'Entreprise non renseignée'}</span>
                  </p>
                  <p className="text-[13px] italic text-[var(--ds-text-muted)]">{r.motif}</p>
                  {r.detail && <p className="text-[13px] text-[var(--ds-text-muted)]">Détail : {r.detail}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  IconAlert,
  IconCalendar,
  IconDownload,
  IconLoader,
  IconRefresh,
  IconTraining,
  IconUsers,
} from '@/components/ui/icons'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card, { CardHeader } from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import Select from '@/components/ui/Select'
import Tabs from '@/components/ui/Tabs'
import { fetchAssiduite, fetchAttendanceExport, fetchGroupSummary } from '@/api/emargement'
import { fetchSessions } from '@/api/sessions'
import { toast } from '@/store/toastStore'
import { downloadBlob } from '@/utils/download'
import { SEANCE_SITES } from '@/types/emargement'
import type { AssiduiteAlternantRow, AssiduiteRow, SeanceSite } from '@/types/emargement'
import type { Session } from '@/types/session'
import {
  LOW_ATTENDANCE_RATE,
  formatDay,
  formatMinutes,
  formatRate,
  presenceLabel,
  presenceTone,
} from '@/utils/emargement'

type Breakdown = 'alternants' | 'sessions' | 'sites'

const FIELD =
  'rounded-[var(--radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 py-2 text-sm text-[var(--ds-text)] outline-none focus:border-[var(--ds-accent)]'

const RATE_TONE = { good: 'success', low: 'danger', unknown: 'neutral' } as const

/** Premier jour du mois courant, en date locale (`YYYY-MM-DD`). */
function monthStart(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return `${new Date(now.getTime() - offset).toISOString().slice(0, 8)}01`
}

function today(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function rateTone(rate: number | null) {
  if (rate === null) return RATE_TONE.unknown
  return rate >= LOW_ATTENDANCE_RATE ? RATE_TONE.good : RATE_TONE.low
}

/** Tuile de synthèse : un chiffre, un libellé, une précision optionnelle. */
function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ds-text-subtle)]">{label}</p>
      <p className="mt-1 text-[22px] font-extrabold leading-tight text-[var(--ds-text)]">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-[var(--ds-text-subtle)]">{hint}</p>}
    </div>
  )
}

/** Cellules communes aux trois découpages (alternant, session, site). */
function TotalsCells({ row }: { row: AssiduiteRow }) {
  return (
    <>
      <td className="px-4 py-3 text-right tabular-nums">{row.seances}</td>
      <td className="px-4 py-3 text-right tabular-nums">{formatMinutes(row.plannedMinutes)}</td>
      <td className="px-4 py-3 text-right tabular-nums">{formatMinutes(row.attendedMinutes)}</td>
      <td className="px-4 py-3 text-right tabular-nums">{row.absences}</td>
      <td className="px-4 py-3 text-right">
        <Badge tone={rateTone(row.rate)}>{formatRate(row.rate)}</Badge>
      </td>
      <td className="px-4 py-3 text-right">
        {row.missingHalves > 0 ? (
          <Badge tone="warning" icon={<IconAlert width={12} height={12} />}>
            {row.missingHalves}
          </Badge>
        ) : (
          <span className="text-[12px] text-[var(--ds-text-subtle)]">—</span>
        )}
      </td>
    </>
  )
}

const TABLE_HEAD = (
  <tr className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-subtle)]">
    <th className="px-4 py-3 text-left">Alternant / groupe</th>
    <th className="px-4 py-3 text-right">Séances</th>
    <th className="px-4 py-3 text-right">Heures prévues</th>
    <th className="px-4 py-3 text-right">Heures réalisées</th>
    <th className="px-4 py-3 text-right">Absences</th>
    <th className="px-4 py-3 text-right">Taux</th>
    <th className="px-4 py-3 text-right" title="Demi-journées fermées sans statut saisi">
      Non renseignées
    </th>
  </tr>
)

export default function AssiduitePage() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())
  const [sessionId, setSessionId] = useState('')
  const [site, setSite] = useState('')
  const [sessions, setSessions] = useState<Session[]>([])
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchAssiduite>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Breakdown>('alternants')
  const [reloadKey, setReloadKey] = useState(0)
  const [exporting, setExporting] = useState<string | null>(null)

  // Liste des sessions pour le filtre « groupe » (source GraphQL péda).
  useEffect(() => {
    let alive = true
    fetchSessions().then(
      (rows) => {
        if (alive) setSessions(rows)
      },
      () => {
        // Le filtre par session est secondaire : une erreur ne bloque pas la page.
      },
    )
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    let alive = true
    fetchAssiduite({
      from: from || undefined,
      to: to || undefined,
      sessionId: sessionId || undefined,
      site: (site || undefined) as SeanceSite | undefined,
    }).then(
      (result) => {
        if (!alive) return
        setData(result)
        setError(null)
        setLoading(false)
      },
      (err: unknown) => {
        if (!alive) return
        setError(err instanceof Error ? err.message : 'Chargement impossible')
        setLoading(false)
      },
    )
    return () => {
      alive = false
    }
  }, [from, to, sessionId, site, reloadKey])

  const runExport = async (key: string, task: () => Promise<{ blob: Blob; fileName: string }>) => {
    setExporting(key)
    try {
      const { blob, fileName } = await task()
      downloadBlob(blob, fileName)
    } catch (err) {
      toast.errorMessage('Export impossible', err instanceof Error ? err.message : undefined)
    } finally {
      setExporting(null)
    }
  }

  const rows = data
    ? tab === 'alternants'
      ? data.alternants
      : tab === 'sessions'
        ? data.sessions
        : data.sites
    : []
  const exportFilter = {
    from: from || undefined,
    to: to || undefined,
    sessionId: sessionId || undefined,
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
      <PageHeader
        eyebrow="Espace pédagogique"
        title="Assiduité"
        description="Taux, heures prévues et réalisées — par alternant, par groupe et par site, sur la période choisie."
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={<IconRefresh width={16} height={16} />}
              onClick={() => {
                setLoading(true)
                setReloadKey((key) => key + 1)
              }}
              disabled={loading}
            >
              Actualiser
            </Button>
            <Button
              variant="secondary"
              leftIcon={<IconDownload width={16} height={16} />}
              isLoading={exporting === 'csv'}
              disabled={exporting !== null}
              onClick={() => runExport('csv', () => fetchAttendanceExport(exportFilter, 'csv'))}
            >
              Présences CSV
            </Button>
            <Button
              variant="secondary"
              leftIcon={<IconDownload width={16} height={16} />}
              isLoading={exporting === 'xlsx'}
              disabled={exporting !== null}
              onClick={() => runExport('xlsx', () => fetchAttendanceExport(exportFilter, 'xlsx'))}
            >
              Présences Excel
            </Button>
          </>
        }
      />

      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ds-text-subtle)]">
              Du
            </span>
            <input
              type="date"
              value={from}
              onChange={(event) => {
                setLoading(true)
                setFrom(event.target.value)
              }}
              className={FIELD}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ds-text-subtle)]">
              Au
            </span>
            <input
              type="date"
              value={to}
              onChange={(event) => {
                setLoading(true)
                setTo(event.target.value)
              }}
              className={FIELD}
            />
          </label>
          <div className="min-w-[220px]">
            <Select
              label="Groupe"
              options={[
                { value: '', label: 'Toutes les sessions' },
                ...sessions.map((session) => ({ value: session.id, label: session.nom })),
              ]}
              value={sessionId}
              onChange={(value) => {
                setLoading(true)
                setSessionId(value)
              }}
              size="sm"
            />
          </div>
          <div className="min-w-[160px]">
            <Select
              label="Site"
              options={[
                { value: '', label: 'Tous les sites' },
                ...SEANCE_SITES.map((value) => ({ value, label: value })),
              ]}
              value={site}
              onChange={(value) => {
                setLoading(true)
                setSite(value)
              }}
              size="sm"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setLoading(true)
              setFrom(monthStart())
              setTo(today())
              setSessionId('')
              setSite('')
            }}
          >
            Réinitialiser
          </Button>
        </div>
      </Card>

      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--ds-danger-bg)] px-4 py-3 text-sm text-[var(--ds-danger)]">
          <IconAlert width={18} height={18} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {loading || !data ? (
        <div className="flex items-center justify-center py-20 text-[var(--ds-text-subtle)]">
          <IconLoader width={28} height={28} className="animate-spin" />
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Alternants" value={String(data.totals.alternants)} />
            <Stat label="Séances" value={String(data.totals.seances)} />
            <Stat label="Heures prévues" value={formatMinutes(data.totals.plannedMinutes)} />
            <Stat label="Heures réalisées" value={formatMinutes(data.totals.attendedMinutes)} />
            <Stat
              label="Taux d’assiduité"
              value={formatRate(data.totals.rate)}
              hint={data.totals.absences > 0 ? `${data.totals.absences} absence(s)` : undefined}
            />
            <Stat
              label="Non renseignées"
              value={String(data.totals.missingHalves)}
              hint="demi-journées fermées sans statut"
            />
          </div>

          {data.totals.missingHalves > 0 && (
            <div className="mb-4 flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--ds-warning-bg)] px-4 py-3 text-sm text-[var(--ds-warning)]">
              <IconAlert width={18} height={18} className="mt-0.5 shrink-0" />
              <span>
                <strong>
                  {data.totals.missingHalves} demi-journée{data.totals.missingHalves > 1 ? 's' : ''} fermée
                  {data.totals.missingHalves > 1 ? 's' : ''} sans statut
                </strong>{' '}
                sur la période : le taux est sous-évalué tant que les feuilles ne sont pas complétées.
              </span>
            </div>
          )}

          <div className="mb-4">
            <Tabs<Breakdown>
              label="Découpage de l’assiduité"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'alternants', label: 'Alternants', count: data.alternants.length },
                { value: 'sessions', label: 'Groupes', count: data.sessions.length },
                { value: 'sites', label: 'Sites', count: data.sites.length },
              ]}
            />
          </div>

          <Card padding="lg">
            <CardHeader
              title={tab === 'alternants' ? 'Assiduité par alternant' : tab === 'sessions' ? 'Assiduité par groupe' : 'Assiduité par site'}
              description={
                data.from && data.to
                  ? `Du ${formatDay(data.from)} au ${formatDay(data.to)}`
                  : 'Sur toute la période disponible'
              }
              actions={
                tab === 'sessions' && sessionId ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<IconDownload width={15} height={15} />}
                    isLoading={exporting === 'group'}
                    disabled={exporting !== null}
                    onClick={() =>
                      runExport('group', () =>
                        fetchGroupSummary(sessionId, { from: from || undefined, to: to || undefined }),
                      )
                    }
                  >
                    Récapitulatif PDF
                  </Button>
                ) : undefined
              }
            />

            {rows.length === 0 ? (
              <EmptyState
                icon={tab === 'sites' ? <IconCalendar width={24} height={24} /> : <IconUsers width={24} height={24} />}
                title="Aucune donnée d’assiduité"
                description="Aucune feuille d’émargement sur la période : créez une séance ou élargissez les dates."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-[13px]">
                  <thead className="border-b border-[var(--ds-border)]">{TABLE_HEAD}</thead>
                  <tbody>
                    {tab === 'alternants'
                      ? (rows as AssiduiteAlternantRow[]).map((row) => {
                          const note = presenceLabel(row.presence)
                          return (
                            <tr key={row.key} className="border-b border-[var(--ds-border)] last:border-0">
                              <td className="px-4 py-3">
                                <Link
                                  to={`/peda/alternants/${row.alternantId}`}
                                  className="font-semibold text-[var(--ds-text)] no-underline hover:text-[var(--ds-accent)]"
                                >
                                  {row.lastName} {row.firstName}
                                </Link>
                                <p className="mt-0.5 text-[11px] text-[var(--ds-text-subtle)]">
                                  {row.sessions} session{row.sessions > 1 ? 's' : ''}
                                  {row.lastSeanceDate ? ` · dernière séance le ${formatDay(row.lastSeanceDate)}` : ''}
                                  {row.financeur ? ` · ${row.financeur}` : ''}
                                </p>
                                {note && (
                                  <p className="mt-1">
                                    <Badge tone={presenceTone(row.presence)}>{note}</Badge>
                                  </p>
                                )}
                              </td>
                              <TotalsCells row={row} />
                            </tr>
                          )
                        })
                      : (rows as AssiduiteRow[]).map((row) => (
                          <tr key={row.key} className="border-b border-[var(--ds-border)] last:border-0">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-[var(--ds-text)]">{row.label}</p>
                              <p className="mt-0.5 text-[11px] text-[var(--ds-text-subtle)]">
                                {row.alternants} alternant{row.alternants > 1 ? 's' : ''}
                              </p>
                            </td>
                            <TotalsCells row={row} />
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="border-t border-[var(--ds-border)] px-4 py-3 text-[12px] text-[var(--ds-text-subtle)]">
              <IconTraining width={13} height={13} className="mr-1 inline align-[-2px]" />
              Heures calculées sur les horaires de cours (pause déjeuner exclue) : présent = toute la demi-journée,
              en retard = de l’heure d’arrivée à la fin, parti en avance = du début à l’heure de départ.
            </p>
          </Card>
        </>
      )}
    </div>
  )
}

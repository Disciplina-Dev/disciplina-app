import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  IconAlert,
  IconCalendar,
  IconCheckCircle,
  IconDownload,
  IconLoader,
  IconPlus,
  IconQrCode,
  IconRefresh,
  IconSignature,
  IconUsers,
} from '@/components/ui/icons'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import SegmentedControl from '@/components/ui/SegmentedControl'
import SeanceFormModal from '@/components/peda/SeanceFormModal'
import { fetchAttendanceExport, fetchSeances } from '@/api/emargement'
import { toast } from '@/store/toastStore'
import { downloadBlob } from '@/utils/download'
import type { Seance, SeanceValidationStatus } from '@/types/emargement'
import {
  VALIDATION_LABELS,
  VALIDATION_TONES,
  formatSeanceDate,
  seancePlace,
  scheduleSummary,
  windowsSummary,
} from '@/utils/emargement'

type Range = 'upcoming' | 'past' | 'all'
type StatusFilter = 'all' | SeanceValidationStatus

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: 'upcoming', label: 'À venir' },
  { value: 'past', label: 'Passées' },
  { value: 'all', label: 'Toutes' },
]

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Tous statuts' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'to_validate', label: 'À valider' },
  { value: 'anomaly', label: 'Anomalies' },
  { value: 'validated', label: 'Validées' },
]

function localToday(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function yesterday(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export default function Emargements() {
  const navigate = useNavigate()
  const [seances, setSeances] = useState<Seance[]>([])
  const [range, setRange] = useState<Range>('upcoming')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [missingOnly, setMissingOnly] = useState(false)
  const [anomalies, setAnomalies] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [exporting, setExporting] = useState<'csv' | 'xlsx' | null>(null)

  // Compteur d'anomalies indépendant de la période affichée : une feuille en
  // anomalie est toujours passée, elle disparaîtrait du filtre « À venir ».
  useEffect(() => {
    let alive = true
    fetchSeances({ validation: 'anomaly' }).then(
      (rows) => {
        if (alive) setAnomalies(rows.length)
      },
      () => {
        // Le compteur est secondaire : une erreur ici ne doit pas masquer la liste.
      },
    )
    return () => {
      alive = false
    }
  }, [reloadKey])

  useEffect(() => {
    let alive = true
    const today = localToday()
    fetchSeances({
      ...(range === 'upcoming' ? { from: today } : range === 'past' ? { to: yesterday() } : {}),
      ...(status === 'all' ? {} : { validation: status }),
      ...(missingOnly ? { missing: true } : {}),
    }).then(
      (rows) => {
        if (!alive) return
        setSeances(rows)
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
  }, [range, status, missingOnly, reloadKey])

  /** Période affichée : l'export suit le filtre « À venir / Passées / Toutes ». */
  const exportFilter = range === 'upcoming' ? { from: localToday() } : range === 'past' ? { to: yesterday() } : {}

  const runExport = async (format: 'csv' | 'xlsx') => {
    setExporting(format)
    try {
      const { blob, fileName } = await fetchAttendanceExport(exportFilter, format)
      downloadBlob(blob, fileName)
    } catch (err) {
      toast.errorMessage('Export impossible', err instanceof Error ? err.message : undefined)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
      <PageHeader
        eyebrow="Espace pédagogique"
        title="Émargements"
        description="Créez une séance, invitez le formateur par e-mail et laissez les alternants signer par QR code."
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={<IconRefresh width={16} height={16} />}
              onClick={() => setReloadKey((key) => key + 1)}
              disabled={loading}
            >
              Actualiser
            </Button>
            <Button leftIcon={<IconPlus width={16} height={16} />} onClick={() => setShowForm(true)}>
              Nouvelle séance
            </Button>
          </>
        }
      />

      {anomalies > 0 && status !== 'anomaly' && (
        <button
          type="button"
          onClick={() => {
            setLoading(true)
            setStatus('anomaly')
          }}
          className="mb-4 flex w-full items-start gap-2 rounded-[var(--radius-md)] border border-[var(--ds-danger)]/30 bg-[var(--ds-danger-bg)] px-4 py-3 text-left text-sm text-[var(--ds-danger)]"
        >
          <IconAlert width={18} height={18} className="mt-0.5 shrink-0" />
          <span>
            <strong>
              {anomalies} feuille{anomalies > 1 ? 's' : ''} en anomalie
            </strong>{' '}
            : lien formateur expiré et au moins une demi-journée non signée. Cliquez pour les afficher et les
            valider.
          </span>
        </button>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <SegmentedControl
          label="Période"
          options={RANGE_OPTIONS}
          value={range}
          onChange={(next) => {
            setLoading(true)
            setRange(next)
          }}
          size="sm"
        />
        <SegmentedControl
          label="Statut"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(next) => {
            setLoading(true)
            setStatus(next)
          }}
          size="sm"
        />
        <Button
          variant={missingOnly ? 'primary' : 'secondary'}
          size="sm"
          leftIcon={<IconAlert width={15} height={15} />}
          onClick={() => {
            setLoading(true)
            setMissingOnly((current) => !current)
          }}
        >
          Statuts manquants
        </Button>
        {!loading && (
          <span className="text-[13px] text-[var(--ds-text-subtle)]">
            {seances.length} séance{seances.length > 1 ? 's' : ''}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<IconDownload width={15} height={15} />}
            isLoading={exporting === 'csv'}
            disabled={exporting !== null}
            onClick={() => runExport('csv')}
          >
            Présences CSV
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<IconDownload width={15} height={15} />}
            isLoading={exporting === 'xlsx'}
            disabled={exporting !== null}
            onClick={() => runExport('xlsx')}
          >
            Présences Excel
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--ds-danger-bg)] px-4 py-3 text-sm text-[var(--ds-danger)]">
          <IconAlert width={18} height={18} />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[var(--ds-text-subtle)]">
          <IconLoader width={28} height={28} className="animate-spin" />
        </div>
      ) : seances.length === 0 ? (
        <EmptyState
          icon={<IconSignature width={24} height={24} />}
          title="Aucune séance d’émargement"
          description="Créez une séance pour envoyer le lien au formateur : il gérera les présences et fera signer les alternants."
          action={
            <Button leftIcon={<IconPlus width={16} height={16} />} onClick={() => setShowForm(true)}>
              Créer une séance
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {seances.map((seance) => (
            <li key={seance.id}>
              <Link
                to={`/peda/emargements/${seance.id}`}
                className="group flex h-full flex-col gap-4 rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-5 no-underline shadow-[var(--shadow-sm)] transition-all hover:border-[var(--ds-accent)]/40 hover:shadow-[var(--shadow-md)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-[13px] font-semibold text-[var(--ds-text-subtle)]">
                      <IconCalendar width={14} height={14} />
                      {formatSeanceDate(seance.date)}
                    </p>
                    <h2 className="mt-1 truncate text-[17px] font-bold text-[var(--ds-text)] group-hover:text-[var(--ds-accent)]">
                      {seance.sessionNom}
                    </h2>
                    {seance.module && (
                      <p className="mt-0.5 truncate text-[12px] font-medium text-[var(--ds-text-muted)]">{seance.module}</p>
                    )}
                    <p className="mt-0.5 text-[13px] text-[var(--ds-text-subtle)]">
                      {scheduleSummary(seance)} · {seancePlace(seance)}
                    </p>
                  </div>
                  <Badge
                    tone={VALIDATION_TONES[seance.validationStatus]}
                    icon={
                      seance.validationStatus === 'validated' ? (
                        <IconCheckCircle width={12} height={12} />
                      ) : undefined
                    }
                  >
                    {VALIDATION_LABELS[seance.validationStatus]}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[var(--ds-text-muted)]">
                  <span className="inline-flex items-center gap-1.5">
                    <IconUsers width={14} height={14} />
                    {seance.present}/{seance.marked} demi-journée{seance.marked > 1 ? 's' : ''} en présence
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <IconQrCode width={14} height={14} />
                    {windowsSummary(seance)}
                  </span>
                  <span className="truncate">Formateur : {seance.formateurName}</span>
                  {seance.attendanceProgress.missing > 0 && (
                    <Badge tone="warning" icon={<IconAlert width={12} height={12} />}>
                      {seance.attendanceProgress.missing} statut
                      {seance.attendanceProgress.missing > 1 ? 's' : ''} manquant
                      {seance.attendanceProgress.missing > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <SeanceFormModal
          onClose={() => setShowForm(false)}
          onSaved={(seance, inviteSent) => navigate(`/peda/emargements/${seance.id}`, { state: { inviteSent } })}
        />
      )}
    </div>
  )
}

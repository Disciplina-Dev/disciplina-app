import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import {
  IconAlert,
  IconCheck,
  IconCheckCircle,
  IconCopy,
  IconDownload,
  IconLoader,
  IconQrCode,
  IconSignature,
} from '@/components/ui/icons'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import SignaturePad from '@/components/ui/SignaturePad'
import PublicShell from '@/components/emargement/PublicShell'
import {
  EmargementLinkError,
  fetchFormateurView,
  saveAttendance,
  signSheet,
  type AttendancePayload,
} from '@/api/emargement'
import type {
  AlternantAttendance,
  AttendanceRecord,
  EmargementHalf,
  EmargementStatus,
  FormateurView,
  SeanceWindow,
} from '@/types/emargement'
import {
  HALF_LABELS,
  MODE_LABELS,
  STATUS_LABELS,
  STATUS_TONES,
  WINDOW_LABELS,
  WINDOW_TONES,
  formatSeanceDate,
  formatTimestamp,
  signatureLabel,
} from '@/utils/emargement'

const STATUS_OPTIONS: { value: EmargementStatus; label: string }[] = [
  { value: 'na', label: 'Non renseigné' },
  { value: 'present', label: 'Présent' },
  { value: 'absent', label: 'Absent' },
  { value: 'late', label: 'En retard' },
  { value: 'left_early', label: 'Parti en avance' },
]

const NEEDS_TIME: EmargementStatus[] = ['late', 'left_early']

/** Heure locale du navigateur, `HH:mm` — valeur par défaut corrigeable. */
function currentHhMm(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function errorMessage(err: unknown): string {
  if (err instanceof EmargementLinkError) return err.message
  if (err instanceof Error) return err.message
  return 'Action impossible, réessayez.'
}

function WindowRow({ label, window }: { label: string; window: SeanceWindow | null }) {
  if (!window) {
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] text-[var(--ds-text-muted)]">{label}</span>
        <span className="text-[12px] text-[var(--ds-text-subtle)]">Pas de créneau</span>
      </div>
    )
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13px] text-[var(--ds-text-muted)]">
        {label} · {window.start}–{window.end}
      </span>
      <Badge tone={WINDOW_TONES[window.state]}>{WINDOW_LABELS[window.state]}</Badge>
    </div>
  )
}

type CellProps = {
  token: string
  alternant: AlternantAttendance
  half: EmargementHalf
  canEdit: boolean
  disabled?: boolean
  onSaved: (record: AttendanceRecord) => void
  onError: (message: string) => void
}

function AttendanceCell({ token, alternant, half, canEdit, disabled, onSaved, onError }: CellProps) {
  const record = alternant.attendance[half]
  const [status, setStatus] = useState<EmargementStatus>(record?.status ?? 'na')
  const [statusTime, setStatusTime] = useState(record?.statusTime ?? '')
  const [saving, setSaving] = useState(false)

  async function persist(nextStatus: EmargementStatus, nextTime: string | null) {
    const payload: AttendancePayload = {
      alternantId: alternant.id,
      half,
      status: nextStatus,
      statusTime: nextTime,
    }
    setSaving(true)
    try {
      const saved = await saveAttendance(token, payload)
      if (saved) onSaved(saved)
    } catch (err) {
      onError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  function handleStatus(next: EmargementStatus) {
    setStatus(next)
    if (NEEDS_TIME.includes(next)) {
      const time = statusTime || currentHhMm()
      setStatusTime(time)
      void persist(next, time)
      return
    }
    setStatusTime('')
    void persist(next, null)
  }

  function handleTime(next: string) {
    setStatusTime(next)
    if (next) void persist(status, next)
  }

  if (!canEdit) {
    if (!record) {
      return <span className="text-[12px] text-[var(--ds-text-subtle)]">—</span>
    }
    return (
      <div className="flex flex-col gap-1">
        <Badge tone={STATUS_TONES[record.status]}>
          {STATUS_LABELS[record.status]}
          {record.statusTime ? ` · ${record.statusTime}` : ''}
        </Badge>
        <span className="text-[11px] text-[var(--ds-text-subtle)]">
          {signatureLabel(record.signatureMode)} · {formatTimestamp(record.signedAt)}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <select
          value={status}
          onChange={(event) => handleStatus(event.target.value as EmargementStatus)}
          disabled={saving || disabled}
          aria-label={`${HALF_LABELS[half]} — ${alternant.firstName} ${alternant.lastName}`}
          className="w-full rounded-[var(--radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface)] px-2 py-1.5 text-[13px] text-[var(--ds-text)] outline-none focus:border-[var(--ds-accent)] disabled:opacity-60"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {saving && <IconLoader width={14} height={14} className="shrink-0 animate-spin text-[var(--ds-text-subtle)]" />}
      </div>
      {NEEDS_TIME.includes(status) && (
        <input
          type="time"
          value={statusTime}
          onChange={(event) => handleTime(event.target.value)}
          disabled={saving || disabled}
          aria-label={`Heure — ${HALF_LABELS[half]} — ${alternant.firstName} ${alternant.lastName}`}
          className="w-full rounded-[var(--radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface)] px-2 py-1.5 text-[13px] text-[var(--ds-text)] outline-none focus:border-[var(--ds-accent)] disabled:opacity-60"
        />
      )}
      {record && record.firstSignatureMode === 'qr' && (
        <span className="text-[11px] text-[var(--ds-success)]">
          Signé par QR à {formatTimestamp(record.firstSignedAt)}
          {record.signatureMode !== 'qr' ? ' · corrigé par le formateur' : ''}
        </span>
      )}
    </div>
  )
}

export default function FormateurEmargement() {
  const { token = '' } = useParams()
  const [view, setView] = useState<FormateurView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [showQr, setShowQr] = useState(false)
  const [copied, setCopied] = useState(false)
  const [signature, setSignature] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [signing, setSigning] = useState(false)
  const qrRef = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    fetchFormateurView(token).then(
      (next) => {
        setView(next)
        setError(null)
        setLoading(false)
      },
      (err: unknown) => {
        setError(errorMessage(err))
        setLoading(false)
      },
    )
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  function applyRecord(alternantId: string, half: EmargementHalf, record: AttendanceRecord) {
    setView((current) => {
      if (!current) return current
      return {
        ...current,
        alternants: current.alternants.map((alternant) =>
          alternant.id === alternantId
            ? { ...alternant, attendance: { ...alternant.attendance, [half]: record } }
            : alternant,
        ),
      }
    })
  }

  async function copyQr() {
    if (!view) return
    try {
      await navigator.clipboard.writeText(view.seance.qrUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Copie impossible — utilisez le QR code affiché.')
    }
  }

  function downloadQr() {
    const canvas = qrRef.current?.querySelector('canvas')
    if (!canvas) return
    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = 'qr-emargement.png'
    link.click()
  }

  async function handleSign() {
    setSigning(true)
    setError(null)
    try {
      const result = await signSheet(token, signature)
      setNotice(`Feuille signée le ${formatTimestamp(result.signedAt)}. Elle est désormais verrouillée.`)
      setSignature('')
      setConfirmed(false)
      load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSigning(false)
    }
  }

  if (loading) {
    return (
      <PublicShell>
        <div className="flex items-center justify-center py-24 text-[var(--ds-text-subtle)]">
          <IconLoader width={28} height={28} className="animate-spin" />
        </div>
      </PublicShell>
    )
  }

  if (!view) {
    return (
      <PublicShell width="narrow">
        <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
          <IconAlert width={32} height={32} className="text-[var(--ds-danger)]" />
          <h1 className="text-lg font-bold text-[var(--ds-text)]">Lien indisponible</h1>
          <p className="text-[13px] text-[var(--ds-text-subtle)]">{error ?? 'Ce lien n’est plus valable.'}</p>
        </div>
      </PublicShell>
    )
  }

  const { seance } = view
  const hasAfternoon = Boolean(view.windows.afternoon)
  const editable = view.canEdit

  return (
    <PublicShell>
      <header className="border-b border-[var(--ds-border)] px-5 py-6 sm:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ds-text-subtle)]">
          Feuille d’émargement
        </p>
        <h1 className="mt-1 text-[24px] font-extrabold leading-tight text-[var(--ds-text)]">{seance.sessionNom}</h1>
        <p className="mt-1 text-[13px] text-[var(--ds-text-subtle)]">
          {formatSeanceDate(seance.date)} · {seance.startTime}–{seance.endTime} · {seance.site} ·{' '}
          {MODE_LABELS[seance.mode]}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone="accent">Formateur : {seance.formateurName}</Badge>
          {seance.signed ? (
            <Badge tone="success" icon={<IconCheckCircle width={12} height={12} />}>
              Signée le {formatTimestamp(seance.signedAt)}
            </Badge>
          ) : view.expired ? (
            <Badge tone="neutral">Lien expiré</Badge>
          ) : (
            <Badge tone="warning">En attente de votre signature</Badge>
          )}
        </div>
      </header>

      {notice && (
        <div className="mx-5 mt-4 flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--ds-success-bg)] px-4 py-3 text-[13px] text-[var(--ds-success)] sm:mx-8">
          <IconCheck width={16} height={16} /> {notice}
        </div>
      )}
      {error && (
        <div className="mx-5 mt-4 flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--ds-danger-bg)] px-4 py-3 text-[13px] text-[var(--ds-danger)] sm:mx-8">
          <IconAlert width={16} height={16} /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 px-5 py-6 sm:px-8 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--ds-border)]">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[var(--ds-surface-sunken)] text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-subtle)]">
                  <th className="px-3 py-3">Alternant</th>
                  <th className="px-3 py-3">{HALF_LABELS.morning}</th>
                  <th className="px-3 py-3">{hasAfternoon ? HALF_LABELS.afternoon : `${HALF_LABELS.afternoon} (—)`}</th>
                </tr>
              </thead>
              <tbody>
                {view.alternants.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-8 text-center text-[13px] text-[var(--ds-text-subtle)]">
                      Aucun alternant dans cette session.
                    </td>
                  </tr>
                )}
                {view.alternants.map((alternant) => (
                  <tr key={alternant.id} className="border-t border-[var(--ds-border)] align-top">
                    <td className="px-3 py-3 text-[14px] font-semibold text-[var(--ds-text)]">
                      {alternant.firstName} {alternant.lastName}
                    </td>
                    <td className="px-3 py-3">
                      <AttendanceCell
                        key={`${alternant.id}-morning-${alternant.attendance.morning?.signedAt ?? 'vide'}`}
                        token={token}
                        alternant={alternant}
                        half="morning"
                        canEdit={editable}
                        onSaved={(record) => applyRecord(alternant.id, 'morning', record)}
                        onError={setError}
                      />
                    </td>
                    <td className="px-3 py-3">
                      {hasAfternoon ? (
                        <AttendanceCell
                          key={`${alternant.id}-afternoon-${alternant.attendance.afternoon?.signedAt ?? 'vide'}`}
                          token={token}
                          alternant={alternant}
                          half="afternoon"
                          canEdit={editable}
                          onSaved={(record) => applyRecord(alternant.id, 'afternoon', record)}
                          onError={setError}
                        />
                      ) : (
                        <span className="text-[12px] text-[var(--ds-text-subtle)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!editable && !seance.signed && (
            <p className="mt-3 text-[12px] text-[var(--ds-text-subtle)]">
              Ce lien a expiré : la feuille est en lecture seule. Contactez le service pédagogique pour une
              correction.
            </p>
          )}
        </section>

        <aside className="flex flex-col gap-5">
          <section className="rounded-[var(--radius-lg)] border border-[var(--ds-border)] p-4">
            <h2 className="flex items-center gap-2 text-[14px] font-bold text-[var(--ds-text)]">
              <IconQrCode width={16} height={16} className="text-[var(--ds-accent)]" />
              Signature des alternants
            </h2>
            <p className="mt-1 text-[12px] text-[var(--ds-text-subtle)]">
              Affichez ce QR code : chaque alternant confirme sa présence avec son e-mail pendant la fenêtre
              ouverte.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => setShowQr((current) => !current)}
              leftIcon={<IconQrCode width={14} height={14} />}
            >
              {showQr ? 'Masquer le QR code' : 'Afficher le QR code'}
            </Button>
            {showQr && (
              <div className="mt-3 flex flex-col items-center gap-3">
                <div ref={qrRef} className="rounded-[var(--radius-md)] border border-[var(--ds-border)] bg-white p-2">
                  <QRCodeCanvas value={seance.qrUrl} size={190} includeMargin={false} />
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={copied ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
                    onClick={copyQr}
                  >
                    {copied ? 'Copié !' : 'Copier le lien'}
                  </Button>
                  <Button variant="secondary" size="sm" leftIcon={<IconDownload width={14} height={14} />} onClick={downloadQr}>
                    PNG
                  </Button>
                </div>
              </div>
            )}
            <div className="mt-4 space-y-2 border-t border-[var(--ds-border)] pt-3">
              <WindowRow label={HALF_LABELS.morning} window={view.windows.morning} />
              <WindowRow label={HALF_LABELS.afternoon} window={view.windows.afternoon} />
            </div>
          </section>

          <section className="rounded-[var(--radius-lg)] border border-[var(--ds-border)] p-4">
            <h2 className="flex items-center gap-2 text-[14px] font-bold text-[var(--ds-text)]">
              <IconSignature width={16} height={16} className="text-[var(--ds-accent)]" />
              Signature de la feuille
            </h2>
            {seance.signed ? (
              <div className="mt-2 space-y-2">
                <p className="text-[13px] text-[var(--ds-text-muted)]">
                  Signée par {seance.signedByName} le {formatTimestamp(seance.signedAt)}.
                </p>
                {seance.signatureImage && (
                  <img
                    src={seance.signatureImage}
                    alt={`Signature de ${seance.signedByName ?? 'le formateur'}`}
                    className="h-28 w-full rounded-[var(--radius-md)] border border-[var(--ds-border)] bg-white object-contain p-2"
                  />
                )}
              </div>
            ) : view.expired ? (
              <p className="mt-2 text-[13px] text-[var(--ds-text-subtle)]">
                Le lien a expiré avant signature. Contactez le service pédagogique.
              </p>
            ) : (
              <div className="mt-2 space-y-3">
                <SignaturePad value={signature} onChange={setSignature} label="Signature du formateur" />
                <label className="flex items-start gap-2 text-[12px] text-[var(--ds-text-muted)]">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-[var(--ds-border)] text-[var(--ds-accent)]"
                  />
                  Je certifie l’exactitude des présences ci-dessus et je signe la feuille d’émargement.
                </label>
                <Button
                  className="w-full"
                  onClick={handleSign}
                  isLoading={signing}
                  disabled={!signature || !confirmed}
                >
                  Confirmer et signer
                </Button>
              </div>
            )}
          </section>
        </aside>
      </div>
    </PublicShell>
  )
}

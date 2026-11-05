import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import {
  IconAlert,
  IconArrowLeft,
  IconCheck,
  IconCheckCircle,
  IconCopy,
  IconDownload,
  IconEdit,
  IconHistory,
  IconLoader,
  IconMail,
  IconQrCode,
  IconRefresh,
  IconSignature,
  IconTrash,
  IconUser,
} from '@/components/ui/icons'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Select from '@/components/ui/Select'
import SeanceFormModal from '@/components/peda/SeanceFormModal'
import {
  deleteSeance,
  fetchAttendanceExport,
  fetchAttestation,
  fetchGroupSummary,
  fetchHistoryExport,
  fetchSeance,
  fetchSeancePdf,
  resendInvite,
  validateSeance,
} from '@/api/emargement'
import { zonedWallClockToIso } from '@/lib/timezone'
import { toast } from '@/store/toastStore'
import { downloadBlob } from '@/utils/download'
import { EMARGEMENT_PDF_THEMES, PDF_THEME_LABELS } from '@/types/emargement'
import type { AlternantAttendance, AttendanceRecord, EmargementPdfTheme, SeanceDetail } from '@/types/emargement'
import {
  HALF_LABELS,
  HISTORY_ACTION_LABELS,
  HISTORY_ACTION_TONES,
  STATUS_LABELS,
  STATUS_TONES,
  VALIDATION_LABELS,
  VALIDATION_TONES,
  WINDOW_LABELS,
  WINDOW_TONES,
  formatSeanceDate,
  formatTimestamp,
  historySummary,
  presenceLabel,
  presenceTone,
  scheduleSummary,
  seancePlace,
  seanceProgram,
  signatureLabel,
  validationSourceLabel,
} from '@/utils/emargement'

/** Affiché quand le back signale que l'invitation n'a pas pu partir. */
const INVITE_NOT_SENT =
  'L’e-mail d’invitation n’a pas pu être envoyé : aucune boîte Google connectée côté serveur. Transmettez le lien formateur ci-dessous.'

function AttendanceCell({ record }: { record: AttendanceRecord | null }) {
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
      {record.firstSignatureMode === 'qr' && record.signatureMode !== 'qr' && (
        <span className="text-[11px] text-[var(--ds-text-subtle)]">
          QR du {formatTimestamp(record.firstSignedAt)}
        </span>
      )}
      {record.signatureImage && (
        <img
          src={record.signatureImage}
          alt="Signature manuscrite de l’alternant"
          className="h-12 w-28 rounded-[var(--radius-sm)] border border-[var(--ds-border)] bg-white object-contain"
        />
      )}
    </div>
  )
}

function AlternantRow({ alternant, hasAfternoon }: { alternant: AlternantAttendance; hasAfternoon: boolean }) {
  const presence = presenceLabel(alternant.presence)
  return (
    <tr className="border-t border-[var(--ds-border)]">
      <td className="px-4 py-3 align-top">
        <p className="text-[14px] font-semibold text-[var(--ds-text)]">
          {alternant.firstName} {alternant.lastName}
        </p>
        {alternant.email && <p className="text-[12px] text-[var(--ds-text-subtle)]">{alternant.email}</p>}
        {alternant.financeur && (
          <p className="text-[11px] text-[var(--ds-text-subtle)]">Financeur : {alternant.financeur}</p>
        )}
        {presence && (
          <p className="mt-1">
            <Badge tone={presenceTone(alternant.presence)}>{presence}</Badge>
          </p>
        )}
      </td>
      <td className="px-4 py-3 align-top">
        <AttendanceCell record={alternant.attendance.morning} />
      </td>
      <td className="px-4 py-3 align-top">
        {hasAfternoon ? (
          <AttendanceCell record={alternant.attendance.afternoon} />
        ) : (
          <span className="text-[12px] text-[var(--ds-text-subtle)]">—</span>
        )}
      </td>
    </tr>
  )
}

export default function EmargementSeance() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [seance, setSeance] = useState<SeanceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(() =>
    (location.state as { inviteSent?: boolean } | null)?.inviteSent === false ? INVITE_NOT_SENT : null,
  )
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [validating, setValidating] = useState(false)
  const [validationNote, setValidationNote] = useState('')
  const [copied, setCopied] = useState<'formateur' | 'qr' | null>(null)
  const [theme, setTheme] = useState<EmargementPdfTheme>('disciplina')
  const [exporting, setExporting] = useState<string | null>(null)
  const [attestationId, setAttestationId] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const qrRef = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    fetchSeance(id).then(
      (detail) => {
        setSeance(detail)
        setError(null)
        setLoading(false)
      },
      (err: unknown) => {
        setError(err instanceof Error ? err.message : 'Chargement impossible')
        setLoading(false)
      },
    )
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const flash = (message: string) => {
    setNotice(message)
    setTimeout(() => setNotice((current) => (current === message ? null : current)), 3000)
  }

  async function copyLink(kind: 'formateur' | 'qr', url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(kind)
      setTimeout(() => setCopied((current) => (current === kind ? null : current)), 2000)
    } catch {
      setError('Copie impossible — sélectionnez le lien manuellement.')
    }
  }

  function downloadQr() {
    const canvas = qrRef.current?.querySelector('canvas')
    if (!canvas || !seance) return
    const name = `emargement-${seance.sessionNom.replace(/[^\p{L}\p{N}]+/gu, '_')}-${seance.date}.png`
    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = name
    link.click()
  }

  async function handleResend(rotate: boolean) {
    if (rotate && !window.confirm('Régénérer les liens ? Les liens déjà envoyés cesseront de fonctionner.')) return
    setBusy(true)
    setError(null)
    try {
      const { inviteSent } = await resendInvite(id, rotate)
      load()
      if (inviteSent) {
        setWarning(null)
        flash(rotate ? 'Nouveaux liens générés, invitation renvoyée.' : 'Invitation renvoyée au formateur.')
      } else {
        setWarning(INVITE_NOT_SENT)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Envoi impossible')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!seance) return
    const message = locked
      ? `Cette feuille est validée : la suppression effacera définitivement les statuts, les signatures et le journal. Supprimer la séance du ${formatSeanceDate(seance.date)} ?`
      : `Supprimer la séance du ${formatSeanceDate(seance.date)} ? La feuille sera perdue.`
    if (!window.confirm(message)) return
    setBusy(true)
    try {
      await deleteSeance(id)
      navigate('/peda/emargements', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suppression impossible')
      setBusy(false)
    }
  }

  async function handleValidate() {
    const note = validationNote.trim()
    if (!note) return
    setBusy(true)
    setError(null)
    try {
      const detail = await validateSeance(id, note)
      setSeance(detail)
      setValidating(false)
      setValidationNote('')
      flash('Feuille validée par le service pédagogique.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation impossible')
    } finally {
      setBusy(false)
    }
  }

  /** Téléchargement d'un export : un seul à la fois, erreur remontée en toast. */
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-[var(--ds-text-subtle)]">
        <IconLoader width={28} height={28} className="animate-spin" />
      </div>
    )
  }

  if (!seance) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <div className="flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--ds-danger-bg)] px-4 py-3 text-sm text-[var(--ds-danger)]">
          <IconAlert width={18} height={18} />
          {error ?? 'Séance introuvable'}
        </div>
        <Button variant="ghost" className="mt-4" leftIcon={<IconArrowLeft width={16} height={16} />} onClick={() => navigate('/peda/emargements')}>
          Retour aux émargements
        </Button>
      </div>
    )
  }

  const hasAfternoon = Boolean(seance.afternoonStart)
  const program = seanceProgram(seance)
  const locked = Boolean(seance.validations.morning || seance.validations.afternoon)
  const missingHalves = (['morning', 'afternoon'] as const).filter(
    (half) => (half === 'morning' || hasAfternoon) && !seance.validations[half],
  )
  const missingHalvesLabel = missingHalves.map((half) => HALF_LABELS[half].toLowerCase()).join(' et ')

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
      <Link
        to="/peda/emargements"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--ds-text-subtle)] no-underline hover:text-[var(--ds-text)]"
      >
        <IconArrowLeft width={15} height={15} /> Émargements
      </Link>

      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ds-text-subtle)]">
            {formatSeanceDate(seance.date)}
          </p>
          <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--ds-text)]">
            {seance.sessionNom}
          </h1>
          {program && <p className="mt-1 text-[14px] font-semibold text-[var(--ds-text-muted)]">{program}</p>}
          <p className="mt-1 text-[13px] text-[var(--ds-text-subtle)]">
            {scheduleSummary(seance)} · {seancePlace(seance)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            tone={VALIDATION_TONES[seance.validationStatus]}
            icon={
              seance.validationStatus === 'validated' ? <IconCheckCircle width={12} height={12} /> : undefined
            }
          >
            {VALIDATION_LABELS[seance.validationStatus]}
          </Badge>
          {seance.canValidateByPeda && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<IconSignature width={15} height={15} />}
              onClick={() => setValidating(true)}
              disabled={busy}
            >
              Valider la feuille
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<IconEdit width={15} height={15} />}
            onClick={() => setEditing(true)}
            disabled={locked || busy}
          >
            Modifier
          </Button>
          <Button
            variant="danger"
            size="sm"
            leftIcon={<IconTrash width={15} height={15} />}
            onClick={handleDelete}
            disabled={busy}
          >
            Supprimer
          </Button>
        </div>
      </header>

      {notice && (
        <div className="mb-4 flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--ds-success-bg)] px-4 py-3 text-sm text-[var(--ds-success)]">
          <IconCheck width={16} height={16} /> {notice}
        </div>
      )}
      {warning && (
        <div className="mb-4 flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--ds-warning-bg)] px-4 py-3 text-sm text-[var(--ds-warning)]">
          <IconAlert width={16} height={16} /> {warning}
        </div>
      )}
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--ds-danger-bg)] px-4 py-3 text-sm text-[var(--ds-danger)]">
          <IconAlert width={16} height={16} /> {error}
        </div>
      )}

      {seance.validationStatus === 'anomaly' && (
        <div className="mb-4 flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--ds-danger)]/30 bg-[var(--ds-danger-bg)] px-4 py-3 text-sm text-[var(--ds-danger)] sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2">
            <IconAlert width={16} height={16} className="mt-0.5 shrink-0" />
            <span>
              <strong>Anomalie : lien formateur expiré</strong> le {formatTimestamp(seance.inviteExpiresAt)} et{' '}
              {missingHalvesLabel} non signé{missingHalves.length > 1 ? 's' : ''}. Le formateur ne peut plus signer :
              validez la feuille pour la clôturer.
            </span>
          </p>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<IconSignature width={15} height={15} />}
            onClick={() => setValidating(true)}
            disabled={busy}
          >
            Valider la feuille
          </Button>
        </div>
      )}

      {seance.validationStatus === 'to_validate' && (
        <div className="mb-4 flex flex-col gap-3 rounded-[var(--radius-md)] bg-[var(--ds-warning-bg)] px-4 py-3 text-sm text-[var(--ds-warning)] sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2">
            <IconAlert width={16} height={16} className="mt-0.5 shrink-0" />
            <span>
              Les créneaux sont fermés, {missingHalvesLabel} {missingHalves.length > 1 ? 'restent' : 'reste'} à
              signer. Le lien formateur est valable jusqu’au {formatTimestamp(seance.inviteExpiresAt)} ; passé ce
              délai la feuille passera en anomalie.
            </span>
          </p>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<IconSignature width={15} height={15} />}
            onClick={() => setValidating(true)}
            disabled={busy}
          >
            Valider à sa place
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Card padding="none">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--ds-border)] px-5 py-4">
              <h2 className="flex items-center gap-2 text-[15px] font-bold text-[var(--ds-text)]">
                <IconUser width={16} height={16} className="text-[var(--ds-accent)]" />
                Alternants ({seance.alternants.length})
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                {seance.attendanceProgress.missing > 0 && (
                  <Badge tone="warning" icon={<IconAlert width={12} height={12} />}>
                    {seance.attendanceProgress.missing} statut
                    {seance.attendanceProgress.missing > 1 ? 's' : ''} manquant
                    {seance.attendanceProgress.missing > 1 ? 's' : ''}
                  </Badge>
                )}
                <span className="text-[12px] text-[var(--ds-text-subtle)]">
                  {seance.present}/{seance.marked} demi-journée(s) en présence
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-subtle)]">
                    <th className="px-4 py-3">Alternant</th>
                    <th className="px-4 py-3">Matin</th>
                    <th className="px-4 py-3">{hasAfternoon ? 'Après-midi' : 'Après-midi (—)'}</th>
                  </tr>
                </thead>
                <tbody>
                  {seance.alternants.map((alternant) => (
                    <AlternantRow key={alternant.id} alternant={alternant} hasAfternoon={hasAfternoon} />
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-[var(--ds-border)] px-5 py-3 text-[12px] text-[var(--ds-text-subtle)]">
              Les statuts sont saisis par le formateur, ou par l’alternant lui-même en scannant le QR code pendant la
              fenêtre de signature ({HALF_LABELS.morning} {seance.morningStart}–{seance.morningEnd}
              {hasAfternoon ? `, ${HALF_LABELS.afternoon} ${seance.afternoonStart}–${seance.afternoonEnd}` : ''}).
            </p>
          </Card>

          <Card>
            <h2 className="flex items-center gap-2 text-[15px] font-bold text-[var(--ds-text)]">
              <IconSignature width={16} height={16} className="text-[var(--ds-accent)]" />
              Validation de la feuille
            </h2>
            <p className="mt-1 text-[12px] text-[var(--ds-text-subtle)]">
              {validationSourceLabel(seance.validationSource)} · chaque demi-journée se signe après la fermeture de
              son créneau.
            </p>
            <ul className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(['morning', 'afternoon'] as const)
                .filter((half) => half === 'morning' || hasAfternoon)
                .map((half) => {
                  const validation = seance.validations[half]
                  return (
                    <li
                      key={half}
                      className="rounded-[var(--radius-md)] border border-[var(--ds-border)] px-3 py-3"
                    >
                      <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ds-text-subtle)]">
                        {HALF_LABELS[half]}
                      </p>
                      {validation ? (
                        <>
                          <p className="mt-1 text-[13px] text-[var(--ds-text)]">{validation.signedByName}</p>
                          <p className="text-[11px] text-[var(--ds-text-subtle)]">
                            {validation.source === 'peda'
                              ? 'Validée par le service pédagogique'
                              : 'Signée par le formateur'}{' '}
                            · {formatTimestamp(validation.signedAt)}
                          </p>
                          {validation.signatureImage && (
                            <img
                              src={validation.signatureImage}
                              alt={`Signature du formateur — ${HALF_LABELS[half]}`}
                              className="mt-2 h-20 w-full rounded-[var(--radius-sm)] border border-[var(--ds-border)] bg-white object-contain p-1"
                            />
                          )}
                        </>
                      ) : (
                        <p className="mt-1 text-[13px] text-[var(--ds-text-subtle)]">Non signée</p>
                      )}
                    </li>
                  )
                })}
            </ul>
            {seance.validationNote && (
              <p className="mt-3 rounded-[var(--radius-md)] bg-[var(--ds-surface-sunken)] px-3 py-2 text-[12px] text-[var(--ds-text-muted)]">
                <strong>Motif de validation :</strong> {seance.validationNote}
              </p>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <h2 className="text-[15px] font-bold text-[var(--ds-text)]">Formateur</h2>
            <p className="mt-1 text-[14px] font-semibold text-[var(--ds-text)]">{seance.formateurName}</p>
            <a
              href={`mailto:${seance.formateurEmail}`}
              className="text-[13px] text-[var(--ds-text-muted)] hover:underline"
            >
              {seance.formateurEmail}
            </a>
            {seance.formateurId && (
              <Link
                to={`/peda/formateurs/${seance.formateurId}`}
                className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--ds-accent)] no-underline hover:underline"
              >
                <IconUser width={13} height={13} />
                Voir la fiche formateur
              </Link>
            )}
            <div className="mt-4 flex flex-col gap-2">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<IconMail width={15} height={15} />}
                onClick={() => handleResend(false)}
                isLoading={busy}
              >
                Renvoyer l’invitation
              </Button>
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<IconRefresh width={15} height={15} />}
                onClick={() => handleResend(true)}
                disabled={busy}
              >
                Régénérer les liens
              </Button>
            </div>
            <p className="mt-3 text-[12px] text-[var(--ds-text-subtle)]">
              Lien valable jusqu’au {formatTimestamp(seance.inviteExpiresAt)}.
            </p>
          </Card>

          <Card>
            <h2 className="flex items-center gap-2 text-[15px] font-bold text-[var(--ds-text)]">
              <IconQrCode width={16} height={16} className="text-[var(--ds-accent)]" />
              QR code alternants
            </h2>
            <div className="mt-3 flex flex-col items-center gap-3">
              <div ref={qrRef} className="rounded-[var(--radius-md)] border border-[var(--ds-border)] bg-white p-2">
                <QRCodeCanvas value={seance.qrUrl} size={168} includeMargin={false} />
              </div>
              <p className="text-center text-[12px] text-[var(--ds-text-subtle)]">
                À projeter ou afficher en salle pendant les fenêtres de signature.
              </p>
              <div className="flex w-full flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={copied === 'qr' ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
                  onClick={() => copyLink('qr', seance.qrUrl)}
                >
                  {copied === 'qr' ? 'Copié !' : 'Copier'}
                </Button>
                <Button variant="secondary" size="sm" leftIcon={<IconDownload width={14} height={14} />} onClick={downloadQr}>
                  PNG
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-[15px] font-bold text-[var(--ds-text)]">Fenêtres de signature</h2>
            <ul className="mt-3 space-y-3">
              <li className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-[var(--ds-text-muted)]">
                  Matin · {seance.morningStart}–{seance.morningEnd}
                </span>
                <Badge tone={WINDOW_TONES[windowStateFor(seance, 'morning')]}>
                  {WINDOW_LABELS[windowStateFor(seance, 'morning')]}
                </Badge>
              </li>
              {hasAfternoon && (
                <li className="flex items-center justify-between gap-3">
                  <span className="text-[13px] text-[var(--ds-text-muted)]">
                    Après-midi · {seance.afternoonStart}–{seance.afternoonEnd}
                  </span>
                  <Badge tone={WINDOW_TONES[windowStateFor(seance, 'afternoon')]}>
                    {WINDOW_LABELS[windowStateFor(seance, 'afternoon')]}
                  </Badge>
                </li>
              )}
            </ul>
            <div className="mt-4 border-t border-[var(--ds-border)] pt-3">
              <p className="text-[12px] font-semibold text-[var(--ds-text-muted)]">Lien formateur</p>
              <p className="mt-1 break-all text-[11px] text-[var(--ds-text-subtle)]">{seance.formateurUrl}</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                leftIcon={copied === 'formateur' ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
                onClick={() => copyLink('formateur', seance.formateurUrl)}
              >
                {copied === 'formateur' ? 'Copié !' : 'Copier le lien formateur'}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-5">
        <h2 className="flex flex-wrap items-center gap-2 text-[15px] font-bold text-[var(--ds-text)]">
          <IconDownload width={16} height={16} className="text-[var(--ds-accent)]" />
          Exports
        </h2>
        <p className="mt-1 text-[12px] text-[var(--ds-text-subtle)]">
          Feuille de séance et attestation en PDF, présences et heures en CSV / Excel, journal d’audit en CSV. La
          charte choisie s’applique aux PDF.
        </p>

        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div>
            <p className="text-[12px] font-semibold text-[var(--ds-text-muted)]">Documents PDF</p>
            <div className="mt-1.5 max-w-[240px]">
              <Select
                label="Charte"
                options={EMARGEMENT_PDF_THEMES.map((value) => ({ value, label: PDF_THEME_LABELS[value] }))}
                value={theme}
                onChange={setTheme}
                size="sm"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<IconDownload width={15} height={15} />}
                isLoading={exporting === 'sheet'}
                disabled={exporting !== null}
                onClick={() => runExport('sheet', () => fetchSeancePdf(seance.id, theme))}
              >
                Feuille d’émargement
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<IconDownload width={15} height={15} />}
                isLoading={exporting === 'group'}
                disabled={exporting !== null}
                onClick={() => runExport('group', () => fetchGroupSummary(seance.sessionId, { theme }))}
              >
                Récapitulatif du groupe
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-2">
              <div className="min-w-[200px] flex-1">
                <Select
                  label="Attestation d’assiduité"
                  options={seance.alternants.map((alternant) => ({
                    value: alternant.id,
                    label: `${alternant.firstName} ${alternant.lastName}`,
                  }))}
                  value={attestationId}
                  onChange={setAttestationId}
                  size="sm"
                  placeholder="Choisir un alternant…"
                  disabled={seance.alternants.length === 0}
                />
              </div>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<IconDownload width={15} height={15} />}
                isLoading={exporting === 'attestation'}
                disabled={!attestationId || exporting !== null}
                onClick={() => runExport('attestation', () => fetchAttestation(attestationId, { theme }))}
              >
                Attestation PDF
              </Button>
            </div>
          </div>

          <div>
            <p className="text-[12px] font-semibold text-[var(--ds-text-muted)]">Tableurs et journal</p>
            <p className="mt-1 text-[11px] text-[var(--ds-text-subtle)]">
              Une ligne par alternant et par demi-journée, heures prévues / réalisées calculées sur les créneaux de
              signature.
            </p>
            <label className="mt-2 flex cursor-pointer items-start gap-2 text-[12px] text-[var(--ds-text-muted)]">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(event) => setIncludeArchived(event.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 accent-[var(--ds-accent)]"
              />
              <span>
                Inclure les alternants sortis de la formation
                <span className="block text-[11px] text-[var(--ds-text-subtle)]">
                  Utile pour un export historique : par défaut, un sorti ne figure que sur les séances où il était
                  encore présent.
                </span>
              </span>
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<IconDownload width={15} height={15} />}
                isLoading={exporting === 'csv'}
                disabled={exporting !== null}
                onClick={() =>
                  runExport('csv', () =>
                    fetchAttendanceExport({ seanceId: seance.id, includeArchived }, 'csv'),
                  )
                }
              >
                Présences CSV
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<IconDownload width={15} height={15} />}
                isLoading={exporting === 'xlsx'}
                disabled={exporting !== null}
                onClick={() =>
                  runExport('xlsx', () =>
                    fetchAttendanceExport({ seanceId: seance.id, includeArchived }, 'xlsx'),
                  )
                }
              >
                Présences Excel
              </Button>
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<IconDownload width={15} height={15} />}
                isLoading={exporting === 'history'}
                disabled={exporting !== null}
                onClick={() => runExport('history', () => fetchHistoryExport({ seanceId: seance.id }))}
              >
                Journal CSV
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="mt-5">
        <h2 className="flex flex-wrap items-center gap-2 text-[15px] font-bold text-[var(--ds-text)]">
          <IconHistory width={16} height={16} className="text-[var(--ds-accent)]" />
          Historique
          <span className="text-[12px] font-normal text-[var(--ds-text-subtle)]">
            {seance.history.length} événement{seance.history.length > 1 ? 's' : ''}
          </span>
        </h2>
        <p className="mt-1 text-[12px] text-[var(--ds-text-subtle)]">
          Journal des changements de statut, signatures et validations. Les entrées ne peuvent pas être modifiées.
        </p>
        {seance.history.length === 0 ? (
          <p className="mt-3 text-[13px] text-[var(--ds-text-subtle)]">Aucun changement enregistré.</p>
        ) : (
          <ol className="mt-3 max-h-[360px] divide-y divide-[var(--ds-border)] overflow-y-auto">
            {seance.history.map((entry) => (
              <li key={entry.id} className="flex gap-3 py-2.5">
                <span className="w-[104px] shrink-0 text-[11px] text-[var(--ds-text-subtle)]">
                  {formatTimestamp(entry.at)}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] text-[var(--ds-text)]">{historySummary(entry)}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--ds-text-subtle)]">
                    <Badge tone={HISTORY_ACTION_TONES[entry.action]}>{HISTORY_ACTION_LABELS[entry.action]}</Badge>
                    {entry.actorName && <span>· {entry.actorName}</span>}
                    {entry.note && <span>· Motif : {entry.note}</span>}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {validating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[var(--ds-text)]/50 backdrop-blur-sm" onClick={() => setValidating(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="validation-modal-title"
            className="relative w-full max-w-md rounded-2xl bg-[var(--ds-surface)] p-5 shadow-2xl"
          >
            <h2 id="validation-modal-title" className="text-[16px] font-bold text-[var(--ds-text)]">
              Valider la feuille
            </h2>
            <p className="mt-1 text-[13px] text-[var(--ds-text-subtle)]">
              {missingHalvesLabel || 'La demi-journée restante'} : validation par le service pédagogique, sans
              signature du formateur. Le motif est conservé avec la feuille et visible dans son détail.
            </p>
            <label
              htmlFor="validation-note"
              className="mt-4 block text-[13px] font-semibold text-[var(--ds-text-muted)]"
            >
              Motif de la validation
            </label>
            <textarea
              id="validation-note"
              value={validationNote}
              onChange={(event) => setValidationNote(event.target.value)}
              rows={3}
              maxLength={500}
              required
              placeholder="Formateur injoignable, lien expiré, signature manquante…"
              className="mt-1.5 w-full resize-y rounded-[var(--radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 py-2 text-[13px] text-[var(--ds-text)] outline-none focus:border-[var(--ds-accent)]"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setValidating(false)} disabled={busy}>
                Annuler
              </Button>
              <Button onClick={handleValidate} isLoading={busy} disabled={!validationNote.trim()}>
                Valider la feuille
              </Button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <SeanceFormModal
          seance={seance}
          onClose={() => setEditing(false)}
          onSaved={() => load()}
        />
      )}
    </div>
  )
}

/**
 * État de la fenêtre côté navigateur : le serveur fait foi au moment de la
 * signature, ceci n'est qu'un repère visuel pour le Peda. Les horaires sont
 * muraux et interprétés dans le fuseau figé de la séance — les lire avec
 * l'horloge du navigateur décalerait un poste hors du fuseau du tenant.
 */
function windowStateFor(seance: SeanceDetail, half: 'morning' | 'afternoon'): 'upcoming' | 'open' | 'closed' {
  const start = half === 'morning' ? seance.morningStart : seance.afternoonStart
  const end = half === 'morning' ? seance.morningEnd : seance.afternoonEnd
  if (!start || !end) return 'closed'
  const startAt = new Date(zonedWallClockToIso(`${seance.date}T${start}`, seance.timezone))
  const endAt = new Date(zonedWallClockToIso(`${seance.date}T${end}`, seance.timezone))
  const now = new Date()
  if (now < startAt) return 'upcoming'
  if (now > endAt) return 'closed'
  return 'open'
}

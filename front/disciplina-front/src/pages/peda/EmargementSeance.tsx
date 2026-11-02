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
import SeanceFormModal from '@/components/peda/SeanceFormModal'
import { deleteSeance, fetchSeance, resendInvite } from '@/api/emargement'
import { zonedWallClockToIso } from '@/lib/timezone'
import type { AlternantAttendance, AttendanceRecord, SeanceDetail } from '@/types/emargement'
import {
  HALF_LABELS,
  STATUS_LABELS,
  STATUS_TONES,
  WINDOW_LABELS,
  WINDOW_TONES,
  formatSeanceDate,
  formatTimestamp,
  seancePlace,
  seanceProgram,
  signatureLabel,
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
  const [copied, setCopied] = useState<'formateur' | 'qr' | null>(null)
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
    if (!window.confirm(`Supprimer la séance du ${formatSeanceDate(seance.date)} ? La feuille sera perdue.`)) return
    setBusy(true)
    try {
      await deleteSeance(id)
      navigate('/peda/emargements', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suppression impossible')
      setBusy(false)
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
            {seance.startTime} – {seance.endTime} · {seancePlace(seance)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {seance.signed ? (
            <Badge tone="success" icon={<IconCheckCircle width={12} height={12} />}>
              Feuille signée
            </Badge>
          ) : (
            <Badge tone="accent">En attente de signature</Badge>
          )}
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<IconEdit width={15} height={15} />}
            onClick={() => setEditing(true)}
            disabled={seance.signed || busy}
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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Card padding="none">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--ds-border)] px-5 py-4">
              <h2 className="flex items-center gap-2 text-[15px] font-bold text-[var(--ds-text)]">
                <IconUser width={16} height={16} className="text-[var(--ds-accent)]" />
                Alternants ({seance.alternants.length})
              </h2>
              <span className="text-[12px] text-[var(--ds-text-subtle)]">
                {seance.present}/{seance.marked} demi-journée(s) en présence
              </span>
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

          {seance.signed && (
            <Card>
              <h2 className="flex items-center gap-2 text-[15px] font-bold text-[var(--ds-text)]">
                <IconSignature width={16} height={16} className="text-[var(--ds-accent)]" />
                Signature du formateur
              </h2>
              <p className="mt-1 text-[13px] text-[var(--ds-text-subtle)]">
                {seance.signedByName} · {formatTimestamp(seance.signedAt)}
              </p>
              {seance.signatureImage && (
                <img
                  src={seance.signatureImage}
                  alt={`Signature de ${seance.signedByName ?? 'le formateur'}`}
                  className="mt-3 h-28 rounded-[var(--radius-md)] border border-[var(--ds-border)] bg-white object-contain p-2"
                />
              )}
            </Card>
          )}
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

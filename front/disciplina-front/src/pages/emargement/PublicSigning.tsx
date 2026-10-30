import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  IconAlert,
  IconCheckCircle,
  IconClock,
  IconLoader,
  IconQrCode,
  IconSignature,
  IconUser,
} from '@/components/ui/icons'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import PublicShell from '@/components/emargement/PublicShell'
import { EmargementLinkError, fetchPublicSigning, signByQr } from '@/api/emargement'
import type { PublicSigning, QrSignResult } from '@/types/emargement'
import {
  HALF_LABELS,
  WINDOW_LABELS,
  WINDOW_TONES,
  formatSeanceDate,
  formatTimestamp,
  seancePlace,
  seanceProgram,
} from '@/utils/emargement'

type Signed = QrSignResult

function Message({
  title,
  children,
  tone = 'neutral',
}: {
  title: string
  children: React.ReactNode
  tone?: 'neutral' | 'danger'
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
      {tone === 'danger' ? (
        <IconAlert width={30} height={30} className="text-[var(--ds-danger)]" />
      ) : (
        <IconCheckCircle width={30} height={30} className="text-[var(--ds-success)]" />
      )}
      <h1 className="text-lg font-bold text-[var(--ds-text)]">{title}</h1>
      <div className="max-w-sm text-[13px] text-[var(--ds-text-subtle)]">{children}</div>
    </div>
  )
}

export default function PublicSigning() {
  const { token = '' } = useParams()
  const [seance, setSeance] = useState<PublicSigning | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [signed, setSigned] = useState<Signed | null>(null)

  const load = useCallback(() => {
    fetchPublicSigning(token).then(
      (next) => {
        setSeance(next)
        setLoadError(null)
        setLoading(false)
      },
      (err: unknown) => {
        setLoadError(err instanceof Error ? err.message : 'Lien indisponible')
        setLoading(false)
      },
    )
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setFormError(null)
    setSubmitting(true)
    try {
      const result = await signByQr(token, email.trim())
      setSigned(result)
    } catch (err) {
      if (err instanceof EmargementLinkError) {
        if (err.code === 'window') {
          // La fenêtre a pu se fermer pendant la saisie : on rafraîchit l'état
          // affiché pour que l'alternant voie le créneau réel.
          load()
        }
        setFormError(err.message)
      } else {
        setFormError(err instanceof Error ? err.message : 'Signature impossible, réessayez.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <PublicShell width="narrow">
        <div className="flex items-center justify-center py-24 text-[var(--ds-text-subtle)]">
          <IconLoader width={28} height={28} className="animate-spin" />
        </div>
      </PublicShell>
    )
  }

  if (!seance) {
    return (
      <PublicShell width="narrow">
        <Message title="Lien indisponible" tone="danger">
          {loadError ?? 'Ce QR code n’est plus valable. Demandez le lien au formateur.'}
        </Message>
      </PublicShell>
    )
  }

  const openHalf = seance.openHalf
  const program = seanceProgram(seance)

  return (
    <PublicShell width="narrow">
      <header className="border-b border-[var(--ds-border)] px-6 py-6">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ds-text-subtle)]">
          <IconQrCode width={14} height={14} /> Émargement
        </p>
        <h1 className="mt-1 text-[22px] font-extrabold leading-tight text-[var(--ds-text)]">{seance.sessionNom}</h1>
        {program && <p className="mt-0.5 text-[13px] font-semibold text-[var(--ds-text-muted)]">{program}</p>}
        <p className="mt-1 text-[13px] text-[var(--ds-text-subtle)]">
          {formatSeanceDate(seance.date)} · {seance.startTime}–{seance.endTime}
        </p>
        <p className="text-[13px] text-[var(--ds-text-subtle)]">{seancePlace(seance)}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone={WINDOW_TONES[seance.windows.morning.state]}>
            {HALF_LABELS.morning} · {WINDOW_LABELS[seance.windows.morning.state]}
          </Badge>
          {seance.windows.afternoon && (
            <Badge tone={WINDOW_TONES[seance.windows.afternoon.state]}>
              {HALF_LABELS.afternoon} · {WINDOW_LABELS[seance.windows.afternoon.state]}
            </Badge>
          )}
        </div>
      </header>

      {signed ? (
        <div className="px-6 py-10">
          <div className="flex flex-col items-center gap-2 text-center">
            <IconCheckCircle width={40} height={40} className="text-[var(--ds-success)]" />
            <h2 className="text-lg font-bold text-[var(--ds-text)]">
              {signed.alreadySigned ? 'Présence déjà confirmée' : 'Présence confirmée'}
            </h2>
            <p className="text-[14px] font-semibold text-[var(--ds-text)]">{signed.fullName}</p>
            <p className="text-[13px] text-[var(--ds-text-subtle)]">
              {HALF_LABELS[signed.half]} · enregistré le {formatTimestamp(signed.signedAt)}
            </p>
            <p className="mt-2 max-w-sm text-[12px] text-[var(--ds-text-subtle)]">
              {signed.alreadySigned
                ? 'Votre présence était déjà enregistrée : aucune action supplémentaire n’est nécessaire.'
                : 'Votre présence est enregistrée. Vous pouvez fermer cette page.'}
            </p>
          </div>
        </div>
      ) : seance.signed ? (
        <Message title="Feuille déjà signée">
          Le formateur a signé la feuille d’émargement : les présences ne peuvent plus être modifiées. Contactez-le
          si une correction est nécessaire.
        </Message>
      ) : seance.expired ? (
        <Message title="Lien expiré" tone="danger">
          Ce lien n’est plus valable. Demandez au formateur de vous faire signer sur la feuille papier.
        </Message>
      ) : !openHalf ? (
        <Message title="Fenêtre de signature fermée">
          <p className="flex items-center justify-center gap-1.5">
            <IconClock width={14} height={14} />
            Ouverture : {seance.windows.morning.start}–{seance.windows.morning.end}
            {seance.windows.afternoon
              ? ` et ${seance.windows.afternoon.start}–${seance.windows.afternoon.end}`
              : ''}
          </p>
          <p className="mt-2">Revenez pendant l’un de ces créneaux pour confirmer votre présence.</p>
        </Message>
      ) : (
        <form onSubmit={handleSubmit} className="px-6 py-6">
          <p className="flex items-center gap-1.5 text-[13px] text-[var(--ds-text-muted)]">
            <IconSignature width={15} height={15} className="text-[var(--ds-accent)]" />
            Signature ouverte pour la demi-journée : <strong>{HALF_LABELS[openHalf]}</strong>
          </p>

          <label htmlFor="emargement-email" className="mt-5 block text-[13px] font-semibold text-[var(--ds-text-muted)]">
            Votre adresse e-mail
          </label>
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--ds-text-subtle)]">
              <IconUser width={16} height={16} />
            </span>
            <input
              id="emargement-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="prenom.nom@exemple.fr"
              className="w-full rounded-[var(--radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface)] py-2.5 pl-9 pr-3 text-[14px] text-[var(--ds-text)] outline-none focus:border-[var(--ds-accent)]"
            />
          </div>
          <p className="mt-1 text-[12px] text-[var(--ds-text-subtle)]">
            Utilisez l’adresse connue de votre école : elle permet de vous identifier dans la promotion.
          </p>

          {formError && (
            <p role="alert" className="mt-4 rounded-[var(--radius-md)] bg-[var(--ds-danger-bg)] px-3 py-2 text-[13px] text-[var(--ds-danger)]">
              {formError}
            </p>
          )}

          <Button type="submit" className="mt-5 w-full" isLoading={submitting} disabled={!email.trim()}>
            Confirmer ma présence
          </Button>
          <p className="mt-3 text-center text-[11px] text-[var(--ds-text-subtle)]">
            L’heure, l’adresse IP et l’appareil utilisés sont enregistrés comme preuve de signature.
          </p>
        </form>
      )}
    </PublicShell>
  )
}

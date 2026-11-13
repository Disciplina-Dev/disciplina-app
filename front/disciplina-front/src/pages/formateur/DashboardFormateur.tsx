import { useEffect, useState } from 'react'
import {
  IconArrowRight,
  IconCalendar,
  IconClock,
  IconMapPin,
  IconSignature,
  IconTraining,
} from '@/components/ui/icons'
import Badge from '@/components/ui/Badge'
import Card, { CardHeader } from '@/components/ui/Card'
import PageHeader from '@/components/ui/PageHeader'
import { LoadingPanel } from '@/components/ui/Spinner'
import { fetchFormateurDashboard } from '@/api/formateurApp'
import { useCurrentUser } from '@/store/authStore'
import { formatSeanceDate, formatMinutes, seancePlace, seanceProgram, VALIDATION_LABELS, VALIDATION_TONES } from '@/utils/emargement'
import type { FormateurDashboard } from '@/types/formateur'

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card padding="md">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ds-text-subtle)]">
        {label}
      </p>
      <p className="mt-1 text-[24px] font-extrabold leading-tight text-[var(--ds-text)]">{value}</p>
      {hint && <p className="mt-0.5 text-[12px] text-[var(--ds-text-subtle)]">{hint}</p>}
    </Card>
  )
}

/**
 * Accueil de l'espace formateur.
 *
 * Version minimale assumée : la prochaine séance et deux compteurs. Le
 * calendrier, les indisponibilités, la liste filtrable des séances et les
 * documents viendront dans les lots suivants de `AUDIT_FORMATEUR.md` — les
 * données nécessaires sont déjà servies par `GET /api/formateur/me`.
 */
export default function DashboardFormateur() {
  const currentUser = useCurrentUser()
  const [data, setData] = useState<FormateurDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetchFormateurDashboard().then(
      (dashboard) => {
        if (alive) setData(dashboard)
      },
      (err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : 'Chargement impossible')
      },
    )
    return () => {
      alive = false
    }
  }, [])

  if (error) {
    return (
      <div className="mx-auto w-full max-w-[1000px] px-4 py-8 sm:px-6">
        <Card>
          <CardHeader title="Espace indisponible" description={error} />
          <p className="text-[13px] text-[var(--ds-text-subtle)]">
            Si le problème persiste, contactez le service pédagogique.
          </p>
        </Card>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="mx-auto w-full max-w-[1000px] px-4 py-8 sm:px-6">
        <LoadingPanel message="Chargement de votre espace…" />
      </div>
    )
  }

  const { formateur, nextSeance } = data

  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-6 sm:px-6">
      <PageHeader
        eyebrow="Espace formateur"
        title={`Bonjour ${currentUser?.firstName || formateur.name}`}
        description="Votre prochain créneau et le volume de vos interventions. Les feuilles d’émargement restent accessibles depuis l’e-mail d’invitation."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat
          label="Séances à venir"
          value={String(data.upcomingSeanceCount)}
          hint="Aujourd’hui inclus"
        />
        <Stat label="Séances passées" value={String(data.pastSeanceCount)} />
        <Stat
          label="Prochaine séance"
          value={nextSeance ? formatSeanceDate(nextSeance.date) : '—'}
          hint={nextSeance ? `${nextSeance.startTime} – ${nextSeance.endTime}` : 'Aucune séance planifiée'}
        />
      </div>

      <Card>
        <CardHeader
          title="Prochain créneau"
          description="La première séance qui vous attend."
          actions={<IconCalendar width={18} height={18} className="text-[var(--ds-text-subtle)]" />}
        />

        {!nextSeance ? (
          <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--ds-border-strong)] px-4 py-8 text-center text-[13px] text-[var(--ds-text-subtle)]">
            Aucun créneau à venir pour le moment. Le service pédagogique vous préviendra dès qu’une
            intervention sera planifiée.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[17px] font-bold capitalize text-[var(--ds-text)]">
                {formatSeanceDate(nextSeance.date)}
              </p>
              <Badge tone={VALIDATION_TONES[nextSeance.validationStatus]}>
                {VALIDATION_LABELS[nextSeance.validationStatus]}
              </Badge>
            </div>

            <ul className="space-y-1.5 text-[13px] text-[var(--ds-text-muted)]">
              <li className="flex items-center gap-2">
                <IconClock width={14} height={14} className="shrink-0" />
                {nextSeance.startTime} – {nextSeance.endTime} · {formatMinutes(nextSeance.plannedMinutes)}
              </li>
              <li className="flex items-center gap-2">
                <IconTraining width={14} height={14} className="shrink-0" />
                <span className="font-semibold text-[var(--ds-text)]">{nextSeance.sessionNom}</span>
                {seanceProgram(nextSeance) && <span>· {seanceProgram(nextSeance)}</span>}
              </li>
              <li className="flex items-center gap-2">
                <IconMapPin width={14} height={14} className="shrink-0" />
                {seancePlace(nextSeance)}
              </li>
            </ul>

            <p className="flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--ds-surface-sunken)] px-3 py-2 text-[12px] text-[var(--ds-text-subtle)]">
              <IconSignature width={14} height={14} className="mt-0.5 shrink-0" />
              La feuille d’émargement s’ouvre depuis le lien reçu par e-mail le jour de la séance.
              <IconArrowRight width={14} height={14} className="mt-0.5 shrink-0" />
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}

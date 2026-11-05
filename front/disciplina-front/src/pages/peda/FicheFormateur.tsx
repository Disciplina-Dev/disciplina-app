import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  IconArrowLeft,
  IconClock,
  IconEdit,
  IconHistory,
  IconLoader,
  IconMail,
  IconPhone,
  IconSignature,
  IconTraining,
  IconUser,
} from '@/components/ui/icons'
import { addFormateurNote, fetchFormateur } from '@/api/formateurs'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card, { CardHeader } from '@/components/ui/Card'
import FormateurModal from '@/components/peda/FormateurModal'
import { formatDay, formatMinutes, formatTimestamp, VALIDATION_LABELS, VALIDATION_TONES } from '@/utils/emargement'
import type { FormateurChangeField, FormateurDetail, FormateurHistoryEntry } from '@/types/formateur'

const FIELD_LABELS: Record<FormateurChangeField, string> = {
  name: 'Nom',
  email: 'E-mail',
  phone: 'Téléphone',
  comment: 'Commentaire',
}

const ACTION_LABELS: Record<FormateurHistoryEntry['action'], string> = {
  formateur_created: 'Fiche créée',
  formateur_updated: 'Fiche modifiée',
  note: 'Note du Peda',
}

const ACTION_TONES: Record<FormateurHistoryEntry['action'], 'success' | 'accent' | 'purple'> = {
  formateur_created: 'success',
  formateur_updated: 'accent',
  note: 'purple',
}

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

function HistoryChanges({ entry }: { entry: FormateurHistoryEntry }) {
  if (entry.changes.length === 0) return null
  return (
    <ul className="mt-1 space-y-0.5 text-[12px] text-[var(--ds-text-muted)]">
      {entry.changes.map((change) => (
        <li key={change.field}>
          <span className="font-semibold">{FIELD_LABELS[change.field]} :</span>{' '}
          <span className="text-[var(--ds-text-subtle)]">{change.from || '—'}</span>
          {' → '}
          <span>{change.to || '—'}</span>
        </li>
      ))}
    </ul>
  )
}

export default function FicheFormateur() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [formateur, setFormateur] = useState<FormateurDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState<string | null>(null)
  const [savingNote, setSavingNote] = useState(false)

  useEffect(() => {
    if (!id) return
    let alive = true
    fetchFormateur(id).then(
      (row) => {
        if (!alive) return
        setFormateur(row)
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
  }, [id])

  async function handleAddNote(event: React.FormEvent) {
    event.preventDefault()
    if (!formateur) return
    const text = note.trim()
    if (!text) return setNoteError('La note est vide.')
    setSavingNote(true)
    setNoteError(null)
    try {
      setFormateur(await addFormateurNote(formateur.id, text))
      setNote('')
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : 'Ajout de la note impossible')
    } finally {
      setSavingNote(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[var(--ds-text-subtle)]">
        <IconLoader width={28} height={28} className="animate-spin" />
      </div>
    )
  }

  if (!formateur) {
    return (
      <div className="mx-auto w-full max-w-[1200px] px-4 py-6">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<IconArrowLeft width={16} height={16} />}
          onClick={() => navigate('/peda/formateurs')}
        >
          Retour aux formateurs
        </Button>
        <p className="mt-6 text-[var(--ds-danger)]">{error ?? 'Formateur introuvable.'}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<IconArrowLeft width={16} height={16} />}
            onClick={() => navigate('/peda/formateurs')}
          >
            Retour
          </Button>
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--ds-accent-soft)] text-[var(--ds-accent)]">
            <IconUser width={24} height={24} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-extrabold text-[var(--ds-text)]">{formateur.name}</h1>
            <a
              href={`mailto:${formateur.email}`}
              className="text-sm text-[var(--ds-text-muted)] hover:underline"
            >
              {formateur.email}
            </a>
          </div>
        </div>
        <Button
          variant="secondary"
          leftIcon={<IconEdit width={16} height={16} />}
          onClick={() => setEditing(true)}
        >
          Modifier la fiche
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Séances" value={String(formateur.stats.seanceCount)} />
        <Stat
          label="Heures de cours"
          value={formatMinutes(formateur.stats.plannedMinutes)}
          hint="Temps de formation planifié"
        />
        <Stat
          label="Sessions"
          value={String(formateur.stats.sessionCount)}
          hint={formateur.stats.sessions[0]?.nom}
        />
        <Stat
          label="Période"
          value={formatDay(formateur.stats.lastSeanceDate)}
          hint={
            formateur.stats.firstSeanceDate
              ? `Depuis le ${formatDay(formateur.stats.firstSeanceDate)}`
              : 'Aucune séance'
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader title="Coordonnées" />
            <dl className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <IconMail width={16} height={16} className="mt-0.5 shrink-0 text-[var(--ds-text-subtle)]" />
                <div className="min-w-0">
                  <dt className="text-[12px] text-[var(--ds-text-subtle)]">E-mail</dt>
                  <dd className="truncate">
                    <a href={`mailto:${formateur.email}`} className="text-[var(--ds-text)] hover:underline">
                      {formateur.email}
                    </a>
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <IconPhone width={16} height={16} className="mt-0.5 shrink-0 text-[var(--ds-text-subtle)]" />
                <div className="min-w-0">
                  <dt className="text-[12px] text-[var(--ds-text-subtle)]">Téléphone</dt>
                  <dd>
                    {formateur.phone ? (
                      <a href={`tel:${formateur.phone}`} className="text-[var(--ds-text)] hover:underline">
                        {formateur.phone}
                      </a>
                    ) : (
                      <span className="text-[var(--ds-text-subtle)]">Non renseigné</span>
                    )}
                  </dd>
                </div>
              </div>
              <div>
                <dt className="text-[12px] text-[var(--ds-text-subtle)]">Commentaire</dt>
                <dd className="whitespace-pre-line text-[13px] text-[var(--ds-text)]">
                  {formateur.comment || <span className="text-[var(--ds-text-subtle)]">Aucun commentaire</span>}
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader
              title="Sessions animées"
              description={`${formateur.stats.sessionCount} session${formateur.stats.sessionCount > 1 ? 's' : ''}`}
            />
            {formateur.stats.sessions.length === 0 ? (
              <p className="text-[13px] text-[var(--ds-text-subtle)]">
                Aucune séance : ce formateur n’a pas encore été affecté.
              </p>
            ) : (
              <ul className="space-y-2">
                {formateur.stats.sessions.map((session) => (
                  <li key={session.id}>
                    <Link
                      to={`/peda/sessions/${session.id}`}
                      className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--ds-border)] px-3 py-2 text-sm transition-colors hover:bg-[var(--ds-surface-sunken)]"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <IconTraining width={16} height={16} className="shrink-0 text-[var(--ds-accent)]" />
                        <span className="truncate font-semibold text-[var(--ds-text)]">{session.nom}</span>
                      </span>
                      <span className="shrink-0 text-[12px] text-[var(--ds-text-subtle)]">
                        {session.seanceCount} séance{session.seanceCount > 1 ? 's' : ''} ·{' '}
                        {formatMinutes(session.plannedMinutes)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card padding="none">
            <div className="px-5 pt-5">
              <CardHeader
                title="Historique des séances"
                description={`${formateur.seances.length} séance${formateur.seances.length > 1 ? 's' : ''}, de la plus récente à la plus ancienne.`}
              />
            </div>
            {formateur.seances.length === 0 ? (
              <p className="px-5 pb-5 text-[13px] text-[var(--ds-text-subtle)]">
                Aucune séance enregistrée pour ce formateur.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-y border-[var(--ds-border)] bg-[var(--ds-surface-sunken)] text-[11px] uppercase tracking-wide text-[var(--ds-text-subtle)]">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Date</th>
                      <th className="px-4 py-2 font-semibold">Session</th>
                      <th className="px-4 py-2 font-semibold">Module</th>
                      <th className="px-4 py-2 font-semibold">Horaires</th>
                      <th className="px-4 py-2 font-semibold">Statut</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {formateur.seances.map((seance) => (
                      <tr key={seance.id} className="border-b border-[var(--ds-border)] last:border-0">
                        <td className="whitespace-nowrap px-4 py-2.5 text-[var(--ds-text-muted)]">
                          {formatDay(seance.date)}
                        </td>
                        <td className="max-w-[180px] truncate px-4 py-2.5 font-semibold text-[var(--ds-text)]">
                          {seance.sessionNom}
                        </td>
                        <td className="max-w-[180px] truncate px-4 py-2.5 text-[var(--ds-text-muted)]">
                          {seance.module || '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-[var(--ds-text-muted)]">
                          <span className="flex items-center gap-1">
                            <IconClock width={13} height={13} />
                            {seance.startTime} – {seance.endTime} · {formatMinutes(seance.plannedMinutes)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge tone={VALIDATION_TONES[seance.validationStatus]}>
                            {VALIDATION_LABELS[seance.validationStatus]}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Link
                            to={`/peda/emargements/${seance.id}`}
                            className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--ds-accent)] hover:underline"
                          >
                            <IconSignature width={13} height={13} />
                            Feuille
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Historique des saisies"
              description="Création, modifications de la fiche et notes du Peda — conservées sans modification."
              actions={<IconHistory width={18} height={18} className="text-[var(--ds-text-subtle)]" />}
            />

            <form onSubmit={handleAddNote} className="mb-5 space-y-2">
              <label htmlFor="formateur-note" className="text-[13px] font-semibold text-[var(--ds-text-muted)]">
                Ajouter une note
              </label>
              <textarea
                id="formateur-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                placeholder="Ex. Prévenir 48 h avant, refuse les séances du vendredi…"
                className="w-full rounded-[var(--radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface)] px-4 py-2.5 text-sm text-[var(--ds-text)] placeholder:text-[var(--ds-text-subtle)] outline-none transition-[border-color,box-shadow] focus:border-[var(--ds-accent)] focus:ring-2 focus:ring-[var(--ds-accent)]/15"
              />
              {noteError && <p className="text-xs font-medium text-[var(--ds-danger)]">{noteError}</p>}
              <div className="flex justify-end">
                <Button type="submit" size="sm" isLoading={savingNote} loadingLabel="Ajout">
                  Ajouter la note
                </Button>
              </div>
            </form>

            {formateur.history.length === 0 ? (
              <p className="text-[13px] text-[var(--ds-text-subtle)]">Aucune saisie enregistrée.</p>
            ) : (
              <ol className="space-y-4">
                {formateur.history.map((entry) => (
                  <li key={entry.id} className="relative border-l border-[var(--ds-border)] pl-4">
                    <span className="absolute -left-1 top-1.5 h-2 w-2 rounded-full bg-[var(--ds-accent)]" />
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={ACTION_TONES[entry.action]}>{ACTION_LABELS[entry.action]}</Badge>
                      <span className="text-[12px] text-[var(--ds-text-subtle)]">
                        {formatTimestamp(entry.at)}
                        {entry.actorName ? ` · ${entry.actorName}` : ''}
                      </span>
                    </div>
                    <HistoryChanges entry={entry} />
                    {entry.note && (
                      <p className="mt-2 whitespace-pre-line rounded-[var(--radius-md)] bg-[var(--ds-surface-sunken)] px-3 py-2 text-[13px] text-[var(--ds-text)]">
                        {entry.note}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>

      {editing && (
        <FormateurModal
          formateur={formateur}
          onClose={() => setEditing(false)}
          onSaved={(saved) => setFormateur(saved)}
        />
      )}
    </div>
  )
}

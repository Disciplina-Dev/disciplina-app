import { useEffect, useState } from 'react'
import { IconCalendar, IconClose, IconSignature } from '@/components/ui/icons'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
import Select from '@/components/ui/Select'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { createSeance, updateSeance } from '@/api/emargement'
import { fetchSessions } from '@/api/sessions'
import type { Seance, SeanceMode, SeanceSite } from '@/types/emargement'
import { SEANCE_SITES } from '@/types/emargement'

type SeanceFormModalProps = {
  /** Séance à modifier ; absente = création. */
  seance?: Seance | null
  onClose: () => void
  /** `inviteSent === false` : la séance existe, mais l'e-mail d'invitation n'est pas parti. */
  onSaved: (seance: Seance, inviteSent?: boolean) => void
}

const SITE_OPTIONS = SEANCE_SITES.map((site) => ({ value: site, label: site }))
const MODE_OPTIONS = [
  { value: 'salle' as SeanceMode, label: 'En salle' },
  { value: 'distanciel' as SeanceMode, label: 'Distanciel' },
]

function todayIso(): string {
  // `toISOString` est en UTC : sur un fuseau négatif, la date glisserait d'un
  // jour. On reste sur la date locale de l'utilisateur qui remplit le formulaire.
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

export default function SeanceFormModal({ seance, onClose, onSaved }: SeanceFormModalProps) {
  const editing = Boolean(seance)
  const [sessions, setSessions] = useState<{ id: string; nom: string }[]>([])
  const [sessionId, setSessionId] = useState(seance?.sessionId ?? '')
  const [date, setDate] = useState(seance?.date ?? todayIso())
  const [startTime, setStartTime] = useState(seance?.startTime ?? '09:00')
  const [endTime, setEndTime] = useState(seance?.endTime ?? '17:00')
  const [site, setSite] = useState<SeanceSite>(seance?.site ?? 'Nord')
  const [mode, setMode] = useState<SeanceMode>(seance?.mode ?? 'salle')
  const [moduleName, setModuleName] = useState(seance?.module ?? '')
  const [location, setLocation] = useState(seance?.location ?? '')
  const [formateurName, setFormateurName] = useState(seance?.formateurName ?? '')
  const [formateurEmail, setFormateurEmail] = useState(seance?.formateurEmail ?? '')
  const [morningStart, setMorningStart] = useState(seance?.morningStart ?? '08:45')
  const [morningEnd, setMorningEnd] = useState(seance?.morningEnd ?? '09:15')
  const [hasAfternoon, setHasAfternoon] = useState(Boolean(seance?.afternoonStart))
  const [afternoonStart, setAfternoonStart] = useState(seance?.afternoonStart ?? '13:45')
  const [afternoonEnd, setAfternoonEnd] = useState(seance?.afternoonEnd ?? '14:15')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    fetchSessions().then(
      (rows) => {
        if (!alive) return
        setSessions(rows.map((row) => ({ id: row.id, nom: row.nom })))
      },
      (err: unknown) => {
        if (!alive) return
        setError(err instanceof Error ? err.message : 'Chargement des sessions impossible')
      },
    )
    return () => {
      alive = false
    }
  }, [])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!sessionId) return setError('La session est obligatoire.')
    if (!date) return setError('La date est obligatoire.')
    if (!formateurName.trim()) return setError('Le nom du formateur est obligatoire.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formateurEmail.trim())) {
      return setError('L’adresse e-mail du formateur est invalide.')
    }
    if (startTime >= endTime) return setError('L’heure de fin doit suivre l’heure de début.')
    if (morningStart >= morningEnd) return setError('Le créneau du matin est invalide.')
    if (hasAfternoon && afternoonStart >= afternoonEnd) {
      return setError('Le créneau de l’après-midi est invalide.')
    }

    const payload = {
      sessionId,
      date,
      startTime,
      endTime,
      site,
      mode,
      formateurName: formateurName.trim(),
      formateurEmail: formateurEmail.trim(),
      morningStart,
      morningEnd,
      afternoonStart: hasAfternoon ? afternoonStart : null,
      afternoonEnd: hasAfternoon ? afternoonEnd : null,
      module: moduleName.trim() || null,
      location: location.trim() || null,
    }

    setSaving(true)
    try {
      if (editing && seance) {
        onSaved(await updateSeance(seance.id, payload))
      } else {
        const created = await createSeance(payload)
        onSaved(created.seance, created.inviteSent)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[var(--ds-text)]/50 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-[var(--ds-surface)] shadow-2xl"
        aria-labelledby="seance-modal-title"
      >
        <div className="flex items-center justify-between border-b border-[var(--ds-border)] px-6 py-4">
          <h2 id="seance-modal-title" className="flex items-center gap-2 text-lg font-bold text-[var(--ds-text)]">
            <IconSignature width={20} height={20} className="text-[var(--ds-accent)]" />
            {editing ? 'Modifier la séance' : 'Nouvelle séance d’émargement'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--ds-text-subtle)] transition-colors hover:bg-[var(--ds-surface-sunken)]"
            aria-label="Fermer"
          >
            <IconClose width={18} height={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <Select
            label="Session (groupe d’alternants)"
            options={[
              { value: '', label: sessions.length ? 'Choisir une session…' : 'Chargement…' },
              ...sessions.map((session) => ({ value: session.id, label: session.nom })),
            ]}
            value={sessionId}
            onChange={setSessionId}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <InputField
              id="seance-date"
              label="Date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
            <InputField
              id="seance-start"
              label="Début"
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              required
            />
            <InputField
              id="seance-end"
              label="Fin"
              type="time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Site" options={SITE_OPTIONS} value={site} onChange={setSite} />
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-[var(--ds-text-muted)]">Modalité</span>
              <SegmentedControl
                label="Modalité de la séance"
                options={MODE_OPTIONS}
                value={mode}
                onChange={setMode}
                tone="accent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InputField
              id="seance-module"
              label="Module / séquence"
              value={moduleName}
              onChange={(event) => setModuleName(event.target.value)}
              placeholder="Ex. Séquence 3 — Communication"
              hint="Figure sur la feuille d’émargement."
            />
            <InputField
              id="seance-lieu"
              label="Lieu précis"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Ex. Salle 204, Visio Teams"
              hint="Complète le site et la modalité."
            />
          </div>

          <fieldset className="space-y-3 rounded-[var(--radius-md)] border border-[var(--ds-border)] p-4">
            <legend className="px-1 text-[13px] font-semibold text-[var(--ds-text-muted)]">Formateur</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InputField
                id="seance-formateur-nom"
                label="Nom du formateur"
                value={formateurName}
                onChange={(event) => setFormateurName(event.target.value)}
                required
              />
              <InputField
                id="seance-formateur-email"
                label="E-mail du formateur"
                type="email"
                value={formateurEmail}
                onChange={(event) => setFormateurEmail(event.target.value)}
                hint="Recevra le lien de gestion de la feuille."
                required
              />
            </div>
          </fieldset>

          <fieldset className="space-y-3 rounded-[var(--radius-md)] border border-[var(--ds-border)] p-4">
            <legend className="flex items-center gap-1.5 px-1 text-[13px] font-semibold text-[var(--ds-text-muted)]">
              <IconCalendar width={14} height={14} />
              Fenêtres de signature
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <InputField
                id="seance-matin-debut"
                label="Matin — ouverture"
                type="time"
                value={morningStart}
                onChange={(event) => setMorningStart(event.target.value)}
                required
              />
              <InputField
                id="seance-matin-fin"
                label="Matin — fermeture"
                type="time"
                value={morningEnd}
                onChange={(event) => setMorningEnd(event.target.value)}
                required
              />
            </div>

            <label className="flex items-center gap-2 text-[13px] font-medium text-[var(--ds-text-muted)]">
              <input
                type="checkbox"
                checked={hasAfternoon}
                onChange={(event) => setHasAfternoon(event.target.checked)}
                className="h-4 w-4 rounded border-[var(--ds-border)] text-[var(--ds-accent)]"
              />
              Séance avec une demi-journée l’après-midi
            </label>

            {hasAfternoon && (
              <div className="grid grid-cols-2 gap-3">
                <InputField
                  id="seance-apresmidi-debut"
                  label="Après-midi — ouverture"
                  type="time"
                  value={afternoonStart}
                  onChange={(event) => setAfternoonStart(event.target.value)}
                />
                <InputField
                  id="seance-apresmidi-fin"
                  label="Après-midi — fermeture"
                  type="time"
                  value={afternoonEnd}
                  onChange={(event) => setAfternoonEnd(event.target.value)}
                />
              </div>
            )}
            <p className="text-[12px] text-[var(--ds-text-subtle)]">
              Les alternants ne peuvent signer que dans ces créneaux ; le formateur peut toujours corriger une
              demi-journée close.
            </p>
          </fieldset>

          {error && (
            <p role="alert" className="rounded-[var(--radius-md)] bg-[var(--ds-danger-bg)] px-4 py-3 text-[13px] text-[var(--ds-danger)]">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--ds-border)] px-6 py-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" isLoading={saving}>
            {editing ? 'Enregistrer' : 'Créer et inviter le formateur'}
          </Button>
        </div>
      </form>
    </div>
  )
}

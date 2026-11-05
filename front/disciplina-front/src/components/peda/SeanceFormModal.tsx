import { useEffect, useState } from 'react'
import { IconCalendar, IconClose, IconSignature } from '@/components/ui/icons'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
import Select from '@/components/ui/Select'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { createSeance, updateSeance } from '@/api/emargement'
import { fetchSessions } from '@/api/sessions'
import FormateurPicker from '@/components/peda/FormateurPicker'
import type { Formateur } from '@/types/formateur'
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
  // Horaires de cours : base des heures prévues / réalisées. Sur une séance
  // antérieure au lot 8, on pré-remplit avec les créneaux de signature pour que
  // les heures calculées restent identiques.
  const [morningClassStart, setMorningClassStart] = useState(
    seance?.morningClassStart ?? seance?.morningStart ?? '09:00',
  )
  const [morningClassEnd, setMorningClassEnd] = useState(seance?.morningClassEnd ?? seance?.morningEnd ?? '12:30')
  const [site, setSite] = useState<SeanceSite>(seance?.site ?? 'Nord')
  const [mode, setMode] = useState<SeanceMode>(seance?.mode ?? 'salle')
  const [moduleName, setModuleName] = useState(seance?.module ?? '')
  const [location, setLocation] = useState(seance?.location ?? '')
  const [formateurName, setFormateurName] = useState(seance?.formateurName ?? '')
  const [formateurEmail, setFormateurEmail] = useState(seance?.formateurEmail ?? '')
  const [formateurId, setFormateurId] = useState<string | null>(seance?.formateurId ?? null)
  const [morningStart, setMorningStart] = useState(seance?.morningStart ?? '09:00')
  const [morningEnd, setMorningEnd] = useState(seance?.morningEnd ?? '09:15')
  const [hasAfternoon, setHasAfternoon] = useState(
    Boolean(seance?.afternoonStart ?? seance?.afternoonClassStart),
  )
  const [afternoonClassStart, setAfternoonClassStart] = useState(
    seance?.afternoonClassStart ?? seance?.afternoonStart ?? '13:30',
  )
  const [afternoonClassEnd, setAfternoonClassEnd] = useState(
    seance?.afternoonClassEnd ?? seance?.afternoonEnd ?? '17:00',
  )
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
    // Horaires de cours : ils portent les heures prévues / réalisées.
    if (morningClassStart >= morningClassEnd) {
      return setError('Les horaires de cours du matin sont invalides.')
    }
    if (hasAfternoon && afternoonClassStart >= afternoonClassEnd) {
      return setError('Les horaires de cours de l’après-midi sont invalides.')
    }
    if (hasAfternoon && morningClassEnd > afternoonClassStart) {
      return setError('Les horaires de cours du matin et de l’après-midi se chevauchent.')
    }
    if (morningStart >= morningEnd) return setError('Le créneau du matin est invalide.')
    // Les créneaux sont des fenêtres *à l'intérieur* de la demi-journée de cours :
    // le back refuse (400) une ouverture avant le début ou une fermeture après la fin.
    if (morningStart < morningClassStart) {
      return setError('Le créneau du matin ne peut pas ouvrir avant le début des cours du matin.')
    }
    if (morningEnd > morningClassEnd) {
      return setError('Le créneau du matin ne peut pas fermer après la fin des cours du matin.')
    }
    if (hasAfternoon && afternoonStart >= afternoonEnd) {
      return setError('Le créneau de l’après-midi est invalide.')
    }
    if (hasAfternoon && afternoonStart < afternoonClassStart) {
      return setError('Le créneau de l’après-midi ne peut pas ouvrir avant le début des cours de l’après-midi.')
    }
    if (hasAfternoon && afternoonEnd > afternoonClassEnd) {
      return setError('Le créneau de l’après-midi ne peut pas fermer après la fin des cours de l’après-midi.')
    }

    const payload = {
      sessionId,
      date,
      site,
      mode,
      formateurName: formateurName.trim(),
      formateurEmail: formateurEmail.trim(),
      formateurId,
      morningClassStart,
      morningClassEnd,
      afternoonClassStart: hasAfternoon ? afternoonClassStart : null,
      afternoonClassEnd: hasAfternoon ? afternoonClassEnd : null,
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
          </div>

          <fieldset className="space-y-3 rounded-[var(--radius-md)] border border-[var(--ds-border)] p-4">
            <legend className="flex items-center gap-1.5 px-1 text-[13px] font-semibold text-[var(--ds-text-muted)]">
              <IconCalendar width={14} height={14} />
              Horaires de cours
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <InputField
                id="seance-cours-matin-debut"
                label="Matin — début"
                type="time"
                value={morningClassStart}
                onChange={(event) => setMorningClassStart(event.target.value)}
                required
              />
              <InputField
                id="seance-cours-matin-fin"
                label="Matin — fin"
                type="time"
                value={morningClassEnd}
                min={morningClassStart}
                onChange={(event) => setMorningClassEnd(event.target.value)}
                required
              />
            </div>
            {hasAfternoon && (
              <div className="grid grid-cols-2 gap-3">
                <InputField
                  id="seance-cours-apresmidi-debut"
                  label="Après-midi — début"
                  type="time"
                  value={afternoonClassStart}
                  min={morningClassEnd}
                  onChange={(event) => setAfternoonClassStart(event.target.value)}
                />
                <InputField
                  id="seance-cours-apresmidi-fin"
                  label="Après-midi — fin"
                  type="time"
                  value={afternoonClassEnd}
                  min={afternoonClassStart}
                  onChange={(event) => setAfternoonClassEnd(event.target.value)}
                />
              </div>
            )}
            <label className="flex items-center gap-2 text-[13px] font-medium text-[var(--ds-text-muted)]">
              <input
                type="checkbox"
                checked={hasAfternoon}
                onChange={(event) => setHasAfternoon(event.target.checked)}
                className="h-4 w-4 rounded border-[var(--ds-border)] text-[var(--ds-accent)]"
              />
              Séance avec une demi-journée l’après-midi
            </label>
            <p className="text-[12px] text-[var(--ds-text-subtle)]">
              Base des heures prévues et réalisées : la pause déjeuner entre les deux demi-journées n’est pas
              comptée.
            </p>
          </fieldset>

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
            <div className="space-y-1.5">
              <span className="text-[13px] font-semibold text-[var(--ds-text-muted)]">
                Formateur existant
              </span>
              <FormateurPicker
                selectedId={formateurId}
                currentName={formateurName}
                onSelect={(formateur: Formateur) => {
                  setFormateurId(formateur.id)
                  setFormateurName(formateur.name)
                  setFormateurEmail(formateur.email)
                }}
                onClear={() => setFormateurId(null)}
              />
              <p className="text-xs text-[var(--ds-text-subtle)]">
                Sélectionnez une fiche de l’annuaire, ou saisissez un nouveau formateur : sa fiche sera créée
                automatiquement.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InputField
                id="seance-formateur-nom"
                label="Nom du formateur"
                value={formateurName}
                onChange={(event) => {
                  setFormateurName(event.target.value)
                  setFormateurId(null)
                }}
                required
              />
              <InputField
                id="seance-formateur-email"
                label="E-mail du formateur"
                type="email"
                value={formateurEmail}
                onChange={(event) => {
                  setFormateurEmail(event.target.value)
                  setFormateurId(null)
                }}
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
                min={morningClassStart}
                max={morningClassEnd}
                onChange={(event) => setMorningStart(event.target.value)}
                required
              />
              <InputField
                id="seance-matin-fin"
                label="Matin — fermeture"
                type="time"
                value={morningEnd}
                min={morningStart}
                max={morningClassEnd}
                onChange={(event) => setMorningEnd(event.target.value)}
                required
              />
            </div>

            {hasAfternoon && (
              <div className="grid grid-cols-2 gap-3">
                <InputField
                  id="seance-apresmidi-debut"
                  label="Après-midi — ouverture"
                  type="time"
                  value={afternoonStart}
                  min={afternoonClassStart}
                  max={afternoonClassEnd}
                  onChange={(event) => setAfternoonStart(event.target.value)}
                />
                <InputField
                  id="seance-apresmidi-fin"
                  label="Après-midi — fermeture"
                  type="time"
                  value={afternoonEnd}
                  min={afternoonStart}
                  max={afternoonClassEnd}
                  onChange={(event) => setAfternoonEnd(event.target.value)}
                />
              </div>
            )}
            <p className="text-[12px] text-[var(--ds-text-subtle)]">
              Les créneaux doivent rester dans les horaires de cours de leur demi-journée. Les alternants ne
              peuvent signer que dans ces créneaux ; le formateur peut toujours corriger une demi-journée close.
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

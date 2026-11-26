import { useEffect, useState } from 'react'
import { IconClose, IconTraining } from '@/components/ui/icons'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
import { createSession, fetchSessionDegrees } from '@/api/sessions'
import type { Session, SessionDegree } from '@/types/session'

interface SessionFormModalProps {
  onClose: () => void
  onSaved?: (session: Session) => void
}

const EMPTY_PERSON = { firstName: '', lastName: '', mailAddress: '' }
const EMPTY_ADDRESS = { street: '', complement: '', postcode: '', city: '', country: '' }

const selectClass =
  'w-full rounded-[var(--radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface)] py-2.5 pl-4 pr-4 text-sm text-[var(--ds-text)] outline-none transition-[border-color,box-shadow] duration-150 focus:border-[var(--ds-accent)] focus:ring-2 focus:ring-[var(--ds-accent)]/15'

function PersonFields({
  prefix,
  title,
  value,
  onChange,
}: {
  prefix: string
  title: string
  value: typeof EMPTY_PERSON
  onChange: (v: typeof EMPTY_PERSON) => void
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-[13px] font-semibold text-[var(--ds-text-muted)]">{title}</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <InputField
          id={`${prefix}-prenom`}
          label="Prénom"
          value={value.firstName}
          onChange={(e) => onChange({ ...value, firstName: e.target.value })}
        />
        <InputField
          id={`${prefix}-nom`}
          label="Nom"
          value={value.lastName}
          onChange={(e) => onChange({ ...value, lastName: e.target.value })}
        />
      </div>
      <InputField
        id={`${prefix}-mail`}
        label="Email"
        type="email"
        value={value.mailAddress}
        onChange={(e) => onChange({ ...value, mailAddress: e.target.value })}
      />
    </fieldset>
  )
}

export default function SessionFormModal({ onClose, onSaved }: SessionFormModalProps) {
  const [degrees, setDegrees] = useState<SessionDegree[]>([])
  const [degreeId, setDegreeId] = useState('')
  const [nom, setNom] = useState('')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [subjectValidation, setSubjectValidation] = useState(false)
  const [generalEducationDuration, setGeneralEducationDuration] = useState('')
  const [headTeacher, setHeadTeacher] = useState(EMPTY_PERSON)
  const [referentTeacher, setReferentTeacher] = useState(EMPTY_PERSON)
  const [address, setAddress] = useState(EMPTY_ADDRESS)

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let alive = true
    fetchSessionDegrees().then(
      (rows) => alive && setDegrees(rows),
      (e: unknown) => alive && setError(e instanceof Error ? e.message : 'Chargement des formations impossible'),
    )
    return () => {
      alive = false
    }
  }, [])

  // Un enseignant n'est envoyé que complet ; sinon Filiz reprend celui de la formation.
  function personOrNull(p: typeof EMPTY_PERSON, label: string) {
    const filled = Object.values(p).filter((v) => v.trim()).length
    if (filled === 0) return null
    if (filled < 3) throw new Error(`${label} : prénom, nom et email sont requis.`)
    return { firstName: p.firstName.trim(), lastName: p.lastName.trim(), mailAddress: p.mailAddress.trim() }
  }

  async function handleSubmit(e?: { preventDefault: () => void }) {
    e?.preventDefault()
    setError(null)
    if (!degreeId) return setError('La formation est obligatoire.')
    if (!nom.trim()) return setError('Le nom de la promotion est obligatoire.')
    if (!dateDebut) return setError('La date de début est obligatoire.')
    if (!dateFin) return setError('La date de fin est obligatoire.')
    if (dateFin < dateDebut) return setError('La date de fin doit être postérieure à la date de début.')

    setLoading(true)
    try {
      const filledAddress = Object.fromEntries(Object.entries(address).filter(([, v]) => v.trim()))
      const saved = await createSession({
        degreeId,
        nom: nom.trim(),
        dateDebut,
        dateFin,
        subjectValidation,
        generalEducationDuration: generalEducationDuration.trim() || null,
        headTeacher: personOrNull(headTeacher, 'Responsable pédagogique'),
        referentTeacher: personOrNull(referentTeacher, 'Professeur référent'),
        realizationAddress: Object.keys(filledAddress).length > 0 ? filledAddress : null,
      })
      onSaved?.(saved)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l’enregistrement')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[var(--ds-text)]/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-[var(--ds-surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--ds-border)] px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ds-text)]">
            <IconTraining width={20} height={20} className="text-teal-700" />
            Nouvelle session
          </h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-full p-1.5 text-[var(--ds-text-subtle)] hover:bg-[var(--ds-surface-sunken)]"
          >
            <IconClose width={18} height={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="session-degree" className="text-[13px] font-semibold text-[var(--ds-text-muted)]">
              Formation *
            </label>
            <select
              id="session-degree"
              value={degreeId}
              onChange={(e) => setDegreeId(e.target.value)}
              className={selectClass}
            >
              <option value="">— Choisir une formation —</option>
              {degrees.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </div>
          <InputField
            id="session-nom"
            label="Nom de la promotion"
            required
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Ex : BTS MCO 2026 Groupe A"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InputField
              id="session-debut"
              label="Date de début"
              type="date"
              required
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
            />
            <InputField
              id="session-fin"
              label="Date de fin"
              type="date"
              required
              value={dateFin}
              min={dateDebut || undefined}
              onChange={(e) => setDateFin(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--ds-text)]">
            <input
              type="checkbox"
              checked={subjectValidation}
              onChange={(e) => setSubjectValidation(e.target.checked)}
            />
            Validation du sujet et de la description du stage
          </label>
          <InputField
            id="session-duree-generale"
            label="Durée des enseignements généraux (contrat de professionnalisation)"
            value={generalEducationDuration}
            onChange={(e) => setGeneralEducationDuration(e.target.value)}
            hint="Obligatoire si la formation propose le contrat de professionnalisation."
          />

          <details className="rounded-xl border border-[var(--ds-border)] px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-[var(--ds-text)]">
              Surcharger la formation (optionnel)
            </summary>
            <div className="mt-4 space-y-5">
              <p className="text-xs text-[var(--ds-text-subtle)]">
                Les champs laissés vides sont repris de la formation par Filiz.
              </p>
              <PersonFields
                prefix="session-head"
                title="Responsable pédagogique"
                value={headTeacher}
                onChange={setHeadTeacher}
              />
              <PersonFields
                prefix="session-ref"
                title="Professeur référent"
                value={referentTeacher}
                onChange={setReferentTeacher}
              />
              <fieldset className="space-y-3">
                <legend className="mb-2 text-[13px] font-semibold text-[var(--ds-text-muted)]">
                  Lieu de formation
                </legend>
                <InputField
                  id="session-street"
                  label="Rue"
                  value={address.street}
                  onChange={(e) => setAddress({ ...address, street: e.target.value })}
                />
                <InputField
                  id="session-complement"
                  label="Complément"
                  value={address.complement}
                  onChange={(e) => setAddress({ ...address, complement: e.target.value })}
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <InputField
                    id="session-postcode"
                    label="Code postal"
                    value={address.postcode}
                    onChange={(e) => setAddress({ ...address, postcode: e.target.value })}
                  />
                  <InputField
                    id="session-city"
                    label="Ville"
                    value={address.city}
                    onChange={(e) => setAddress({ ...address, city: e.target.value })}
                  />
                  <InputField
                    id="session-country"
                    label="Pays"
                    value={address.country}
                    onChange={(e) => setAddress({ ...address, country: e.target.value })}
                  />
                </div>
              </fieldset>
            </div>
          </details>

          {error && (
            <p className="rounded-xl border border-[var(--ds-danger)]/30 bg-[var(--ds-danger-bg)] px-4 py-3 text-sm text-[var(--ds-danger)]">
              {error}
            </p>
          )}
        </form>

        <div className="flex justify-end gap-2 border-t border-[var(--ds-border)] px-6 py-4">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={loading} loadingLabel="Enregistrement">
            Créer la promotion
          </Button>
        </div>
      </div>
    </div>
  )
}

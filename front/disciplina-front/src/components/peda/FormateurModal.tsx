import { useState } from 'react'
import { IconClose, IconUserPlus } from '@/components/ui/icons'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
import { createFormateur, updateFormateur } from '@/api/formateurs'
import type { Formateur, FormateurDetail } from '@/types/formateur'

type FormateurModalProps = {
  /** Fiche à modifier ; absente = création. */
  formateur?: Formateur | null
  onClose: () => void
  onSaved: (formateur: FormateurDetail) => void
}

const TEXTAREA_CLASSES =
  'w-full rounded-[var(--radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface)] px-4 py-2.5 text-sm text-[var(--ds-text)] placeholder:text-[var(--ds-text-subtle)] outline-none transition-[border-color,box-shadow] duration-150 focus:border-[var(--ds-accent)] focus:ring-2 focus:ring-[var(--ds-accent)]/15'

export default function FormateurModal({ formateur, onClose, onSaved }: FormateurModalProps) {
  const editing = Boolean(formateur)
  const [name, setName] = useState(formateur?.name ?? '')
  const [email, setEmail] = useState(formateur?.email ?? '')
  const [phone, setPhone] = useState(formateur?.phone ?? '')
  const [comment, setComment] = useState(formateur?.comment ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (!name.trim()) return setError('Le nom du formateur est obligatoire.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return setError('L’adresse e-mail du formateur est invalide.')
    }

    const payload = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || null,
      comment: comment.trim() || null,
    }
    setSaving(true)
    try {
      const saved = editing && formateur
        ? await updateFormateur(formateur.id, payload)
        : await createFormateur(payload)
      onSaved(saved)
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
        className="relative flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-[var(--ds-surface)] shadow-2xl"
        aria-labelledby="formateur-modal-title"
      >
        <div className="flex items-center justify-between border-b border-[var(--ds-border)] px-6 py-4">
          <h2
            id="formateur-modal-title"
            className="flex items-center gap-2 text-lg font-bold text-[var(--ds-text)]"
          >
            <IconUserPlus width={20} height={20} className="text-[var(--ds-accent)]" />
            {editing ? 'Modifier le formateur' : 'Nouveau formateur'}
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

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <InputField
            id="formateur-nom"
            label="Nom"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
            required
          />
          <InputField
            id="formateur-email"
            label="E-mail"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            hint="Sert à rattacher les séances et à envoyer les invitations d’émargement."
            required
          />
          <InputField
            id="formateur-telephone"
            label="Téléphone"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Facultatif"
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="formateur-commentaire" className="text-[13px] font-semibold text-[var(--ds-text-muted)]">
              Commentaire
            </label>
            <textarea
              id="formateur-commentaire"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={4}
              placeholder="Facultatif — disponibilités, consignes, remarques…"
              className={TEXTAREA_CLASSES}
            />
          </div>

          {error && (
            <div className="rounded-xl border border-[var(--ds-danger)]/30 bg-[var(--ds-danger-bg)] px-4 py-3 text-sm text-[var(--ds-danger)]">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--ds-border)] px-6 py-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" isLoading={saving} loadingLabel="Enregistrement">
            {editing ? 'Enregistrer' : 'Créer le formateur'}
          </Button>
        </div>
      </form>
    </div>
  )
}
